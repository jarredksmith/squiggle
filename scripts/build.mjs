// Builds the game from src/ into two files:
//   index.html      the standalone web page (GitHub Pages, and bundled into the iPhone app)
//   dist/artifact.html   the same game without <html>/<head>/<body>, for pasting into a Claude artifact
//
//   node scripts/build.mjs
//
// src/squiggle.template.html is the source. Text between <!--STANDALONE--> and <!--/STANDALONE--> only
// goes into index.html; text between <!--ARTIFACT--> and <!--/ARTIFACT--> only goes into the artifact.
// __VALID__ is replaced with the guess dictionary from src/words.txt (one word per line).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tpl = readFileSync(join(root, 'src', 'squiggle.template.html'), 'utf8');
const words = readFileSync(join(root, 'src', 'words.txt'), 'utf8').split(/\r?\n/).filter(w => /^[a-z]{3,10}$/.test(w));
const es = readFileSync(join(root, 'src', 'words-es.txt'), 'utf8').split(/\r?\n/).filter(w => w && !/["\\|]/.test(w));
const pt = readFileSync(join(root, 'src', 'words-pt.txt'), 'utf8').split(/\r?\n/).filter(w => w && !/["\\|]/.test(w));
for (const tag of ['__VALID__', '__VALID_ES__', '__VALID_PT__']) if (tpl.split(tag).length !== 2) throw new Error(`template must contain ${tag} exactly once`);
const withWords = tpl.replace('__VALID__', words.join('|')).replace('__VALID_ES__', es.join('|')).replace('__VALID_PT__', pt.join('|'));

const strip = (s, tag) => s.replace(new RegExp(`<!--${tag}-->[\\s\\S]*?<!--/${tag}-->`, 'g'), '');
const unwrap = (s, tag) => s.replace(new RegExp(`<!--/?${tag}-->`, 'g'), '');

const standalone = unwrap(strip(withWords, 'ARTIFACT'), 'STANDALONE');
const artifact = unwrap(strip(withWords, 'STANDALONE'), 'ARTIFACT').replace(/^\s+/, '');

writeFileSync(join(root, 'index.html'), standalone);
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'artifact.html'), artifact);
console.log(`index.html ${(standalone.length / 1024) | 0} KB, dist/artifact.html ${(artifact.length / 1024) | 0} KB, dictionaries en ${words.length} / es ${es.length} / pt ${pt.length}`);
