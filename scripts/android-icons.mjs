// Draws the Android launcher icons and splash images from brand/icon.svg and brand/splash-2732.png.
// Run from the repo root: node scripts/android-icons.mjs (needs `sharp`, which is not a repo dependency:
// npm i -g sharp, or run it where sharp is installed). Output lands in ios-app/android/app/src/main/res.
import fs from 'node:fs'; import { createRequire } from 'node:module';
const req = createRequire(import.meta.url); let sharp; try { sharp = req('sharp'); } catch { sharp = createRequire('/home/claude/')('sharp'); }
const RES = 'ios-app/android/app/src/main/res/';
const svg = fs.readFileSync('brand/icon.svg', 'utf8');
const NAVY = (svg.match(/<rect[^>]*fill="(#[0-9A-Fa-f]{6})"/) || [])[1] || '#0F2749';
const glyph = (scale, mono) => {
  let s = svg.replace(/<rect[^>]*\/>/, '');
  s = s.replace(/<g transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)">/, (m, a, b, c) => `<g transform="translate(512 512) scale(${scale}) translate(-512 -512) translate(${a} ${b}) scale(${c})">`);
  if (mono) s = s.replace(/fill="#(?!0F2749)[0-9A-Fa-f]{6}"/g, 'fill="#FFFFFF"');
  return Buffer.from(s);
};
const D = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
// Adaptive icon layers are 108dp with a 66dp safe circle; the glyph (dot included) is scaled to sit inside it.
for (const [d, k] of Object.entries(D)) {
  const dir = RES + 'mipmap-' + d + '/'; fs.mkdirSync(dir, { recursive: true });
  const fg = Math.round(108 * k), legacy = Math.round(48 * k);
  await sharp(glyph(0.62)).resize(fg, fg).png().toFile(dir + 'ic_launcher_foreground.png');
  await sharp(glyph(0.62, true)).resize(fg, fg).png().toFile(dir + 'ic_launcher_monochrome.png');
  await sharp(Buffer.from(svg)).resize(legacy, legacy).png().toFile(dir + 'ic_launcher.png');
  const r = legacy / 2, circle = Buffer.from(`<svg width="${legacy}" height="${legacy}"><circle cx="${r}" cy="${r}" r="${r}"/></svg>`);
  await sharp(Buffer.from(svg)).resize(legacy, legacy).composite([{ input: circle, blend: 'dest-in' }]).png().toFile(dir + 'ic_launcher_round.png');
}
// Pre-Android-12 splash: the brand splash, centre-cropped to each bucket. Android 12+ uses the icon on navy (styles.xml).
const SP = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
for (const [d, [w, h]] of Object.entries(SP)) {
  for (const [o, W, H] of [['port', w, h], ['land', h, w]]) {
    const dir = RES + `drawable-${o}-${d}/`; fs.mkdirSync(dir, { recursive: true });
    await sharp('brand/splash-2732.png').resize(W, H, { fit: 'cover' }).png().toFile(dir + 'splash.png');
  }
}
await sharp('brand/splash-2732.png').resize(480, 800, { fit: 'cover' }).png().toFile(RES + 'drawable/splash.png');
fs.writeFileSync(RES + 'values/ic_launcher_background.xml', `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${NAVY}</color>\n</resources>\n`);
console.log('Android icons and splash written, background', NAVY);
