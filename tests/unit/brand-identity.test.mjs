// Crease identity preview guards: the proposal stays out of every build unless LUMEN_IDENTITY=crease is set together
// with LUMEN_CANVAS=1, no workflow sets it, and the brand placements keep an accessible name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

test('the preview switch is off by default and its components exist only behind the "on" module', () => {
  const off = readFileSync('src/lib/brand-identity.ts', 'utf8');
  assert.match(off, /^export const CREASE_IDENTITY = false;$/m);
  assert.match(off, /^export const BrandWordmark: ComponentType<BrandArtProps> \| null = null;$/m);
  assert.match(off, /^export const BrandMark: ComponentType<BrandArtProps> \| null = null;$/m);
  assert.ok(!/BrandCrease|brand-crease-art|\.css/.test(off.replace(/^\s*\*.*$/gm, '')), 'the off module imports nothing');
  const on = readFileSync('src/lib/brand-identity.on.ts', 'utf8');
  assert.match(on, /^export const CREASE_IDENTITY = true;$/m);
  assert.match(on, /^import '\.\.\/styles\/brand-crease\.css';$/m);
  // Only the "on" module may import the components or the drawings; placements import the switch.
  for (const dir of ['src/components', 'src/lib']) for (const name of readdirSync(dir)) {
    if (!/\.(ts|tsx)$/.test(name) || ['brand-identity.on.ts', 'BrandCrease.tsx'].includes(name)) continue;
    const src = readFileSync(`${dir}/${name}`, 'utf8');
    assert.ok(!/from '\.\/BrandCrease'|from '\.\.\/components\/BrandCrease'|brand-crease-art'/.test(src), `${dir}/${name} goes through the switch`);
    assert.ok(!/brand-crease\.css/.test(src), `${dir}/${name} loads no preview styles`);
  }
});

test('only LUMEN_IDENTITY=crease with LUMEN_CANVAS=1 builds the preview, and no workflow sets it', () => {
  const config = readFileSync('vite.config.ts', 'utf8');
  assert.match(config, /if \(!\['', 'crease'\]\.includes\(flag\)\) throw/);
  assert.match(config, /if \(process\.env\.LUMEN_CANVAS !== '1'\) throw/);
  assert.match(config, /resolve\('src\/lib\/brand-identity\.on\.ts'\)/);
  for (const name of readdirSync('.github/workflows')) assert.ok(!/LUMEN_(?:QA_)?IDENTITY/.test(readFileSync(`.github/workflows/${name}`, 'utf8')), `${name} never builds the preview`);
  // Private iPhone QA: the review shows the preview only when it opts in (qa/iphone/review-identity.json, read by
  // scripts/qa/build.mjs), through an adapter that re-exports the same "on" module.
  const qa = readFileSync('vite.qa.config.ts', 'utf8');
  assert.match(qa, /if \(QA_IDENTITY === 'crease'\) QA_REPLACEMENTS\[at\('src\/lib\/brand-identity\.ts'\)\] = at\('qa\/iphone\/adapters\/brand-identity\.ts'\);/);
  assert.match(readFileSync('qa/iphone/adapters/brand-identity.ts', 'utf8'), /^export \* from '\.\.\/\.\.\/\.\.\/src\/lib\/brand-identity\.on';$/m);
  assert.match(readFileSync('scripts/qa/build.mjs', 'utf8'), /qa\/iphone\/review-identity\.json/);
});

test('brand placements carry the name "Lumen" for assistive technology', () => {
  const art = readFileSync('src/components/BrandCrease.tsx', 'utf8');
  assert.match(art, /role: 'img', 'aria-label': 'Lumen'/);
  assert.match(art, /'aria-hidden': true/);
  // The decorative mark appears only beside a control that is already named.
  assert.match(readFileSync('src/components/ChatView.tsx', 'utf8'), /<BrandMark height=\{20\} decorative className="cv-collapsed-mark" \/><button className="icon-btn expand-sidebar"[^>]*aria-label="Expand sidebar"/);
  for (const name of readdirSync('brand/crease/svg').filter((f) => f.startsWith('lumen-wordmark'))) {
    const svg = readFileSync(`brand/crease/svg/${name}`, 'utf8');
    assert.match(svg, /role="img" aria-label="Lumen"><title>Lumen<\/title>/, name);
  }
});
