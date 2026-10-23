// Checks the word data in src/squiggle.template.html: every pack word has exactly one tag, every word a daily
// round can serve has a category for the Category hint, and nothing has stray characters. Run: node scripts/check-data.mjs
import fs from 'node:fs';
const s = fs.readFileSync(new URL('../src/squiggle.template.html', import.meta.url), 'utf8');
const ABOUT = JSON.parse(s.match(/\/\*ABOUT\*\/([\s\S]*?)\/\*\/ABOUT\*\//)[1]);
const grab = (re) => { const m = s.match(re); if (!m) throw new Error('could not find ' + re); return m[1]; };
const PACKS = eval('[' + grab(/const PACKS=\[([\s\S]*?)\];\n/) + ']');
const CATS = eval('(' + grab(/const CATS=(\{[^\n]*\});\n/) + ')');
const LANGS = new Function(grab(/(const LANGS=\{[\s\S]*?\n\};)\n/).replace(/dict:"__VALID_[A-Z]+__"/g, 'dict:""') + ';return LANGS;')();
const flat = (v) => Array.isArray(v) ? v.flatMap(flat) : typeof v === 'string' ? v.split(/\s+/).filter(Boolean) : [];
let bad = 0;
const nf = (lang, w) => { let o = ''; for (const ch of w.toLowerCase()) { if (lang === 'es' && ch === 'ñ') { o += 'ñ'; continue; } o += ch.normalize('NFD').replace(/[̀-ͯ]/g, ''); } return o; };
for (const pk of PACKS) {
  const seen = new Map();
  for (const [tag, ws] of Object.entries(pk.tags || {})) for (const w of ws.split(' ')) { if (seen.has(w)) { console.log(pk.id, 'tagged twice:', w); bad++; } seen.set(w, tag); if (!pk.words.includes(w)) { console.log(pk.id, 'tag for a word not in the pack:', w); bad++; } }
  const untagged = pk.words.filter((w) => !seen.has(w)); if (untagged.length) { console.log(pk.id, 'untagged:', untagged.join(' ')); bad++; }
  const odd = pk.words.filter((w) => !/^[a-z]{4,10}$/.test(w)); if (odd.length) { console.log(pk.id, 'bad words:', odd.join(' ')); bad++; }
  const dup = pk.words.filter((w, i) => pk.words.indexOf(w) !== i); if (dup.length) { console.log(pk.id, 'duplicates:', [...new Set(dup)].join(' ')); bad++; }
  { const A = ABOUT[pk.id] || {}; const noAbout = [...pk.words, ...pk.phrases].filter((w) => !A[w]); if (noAbout.length) { console.log(pk.id, 'no overview:', noAbout.join(', ')); bad++; } }
  const tiers = { s: 0, m: 0, l: 0 }; pk.words.forEach((w) => tiers[w.length <= 5 ? 's' : w.length <= 7 ? 'm' : 'l']++);
  console.log(`${pk.id}: ${pk.words.length} words (${tiers.s} short, ${tiers.m} middle, ${tiers.l} long), ${pk.phrases.length} titles, ${Object.keys(pk.tags).length} tags`);
}
for (const [lang, L] of Object.entries(LANGS)) {
  const words = new Set([...flat(Object.values(L.pool)), ...flat(L.week || []), ...flat(L.drawWeek || []), ...(L.tutorial || []).map((t) => t.word)].map((w) => nf(lang, w)));
  const cat = new Map();
  for (const [c, ws] of Object.entries(CATS[lang] || {})) for (const w of ws.split(' ')) { const n = nf(lang, w); if (cat.has(n)) { console.log(lang, 'categorised twice:', w); bad++; } cat.set(n, c); if (!words.has(n)) { console.log(lang, 'category for a word no round serves:', w); bad++; } }
  const missing = [...words].filter((w) => !cat.has(w)); if (missing.length) { console.log(lang, 'no category:', missing.join(' ')); bad++; }
  console.log(`${lang}: ${words.size} daily words, ${cat.size} categorised`);
}
console.log(bad ? `PROBLEMS: ${bad}` : 'all good');
process.exit(bad ? 1 : 0);
