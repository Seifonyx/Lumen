// CP01 diagnostic only: inspect the ordinary Vite graph without changing its configuration or entry.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { build } from 'vite';

const out = resolve(process.env.CP01_OUT || 'tests/e2e/out/cp01');
const output = join(out, 'production-dist');
const root = process.cwd();
const forbidden = /(?:^|\/)(?:docs\/blackout|tests)(?:\/|$)|(?:^|\/)src\/(?:lib\/workspace-presentation\.ts|styles\/canvas\.css)(?:\?|$)/;
function assertIsolated(ids) {
  const leaked = ids.map(id => id.replaceAll('\\', '/')).filter(id => forbidden.test(id));
  assert.deepEqual(leaked, [], 'ordinary build must not reach proof, fixtures, test auth/transport, or Canvas foundation');
}
// Negative controls: catch static/dynamic/CSS/test imports and Windows/query-shaped IDs.
for (const id of ['/repo/docs/blackout/workspace-proofs/bootstrap.ts', '/repo/tests/e2e/helpers/preview-profile.cjs',
  '/repo/src/styles/canvas.css?direct', 'C:\\repo\\docs\\blackout\\workspace-proofs\\proposals\\ProposalChrome.tsx',
  '/repo/src/lib/workspace-presentation.ts']) {
  assert.throws(() => assertIsolated(['/repo/src/main.tsx', id]), /ordinary build/);
}
let modules = [];
await build({ build: { outDir: output }, plugins: [{ name: 'cp01-read-only-isolation-audit',
  generateBundle() { modules = [...this.getModuleIds()]; assertIsolated(modules); }
}] });
function manifest(dir, prefix = '') {
  return Object.fromEntries(readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const name = join(prefix, entry.name), path = join(dir, entry.name);
    return entry.isDirectory() ? Object.entries(manifest(path, name)) : [[name, createHash('sha256').update(readFileSync(path)).digest('hex')]];
  }));
}
const artifacts = manifest(output);
const sentinels = ['__blackoutHarness', 'preview-blackout-interactive', 'synthetic-contract-marker', 'data-lumen-canvas-foundation', 'lumen.blackout.canvasNav'];
for (const file of Object.keys(artifacts).filter(f => /\.(?:html|js|css)$/.test(f))) {
  const content = readFileSync(join(output, file), 'utf8');
  for (const marker of sentinels) assert(!content.includes(marker), `${file}: unexpected proof/test marker ${marker}`);
}
if (process.env.CP01_BASELINE_DIST) assert.deepEqual(artifacts, manifest(resolve(process.env.CP01_BASELINE_DIST)), 'default emitted file names and bytes must match baseline');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'build-isolation.json'), JSON.stringify({ status: 'passed', modules: modules.map(id => relative(root, id)),
  artifacts, baselineByteEquality: Boolean(process.env.CP01_BASELINE_DIST), negativeControls: 5, sentinelChecks: sentinels }, null, 2));
console.log(`PASS CP01 production graph: ${modules.length} modules, ${Object.keys(artifacts).length} artifact hashes, 5 negative controls; baseline equality: ${Boolean(process.env.CP01_BASELINE_DIST)}`);
