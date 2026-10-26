// Builds kindle.html, the e-ink edition for the Kindle browser, from src/kindle.template.html.
//
//   node scripts/build-kindle.mjs
//
// The word pools, keyboard layout and category hints are read out of src/squiggle.template.html,
// so the Kindle page always serves the same daily words as the phone game. The guess dictionary is
// trimmed to 4, 6 and 8 letter words (the only lengths a round can have) to keep the page light.
// It then checks the next 60 days of daily words against the phone game's own functions.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const game = readFileSync(join(root, 'src', 'squiggle.template.html'), 'utf8');
const tpl = readFileSync(join(root, 'src', 'kindle.template.html'), 'utf8');

// The English language block: from "  en:{" up to "  es:{"
const a = game.indexOf('\n  en:{'), b = game.indexOf('\n  es:{');
if (a < 0 || b < 0) throw new Error('could not find the English block in LANGS');
const en = vm.runInNewContext('({' + game.slice(a, b).trim().replace(/,\s*$/, '').replace('"__VALID__"', '""') + '})').en;

const grabConst = name => {
  const m = game.match(new RegExp('^const ' + name + '=(.*);\\s*$', 'm'));
  if (!m) throw new Error('could not find ' + name);
  return vm.runInNewContext('(' + m[1] + ')');
};
const CATS = grabConst('CATS').en, LABELS = grabConst('CAT_LABELS').en;
const catOf = {};
for (const [cat, words] of Object.entries(CATS)) for (const w of words.split(' ')) if (w) catOf[w.toLowerCase()] = LABELS[cat];

const pool = {};
for (const n of [4, 6, 8]) pool[n] = en.pool[n].map(w => w.toLowerCase());

const extra = [...en.week.flat(), ...en.drawWeek, ...Object.values(pool).flat()];
const lens = new Set([4, 6, 8]);
const dict = [...new Set(readFileSync(join(root, 'src', 'words.txt'), 'utf8').split(/\r?\n/).concat(extra))]
  .filter(w => /^[a-z]+$/.test(w) && lens.has(w.length));

const data = { rows: en.rows, off: en.off, week: en.week, drawWeek: en.drawWeek, pool, catOf };
for (const tag of ['__KINDLE_DATA__', '__KINDLE_DICT__']) if (tpl.split(tag).length !== 2) throw new Error(`template must contain ${tag} exactly once`);
const out = tpl.replace('__KINDLE_DATA__', () => JSON.stringify(data)).replace('__KINDLE_DICT__', () => JSON.stringify(dict.join('|')));
writeFileSync(join(root, 'kindle.html'), out);

// Cross-check: the phone game's own daily functions vs the Kindle page's, for the next 60 days
// A function's source: from its first line to the point where its braces balance
const fnSrc = name => {
  const i = game.search(new RegExp('^function ' + name + '\\(', 'm'));
  if (i < 0) throw new Error('missing ' + name);
  let depth = 0, seen = false;
  for (let j = i; j < game.length; j++) {
    const c = game[j];
    if (c === '{') { depth++; seen = true; } else if (c === '}') { depth--; if (seen && depth === 0) return game.slice(i, j + 1) + '\n'; }
  }
  throw new Error('unbalanced ' + name);
};
const phone = vm.runInNewContext(`const L=en,LANG='en',norm=w=>w.toLowerCase();${fnSrc('hash')}${fnSrc('rng')}${fnSrc('cycle')}${fnSrc('dailyWords')}${fnSrc('dailyDrawWord')};({dailyWords,dailyDrawWord})`, { en });
const kindleScript = out.match(/<script>([\s\S]*)<\/script>/)[1].replace(/loadDaily\(\);\s*render\(\);\s*$/, '');
const kindle = vm.runInNewContext(kindleScript + ';({dailyWords,dailyDrawWord,points,hash})', { window: {}, document: {}, Math, Date, JSON });
const start = Math.round((new Date() - new Date(2026, 9, 15)) / 864e5);
for (let d = 0; d < start + 60; d++) {
  const p = phone.dailyWords(d).join(','), k = kindle.dailyWords(d).join(',');
  if (p !== k || phone.dailyDrawWord(d) !== kindle.dailyDrawWord(d)) throw new Error(`day ${d} differs: phone ${p} / kindle ${k}`);
}
const missing = Object.values(pool).flat().filter(w => !catOf[w]);
console.log(`kindle.html ${(out.length / 1024) | 0} KB, ${dict.length} guess words, daily words match the phone game for days 0-${start + 59}${missing.length ? `, ${missing.length} pool words without a category` : ''}`);
