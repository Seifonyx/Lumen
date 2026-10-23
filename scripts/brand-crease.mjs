// Lumen's identity, "Crease" (approved by the owner 2026-10-23): writes the masters and app assets to brand/crease/,
// the Canvas build's public files to public-canvas/ (icons, favicon, manifest, launch screens; they replaced the
// folded-L, whose generator is in git history) and src/lib/brand-crease-art.ts (the drawings for the app's brand
// components). Every file is drawn from the numbers below, so changing a number and re-running rebuilds all.
// Run from the repository root: node scripts/brand-crease.mjs
// The wordmark outlines come from brand/crease/source/geist-600.json and geist-660.json (scripts/brand-crease-glyphs.py).
import { chromium } from 'playwright';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = 'brand/crease';
// Colour: ink and paper match Canvas; the warm light lives only in the mark.
export const INK = '#0b0b0c', PAPER = '#f5f4f0', LIT = '#f4f1e8', SHADE = '#b9b3a7', INK_SHADE = '#5b5852', NIGHT = '#000000', DAY = '#f6f7f9';

// ---------- The mark: a sheet of light folded into a standing page and a floor. The gap between the two planes is
// the crease, the opening ("lumen") the light comes through. Axonometric drawing on its own grid:
//   W panel width, D floor depth, H panel height, S slope of both receding edges, G crease gap, R corner radius.
const MARK = { W: 132, D: 168, H: 236, S: 0.54, G: 22, R: 10 };
// Small sizes (favicon, 16-32 px) widen the crease and soften fewer corners, so it survives the pixel grid.
const SMALL = { ...MARK, G: 40, R: 6 };

const fmt = (n) => String(+n.toFixed(2));
/** Polygon with rounded corners (quadratic joins), as one closed path. */
function rounded(points, r) {
  const unit = ([x, y]) => { const l = Math.hypot(x, y); return [x / l, y / l]; };
  return points.map((p, i) => {
    const a = points[(i + points.length - 1) % points.length], b = points[(i + 1) % points.length];
    const ua = unit([a[0] - p[0], a[1] - p[1]]), ub = unit([b[0] - p[0], b[1] - p[1]]);
    const p1 = [p[0] + ua[0] * r, p[1] + ua[1] * r], p2 = [p[0] + ub[0] * r, p[1] + ub[1] * r];
    return `${i ? 'L' : 'M'}${fmt(p1[0])} ${fmt(p1[1])}Q${fmt(p[0])} ${fmt(p[1])} ${fmt(p2[0])} ${fmt(p2[1])}`;
  }).join('') + 'Z';
}
/** The two planes, translated so the drawing's box starts at 0,0. */
export function crease({ W, D, H, S, G, R } = MARK) {
  const panel = [[0, 0], [0, -H], [W, -H - W * S], [W, -W * S]];
  const floor = [[0, G], [W, G - W * S], [W + D, G - W * S + D * S], [D, G + D * S]];
  const xs = [...panel, ...floor].map((p) => p[0]), ys = [...panel, ...floor].map((p) => p[1]);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  const move = (ps) => ps.map(([x, y]) => [x - x0, y - y0]);
  // The crease's centre: where the light comes from (used by the colour icon's glow).
  const light = [W / 2 - x0, G / 2 - (W * S) / 2 - y0];
  return { panel: rounded(move(panel), R), floor: rounded(move(floor), R), width: Math.max(...xs) - x0, height: Math.max(...ys) - y0, light };
}

// ---------- Wordmark: "lumen" in Geist 600, tightened; the l's top is cut at the mark's plane angle, so the first
// letter is a small standing panel with Geist's own foot.
const GEIST = JSON.parse(readFileSync(`${OUT}/source/geist-600.json`, 'utf8'));
const TRACK = -30, ASC = 710, BASE_OVERSHOOT = 12;
function letterL(s = MARK.S) {
  const { d } = GEIST.glyphs.l;
  const left = 70.4, right = 198.4; // stem edges in Geist 600
  return d.replace(`V710H${right}`, `V${fmt(ASC - (right - left) * s)}L${right} ${ASC}`);
}
export function wordmark() {
  let x = 0; const paths = [];
  for (const ch of 'lumen') {
    paths.push(`<path transform="translate(${fmt(x)} 0)" d="${ch === 'l' ? letterL() : GEIST.glyphs[ch].d}"/>`);
    x += GEIST.glyphs[ch].advance + TRACK;
  }
  // The advance box: the l's left bearing stays as optical space before the word.
  return { body: `<g transform="translate(0 ${ASC}) scale(1 -1)">${paths.join('')}</g>`, width: x - TRACK, height: ASC + BASE_OVERSHOOT };
}

// ---------- SVG builders
const svg = (vb, body, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${extra}>${body}</svg>\n`;
const markBody = (m, panel, floor) => `<path d="${m.panel}" fill="${panel}"/><path d="${m.floor}" fill="${floor}"/>`;
/** Mark on a square tile. `fill` is the share of the tile the mark's height takes. */
function tile({ bg, panel, floor, radius = 0, fill = 0.62, glow = false, geometry = MARK, id = 'c' }) {
  const m = crease(geometry), k = (512 * fill) / m.height;
  // Optical centre: the floor's long point pulls the eye right and down, so sit a little left of and above centre.
  const tx = 256 - (m.width * k) / 2 - 6, ty = 256 - (m.height * k) / 2 - 4;
  const lx = tx + m.light[0] * k, ly = ty + m.light[1] * k;
  const halo = glow ? `<radialGradient id="${id}g" cx="${fmt(lx)}" cy="${fmt(ly)}" r="190" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff1d2" stop-opacity=".30"/><stop offset=".45" stop-color="#ffe2ad" stop-opacity=".07"/><stop offset="1" stop-color="#ffe2ad" stop-opacity="0"/></radialGradient>` : '';
  return svg('0 0 512 512',
    `<defs>${halo}</defs><rect width="512" height="512" rx="${radius}" fill="${bg}"/>` +
    (glow ? `<rect width="512" height="512" rx="${radius}" fill="url(#${id}g)"/>` : '') +
    `<g transform="translate(${fmt(tx)} ${fmt(ty)}) scale(${fmt(k)})">${markBody(m, panel, floor)}</g>`);
}
/** Horizontal lockup: mark, then the wordmark; the mark is a little taller than the l and sits on the baseline. */
function lockup(panel, floor, text) {
  const m = crease(), w = wordmark();
  const k = (ASC * 1.22) / m.height, gap = 150;
  const mw = m.width * k, top = ASC - m.height * k + 118; // floor tip falls just below the baseline
  const shift = mw + gap;
  const minY = Math.min(top, 0), maxY = Math.max(top + m.height * k, w.height);
  return svg(`0 ${fmt(minY)} ${fmt(shift + w.width)} ${fmt(maxY - minY)}`,
    `<g transform="translate(0 ${fmt(top)}) scale(${fmt(k)})">${markBody(m, panel, floor)}</g><g transform="translate(${fmt(shift)} 0)" fill="${text}">${w.body}</g>`);
}
/** Phase 1B lockup (recommended): the unchanged mark stands on the word's baseline (floor tip on it, with a small
 * overshoot), 1.1x the l's height, and sits closer to the word (0.42 of the mark's width). */
const BASELINE = { height: 1.1, gap: 0.42, overshoot: 10 };
function lockupBaseline(panel, floor, text, { height, gap, overshoot } = BASELINE) {
  const m = crease(), w = wordmark();
  const k = (ASC * height) / m.height, top = ASC - m.height * k + overshoot, shift = m.width * k * (1 + gap);
  const minY = Math.min(top, 0), maxY = Math.max(ASC + overshoot, w.height);
  return svg(`0 ${fmt(minY)} ${fmt(shift + w.width)} ${fmt(maxY - minY)}`,
    `<title>Lumen</title><g transform="translate(0 ${fmt(top)}) scale(${fmt(k)})">${markBody(m, panel, floor)}</g><g transform="translate(${fmt(shift)} 0)" fill="${text}">${w.body}</g>`,
    ' role="img" aria-label="Lumen"');
}

// ---------- Phase 1C, the owner's chosen direction: the Crease IS the L of "Lumen".
// A wordmark-only optical variant of the mark (the standalone master above is unchanged). Same idea and depth angle:
// a standing screen with its top cut at S, a crease, and a base projecting down and to the right at the icon's
// slope. Three things change so it sits in type:
//   - the hinge and the base's front edge flatten (HINGE), so the base lies along the baseline instead of standing
//     on a point: no hole at the baseline, and the u can come close;
//   - the crease sits higher (a deeper base), so the screen is shorter and broader, as in the icon, and the whole
//     letter is cap height (top-right corner just over it) instead of towering over the word;
//   - the screen is 1.35x a stem of the letters, and the letters are Geist 660, so the weights meet.
// The letters are Geist 660 "umen", tightened, with every stem that starts at the x-height (u twice, m, n) cut at
// the hinge angle: the same cut as the screen's crease, carried through the word.
// Font units, y-up, baseline 0. W screen width, HINGE hinge/front-edge slope, S top cut, DX/SD base projection,
// G crease, TOP top-right corner, DIP how far the base's front point goes below the baseline, R corners.
const WORD = { W: 176, HINGE: 0.36, S: MARK.S, DX: 330, SD: 0.62, G: 34, TOP: 722, DIP: 8, R: 8, GAP: 56, TRACK: -28 };
// Below 28 px tall: a wider crease and looser letters, so the opening and the letters stay apart on the pixel grid.
const WORD_SMALL = { ...WORD, G: 60, R: 5, GAP: 72, TRACK: -10 };
const UMEN = JSON.parse(readFileSync(`${OUT}/source/geist-660.json`, 'utf8'));
/** The wordmark's L: screen and base as two rounded polygons (y-up). */
function creaseL({ W, HINGE, S, DX, SD, G, TOP, DIP, R }) {
  const back = [0, DX * SD - DIP];                                       // base, back-left (under the screen)
  const base = [back, [W, back[1] + W * HINGE], [W + DX, -DIP + W * HINGE], [DX, -DIP]];
  const bottom = back[1] + G;                                            // screen, bottom-left
  const screen = [[0, bottom], [W, bottom + W * HINGE], [W, TOP], [0, TOP - W * S]];
  return { screen: rounded(screen, R), base: rounded(base, R), right: W + DX };
}
/** Cuts the flat stem tops at the x-height at slope s (rising right). Paths are absolute M/L/H/V/Q/Z. */
function cutStems(d, s, xh = UMEN.xHeight) {
  const cmds = [...d.matchAll(/([MLHVQZ])([^MLHVQZ]*)/g)].map((m) => [m[1], m[2].trim() ? m[2].trim().split(/[ ,]+/).map(Number) : []]);
  let x = 0; const out = [];
  for (let i = 0; i < cmds.length; i++) {
    const [c, a] = cmds[i], next = cmds[i + 1];
    // "up to the x-height, then right along it": the left corner drops, a line climbs to the right corner.
    if (c === 'V' && Math.abs(a[0] - xh) < 2 && next?.[0] === 'H' && next[1][0] > x) {
      out.push(`V${fmt(a[0] - (next[1][0] - x) * s)}L${next[1][0]} ${a[0]}`); x = next[1][0]; i++; continue;
    }
    out.push(c + a.join(' '));
    if (c === 'M' || c === 'L') x = a[0]; else if (c === 'H') x = a[0]; else if (c === 'Q') x = a[2];
  }
  return out.join('');
}
/** The integrated wordmark: Crease-L + "umen". Returns y-down body (baseline at TOP), width and height. */
export function lumenWordmark(o = WORD) {
  const L = creaseL(o);
  let x = L.right + o.GAP - 70; const paths = [`<path d="${L.screen}"/>`, `<path d="${L.base}"/>`];
  for (const ch of 'umen') {
    const g = UMEN.glyphs[ch];
    paths.push(`<path transform="translate(${fmt(x)} 0)" d="${ch === 'e' ? g.d : cutStems(g.d, o.HINGE)}"/>`);
    x += g.advance + o.TRACK;
  }
  return { body: `<g transform="translate(0 ${o.TOP}) scale(1 -1)">${paths.join('')}</g>`, width: x - o.TRACK, height: o.TOP + 12, baseline: o.TOP };
}

// ---------- Write
for (const dir of ['svg', 'png', 'splash']) mkdirSync(`${OUT}/${dir}`, { recursive: true });
const files = {};
const put = (name, body) => { files[name] = body; writeFileSync(`${OUT}/svg/${name}`, body); };
const m = crease();
const vb = `0 0 ${fmt(m.width)} ${fmt(m.height)}`;
put('mark.svg', svg(vb, markBody(m, LIT, SHADE)));                       // colour, for dark grounds
put('mark-on-light.svg', svg(vb, markBody(m, INK, INK_SHADE)));          // colour, for light grounds
put('mark-mono.svg', svg(vb, `<g fill="currentColor">${markBody(m, 'currentColor', 'currentColor')}</g>`)); // one colour, inherits
put('mark-black.svg', svg(vb, markBody(m, '#000', '#000')));
put('mark-white.svg', svg(vb, markBody(m, '#fff', '#fff')));
const w = wordmark();
const wvb = `0 0 ${fmt(w.width)} ${fmt(w.height)}`;
put('wordmark-ink.svg', svg(wvb, `<g fill="${INK}">${w.body}</g>`));
put('wordmark-paper.svg', svg(wvb, `<g fill="${PAPER}">${w.body}</g>`));
put('wordmark-mono.svg', svg(wvb, `<g fill="currentColor">${w.body}</g>`));
put('lockup-on-light.svg', lockup(INK, INK_SHADE, INK));
put('lockup-on-dark.svg', lockup(LIT, SHADE, PAPER));
put('lockup-mono.svg', lockup('currentColor', 'currentColor', 'currentColor'));
put('lockup-baseline-on-light.svg', lockupBaseline(INK, INK_SHADE, INK));
put('lockup-baseline-on-dark.svg', lockupBaseline(LIT, SHADE, PAPER));
put('lockup-baseline-mono.svg', lockupBaseline('currentColor', 'currentColor', 'currentColor'));
put('app-icon-dark.svg', tile({ bg: INK, panel: LIT, floor: SHADE, radius: 114, glow: true }));
put('app-icon-light.svg', tile({ bg: PAPER, panel: INK, floor: INK_SHADE, radius: 114 }));
put('app-icon-mono.svg', tile({ bg: '#000', panel: '#fff', floor: '#fff', radius: 114 }));
put('app-icon-mono-light.svg', tile({ bg: '#fff', panel: '#000', floor: '#000', radius: 114 }));
put('favicon.svg', tile({ bg: INK, panel: LIT, floor: SHADE, radius: 112, fill: 0.7, geometry: SMALL }));
// Phase 1C: the integrated wordmark (one colour; the letters and both planes share it), regular and small.
for (const [suffix, o] of [['', WORD], ['-small', WORD_SMALL]]) {
  const lw = lumenWordmark(o), vbw = `0 0 ${fmt(lw.width)} ${fmt(lw.height)}`, a11y = ' role="img" aria-label="Lumen"';
  put(`lumen-wordmark${suffix}-ink.svg`, svg(vbw, `<title>Lumen</title><g fill="${INK}">${lw.body}</g>`, a11y));
  put(`lumen-wordmark${suffix}-paper.svg`, svg(vbw, `<title>Lumen</title><g fill="${PAPER}">${lw.body}</g>`, a11y));
  put(`lumen-wordmark${suffix}-mono.svg`, svg(vbw, `<title>Lumen</title><g fill="currentColor">${lw.body}</g>`, a11y));
}
// The colour icon on dark grounds inside the product (sign-in in Dark): a hairline rim keeps the tile's edge.
put('app-icon-dark-rim.svg', tile({ bg: INK, panel: LIT, floor: SHADE, radius: 114, glow: true }).replace('</svg>', '<rect x=".75" y=".75" width="510.5" height="510.5" rx="113.25" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1.5"/></svg>'));
// The app's brand components read their drawings from one generated module (no network, no runtime font).
{
  const lw = lumenWordmark(WORD), ls = lumenWordmark(WORD_SMALL), sm = crease(SMALL);
  // Plain literals (no spreads or calls), so a build with the preview off drops the module entirely.
  const drawing = (viewBox, body) => body.replace(/^<g transform="([^"]+)">([\s\S]*)<\/g>$/, (_, t, p) => JSON.stringify({ viewBox, transform: t, d: [...p.matchAll(/<path(?: transform="([^"]+)")? d="([^"]+)"\/>/g)].map((m) => [m[1] || '', m[2]]) }));
  writeFileSync('src/lib/brand-crease-art.ts', `// GENERATED by scripts/brand-crease.mjs: the Lumen identity's (Crease) drawings for the Canvas brand components.\n// Do not edit by hand; change the numbers in the script and re-run it.\nexport type Drawing = { viewBox: string; transform: string; d: [transform: string, d: string][] };\n` +
    `export const WORDMARK: Drawing = ${drawing(`0 0 ${fmt(lw.width)} ${fmt(lw.height)}`, lw.body)};\n` +
    `export const WORDMARK_SMALL: Drawing = ${drawing(`0 0 ${fmt(ls.width)} ${fmt(ls.height)}`, ls.body)};\n` +
    `export const MARK: Drawing = ${JSON.stringify({ viewBox: `0 0 ${fmt(sm.width)} ${fmt(sm.height)}`, transform: '', d: [['', sm.panel], ['', sm.floor]] })};\n`);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const png = async (body, w, h, out) => {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0">${body.replace('<svg ', `<svg width="${w}" height="${h}" `)}</body></html>`);
  writeFileSync(out, await page.screenshot({ type: 'png', omitBackground: true }));
};
const dark = (o = {}) => tile({ bg: INK, panel: LIT, floor: SHADE, glow: true, ...o });
await png(dark(), 180, 180, `${OUT}/png/apple-touch-icon.png`);           // iOS masks the corners itself
await png(dark({ radius: 112 }), 192, 192, `${OUT}/png/icon-192.png`);
await png(dark({ radius: 112 }), 512, 512, `${OUT}/png/icon-512.png`);
await png(dark({ fill: 0.48 }), 512, 512, `${OUT}/png/icon-maskable-512.png`); // inside the 80% safe zone
await png(dark({ radius: 112, fill: 0.7, geometry: SMALL, glow: false }), 32, 32, `${OUT}/png/favicon-32.png`);
await png(dark({ radius: 112, fill: 0.72, geometry: SMALL, glow: false }), 16, 16, `${OUT}/png/favicon-16.png`);
// Launch screens: the bare mark (no tile) on the page colour, a quarter of the screen wide.
for (const name of readdirSync('public/splash')) {
  const [, theme, w, h] = /^(light|dark)-(\d+)x(\d+)\.png$/.exec(name) || [];
  if (!theme) continue;
  const W = Number(w), Hh = Number(h), size = W * 0.25, k = size / m.width;
  const [bg, panel, floor] = theme === 'dark' ? [NIGHT, LIT, SHADE] : [DAY, INK, INK_SHADE];
  const body = svg(`0 0 ${W} ${Hh}`, `<rect width="${W}" height="${Hh}" fill="${bg}"/><g transform="translate(${fmt((W - size) / 2)} ${fmt((Hh - m.height * k) / 2)}) scale(${fmt(k)})">${markBody(m, panel, floor)}</g>`);
  await png(body, W, Hh, `${OUT}/splash/${name}`);
}
await browser.close();
const manifest = JSON.parse(readFileSync('public-canvas/manifest.webmanifest', 'utf8'));
writeFileSync(`${OUT}/manifest.webmanifest`, JSON.stringify({ ...manifest, background_color: NIGHT, theme_color: INK }, null, 2) + '\n');
// The Canvas build's public files (vite.config.ts copies public-canvas/ over public/).
const PUBLIC = 'public-canvas';
mkdirSync(`${PUBLIC}/splash`, { recursive: true });
copyFileSync(`${OUT}/svg/app-icon-dark.svg`, `${PUBLIC}/icon.svg`);
copyFileSync(`${OUT}/svg/favicon.svg`, `${PUBLIC}/favicon.svg`);
for (const name of ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) copyFileSync(`${OUT}/png/${name}`, `${PUBLIC}/${name}`);
for (const name of readdirSync(`${OUT}/splash`)) copyFileSync(`${OUT}/splash/${name}`, `${PUBLIC}/splash/${name}`);
copyFileSync(`${OUT}/manifest.webmanifest`, `${PUBLIC}/manifest.webmanifest`);
console.log(`wrote ${OUT}/ (${Object.keys(files).length} SVG masters, PNG icons, launch screens) and ${PUBLIC}/`);
