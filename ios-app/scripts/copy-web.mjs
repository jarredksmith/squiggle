// Copies the web game (one folder up) into www/ so Capacitor can bundle it inside the iPhone app.
// The web game stays the single source of truth: edit ../src and run `node scripts/build.mjs` at the
// repo root, never edit www/ by hand. sw.js is deliberately left out: the native app has no use for it.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const out = join(here, '..', 'www');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of ['index.html', 'manifest.webmanifest']) cpSync(join(root, f), join(out, f));
cpSync(join(root, 'icons'), join(out, 'icons'), { recursive: true });
console.log('Copied the web game into', out);
