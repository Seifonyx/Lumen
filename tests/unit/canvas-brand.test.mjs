// The Lumen identity (Crease, approved 2026-10-23) ships with the Canvas presentation: its components come only
// through the Canvas "on" module (the ordinary rollback build imports no artwork), its public files are the
// generator's output, brand placements carry an accessible name, and no preview machinery is left behind.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

test('brand components come only through the Canvas "on" module', () => {
  const off = readFileSync('src/lib/canvas-presentation.ts', 'utf8');
  assert.match(off, /^export const BrandWordmark: ComponentType<BrandArtProps> \| null = null;$/m);
  assert.match(off, /^export const BrandMark: ComponentType<BrandArtProps> \| null = null;$/m);
  const on = readFileSync('src/lib/canvas-presentation.on.ts', 'utf8');
  assert.match(on, /^export \{ BrandMark, BrandWordmark \} from '\.\.\/components\/BrandCrease';$/m);
  assert.match(on, /^import '\.\.\/styles\/brand-crease\.css';$/m);
  for (const dir of ['src/components', 'src/lib']) for (const name of readdirSync(dir)) {
    if (!/\.(ts|tsx)$/.test(name) || ['canvas-presentation.on.ts', 'BrandCrease.tsx'].includes(name)) continue;
    const src = readFileSync(`${dir}/${name}`, 'utf8');
    assert.ok(!/BrandCrease'|brand-crease-art'|brand-crease\.css/.test(src), `${dir}/${name} goes through the Canvas switch`);
  }
});

test('the Canvas public files are the identity generator\'s output', () => {
  const same = (a, b) => assert.ok(readFileSync(a).equals(readFileSync(b)), `${a} matches ${b}`);
  same('public-canvas/icon.svg', 'brand/crease/svg/app-icon-dark.svg');
  same('public-canvas/favicon.svg', 'brand/crease/svg/favicon.svg');
  for (const name of ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) same(`public-canvas/${name}`, `brand/crease/png/${name}`);
  for (const name of readdirSync('public/splash')) same(`public-canvas/splash/${name}`, `brand/crease/splash/${name}`);
  same('public-canvas/manifest.webmanifest', 'brand/crease/manifest.webmanifest');
  const manifest = JSON.parse(readFileSync('public-canvas/manifest.webmanifest', 'utf8'));
  for (const icon of manifest.icons) assert.ok(existsSync(`public-canvas${icon.src}`), `${icon.src} exists`);
  assert.match(readFileSync('vite.config.ts', 'utf8'), /href="\/favicon\.svg"/, 'Canvas pages point the tab icon at the small-size drawing');
});

test('no identity preview machinery is left, and the QA review shows what production ships', () => {
  for (const file of ['src/lib/brand-identity.ts', 'src/lib/brand-identity.on.ts', 'qa/iphone/adapters/brand-identity.ts', 'qa/iphone/review-identity.json', 'scripts/canvas-icons.mjs']) assert.ok(!existsSync(file), `${file} is retired`);
  for (const file of ['vite.config.ts', 'vite.qa.config.ts', 'scripts/qa/build.mjs', ...readdirSync('.github/workflows').map((n) => `.github/workflows/${n}`)])
    assert.ok(!/LUMEN_(?:QA_)?IDENTITY|review-identity/.test(readFileSync(file, 'utf8')), `${file} has no preview switch`);
});

test('brand placements carry the name "Lumen" for assistive technology', () => {
  const art = readFileSync('src/components/BrandCrease.tsx', 'utf8');
  assert.match(art, /role: 'img', 'aria-label': 'Lumen'/);
  assert.match(art, /'aria-hidden': true/);
  // The decorative mark appears only beside a control that is already named.
  assert.match(readFileSync('src/components/ChatView.tsx', 'utf8'), /<BrandMark height=\{20\} decorative className="cv-collapsed-mark" \/><button className="icon-btn expand-sidebar"[^>]*aria-label="Expand sidebar"/);
  for (const name of readdirSync('brand/crease/svg').filter((f) => f.startsWith('lumen-wordmark'))) {
    assert.match(readFileSync(`brand/crease/svg/${name}`, 'utf8'), /role="img" aria-label="Lumen"><title>Lumen<\/title>/, name);
  }
});
