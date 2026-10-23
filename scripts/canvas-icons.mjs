// Interim Canvas app icons (until the real logo lands as its own update): a plain ink tile with a white "L", drawn as
// two rectangles in Geist's proportions so the favicon needs no font. Writes public-canvas/ (the Canvas build copies it
// over public/). Run: node scripts/canvas-icons.mjs
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const INK = '#0b0b0c', PAPER = '#f7f7f5', NIGHT = '#000000', NIGHT_TILE = '#1c1c1f', WHITE = '#ffffff';
// The "L" on a 512 grid: stem and foot of one weight, optically centred.
const L = (fill, scale = 1) => {
  const t = (v) => 256 + (v - 256) * scale;
  const [x, y, w, h, foot] = [t(192), t(136), 54 * scale, 240 * scale, 142 * scale];
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/><rect x="${x}" y="${y + h - 54 * scale}" width="${foot}" height="${54 * scale}" fill="${fill}"/>`;
};
const tile = ({ radius = 0, bg = INK, fg = WHITE, scale = 1 } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${radius}" fill="${bg}"/>${L(fg, scale)}</svg>`;

mkdirSync('public-canvas/splash', { recursive: true });
writeFileSync('public-canvas/icon.svg', tile({ radius: 112 }) + '\n');
const browser = await chromium.launch();
const page = await browser.newPage();
const png = async (svg, w, h, out) => {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${w}" height="${h}" `)}</body></html>`);
  writeFileSync(out, await page.screenshot({ type: 'png', omitBackground: true }));
};
await png(tile(), 180, 180, 'public-canvas/apple-touch-icon.png');
await png(tile({ radius: 112 }), 192, 192, 'public-canvas/icon-192.png');
await png(tile({ radius: 112 }), 512, 512, 'public-canvas/icon-512.png');
await png(tile({ scale: 0.8 }), 512, 512, 'public-canvas/icon-maskable-512.png');
// Launch screens: the tile at a quarter of the width, centred on the page colour.
for (const name of readdirSync('public/splash')) {
  const [, theme, w, h] = /^(light|dark)-(\d+)x(\d+)\.png$/.exec(name) || [];
  if (!theme) continue;
  const size = Math.round(Number(w) / 4), bg = theme === 'dark' ? NIGHT : PAPER;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/><svg x="${(w - size) / 2}" y="${(h - size) / 2}" width="${size}" height="${size}" viewBox="0 0 512 512">${tile({ radius: 112, bg: theme === 'dark' ? NIGHT_TILE : INK }).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg></svg>`;
  await png(svg, Number(w), Number(h), `public-canvas/splash/${name}`);
}
await browser.close();
const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
writeFileSync('public-canvas/manifest.webmanifest', JSON.stringify({ ...manifest, background_color: NIGHT, theme_color: INK }, null, 2) + '\n');
console.log('wrote public-canvas/');
