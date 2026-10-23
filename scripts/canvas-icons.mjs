// Canvas app icons: the official Lumen mark (an "L" folded out of light, chosen by the owner on 2026-10-23), redrawn
// as vector shapes so every size stays sharp, on a near-black tile. Writes public-canvas/ (the Canvas build copies it
// over public/). Run: node scripts/canvas-icons.mjs
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const INK = '#0b0b0c', PAPER = '#f7f7f5', NIGHT = '#000000';
// The mark on its own 450x540 drawing grid: a standing panel, its foot, and warm light where they meet.
const mark = (id) => `
<defs>
 <linearGradient id="${id}p" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#b4b1ad"/><stop offset=".55" stop-color="#d3cfc9"/><stop offset="1" stop-color="#fbf5ea"/></linearGradient>
 <linearGradient id="${id}e" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".4"/><stop offset=".12" stop-color="#fff" stop-opacity="0"/></linearGradient>
 <linearGradient id="${id}f" x1="0" y1="0" x2="1" y2=".55"><stop offset="0" stop-color="#fbf3e4"/><stop offset=".38" stop-color="#d9d2c6"/><stop offset=".7" stop-color="#7a7671"/><stop offset="1" stop-color="#3b3936"/></linearGradient>
 <radialGradient id="${id}g" cx="190" cy="322" r="105" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff6e6" stop-opacity=".8"/><stop offset=".35" stop-color="#ffe9c7" stop-opacity=".22"/><stop offset="1" stop-color="#ffe9c7" stop-opacity="0"/></radialGradient>
 <filter id="${id}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
</defs>
<g stroke-linejoin="round" stroke-width="22">
 <path d="M48,410 L190,320 L410,425 L270,515 Z" fill="url(#${id}f)" stroke="url(#${id}f)"/>
 <path d="M45,135 L185,45 L190,320 L48,410 Z" fill="url(#${id}p)" stroke="url(#${id}p)"/>
 <path d="M45,135 L185,45 L190,320 L48,410 Z" fill="url(#${id}e)" stroke="none"/>
</g>
<path d="M190,320 L235,342 L248,500 L205,486 Z" fill="#fff" opacity=".18" filter="url(#${id}b)"/>
<ellipse cx="190" cy="330" rx="70" ry="40" fill="#fff3dd" opacity=".55" filter="url(#${id}b)"/>
<rect x="-40" y="-40" width="530" height="620" fill="url(#${id}g)" style="mix-blend-mode:screen"/>`;
// The mark centred on the 512 icon grid; `scale` shrinks it for the maskable icon's safe zone.
const glyph = (id, scale = 1) => { const s = 0.7 * scale; return `<g transform="translate(${256 - 227.5 * s} ${256 - 280 * s}) scale(${s})">${mark(id)}</g>`; };
const tile = ({ radius = 0, scale = 1, id = 'm' } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><radialGradient id="${id}t" cx=".45" cy=".5" r=".75"><stop offset="0" stop-color="#1b1b1b"/><stop offset="1" stop-color="#060606"/></radialGradient></defs><rect width="512" height="512" rx="${radius}" fill="url(#${id}t)"/>${glyph(id, scale)}</svg>`;

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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/><svg x="${(w - size) / 2}" y="${(h - size) / 2}" width="${size}" height="${size}" viewBox="0 0 512 512">${tile({ radius: 112 }).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg></svg>`;
  await png(svg, Number(w), Number(h), `public-canvas/splash/${name}`);
}
await browser.close();
const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
writeFileSync('public-canvas/manifest.webmanifest', JSON.stringify({ ...manifest, background_color: NIGHT, theme_color: INK }, null, 2) + '\n');
console.log('wrote public-canvas/');
