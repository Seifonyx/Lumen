// Canvas app icons: the official Lumen mark (an "L" folded out of light, chosen by the owner on 2026-10-23), redrawn
// as vector shapes so every size stays sharp, on a near-black tile. Writes public-canvas/ (the Canvas build copies it
// over public/). Run: node scripts/canvas-icons.mjs
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const INK = '#0b0b0c', PAPER = '#f7f7f5', NIGHT = '#000000';
// The mark on its own 450x540 drawing grid: a standing panel, its foot, and warm light where they meet (a bright silhouette so it holds at 16 px).
const mark = (id) => `
<defs>
 <linearGradient id="${id}p" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#cfcbc4"/><stop offset=".5" stop-color="#ebe7df"/><stop offset="1" stop-color="#fffaf0"/></linearGradient>
 <linearGradient id="${id}e" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".1" stop-color="#fff" stop-opacity="0"/></linearGradient>
 <linearGradient id="${id}f" x1="0" y1="0" x2="1" y2=".5"><stop offset="0" stop-color="#fff8ea"/><stop offset=".45" stop-color="#d8d1c4"/><stop offset="1" stop-color="#8f8a82"/></linearGradient>
 <linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".0"/><stop offset=".4" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity=".0"/></linearGradient>
 <radialGradient id="${id}g" cx="190" cy="322" r="200" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff3d6" stop-opacity=".95"/><stop offset=".25" stop-color="#ffe3b0" stop-opacity=".38"/><stop offset=".6" stop-color="#ffd9a0" stop-opacity=".10"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient>
<filter id="${id}b" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="16"/></filter>
</defs>
<circle cx="190" cy="322" r="200" fill="url(#${id}g)" style="mix-blend-mode:screen"/>
<g stroke-linejoin="round" stroke-width="22">
 <path d="M48,410 L190,320 L410,425 L270,515 Z" fill="url(#${id}f)" stroke="url(#${id}f)"/>
 <path d="M45,135 L185,45 L190,320 L48,410 Z" fill="url(#${id}p)" stroke="url(#${id}p)"/>
 <path d="M45,135 L185,45 L190,320 L48,410 Z" fill="url(#${id}e)" stroke="none"/>
</g>
<path d="M48,410 L190,320 L410,425" fill="none" stroke="#fffdf6" stroke-opacity=".55" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" transform="translate(0 -8)"/>
<ellipse cx="192" cy="322" rx="62" ry="34" fill="#fff6e4" opacity=".85" filter="url(#${id}b)"/>`;
// The mark centred on the 512 icon grid; `scale` shrinks it for the maskable icon's safe zone.
const glyph = (id, scale = 1) => { const s = 0.86 * scale; return `<g transform="translate(${256 - 227.5 * s} ${256 - 280 * s + 4}) scale(${s})">${mark(id)}</g>`; };
const tile = ({ radius = 0, scale = 1, id = 'm' } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><radialGradient id="${id}t" cx=".5" cy=".38" r=".85"><stop offset="0" stop-color="#232325"/><stop offset="1" stop-color="#070708"/></radialGradient><clipPath id="${id}c"><rect width="512" height="512" rx="${radius}"/></clipPath></defs><rect width="512" height="512" rx="${radius}" fill="url(#${id}t)"/><g clip-path="url(#${id}c)">${glyph(id, scale)}</g></svg>`;

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
