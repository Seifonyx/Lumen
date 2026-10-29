// CP01 diagnostic only: inspect the ordinary Vite graph without changing its configuration or entry.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { build } from 'vite';

const out = resolve(process.env.CP01_OUT || 'tests/e2e/out/cp01');
const output = join(out, 'production-dist');
const root = process.cwd();
// CP02: the Canvas composer styles and the QA adapter that turns it on must never reach the ordinary graph.
const forbidden = /(?:^|\/)(?:docs\/blackout|tests|qa)(?:\/|$)|(?:^|\/)src\/(?:lib\/(?:workspace-presentation|canvas-presentation\.on|provider-presentation|provider-settings-target|library-items|router-settings-route|provider-icons)\.ts|components\/(?:canvas-library|tools-workspace|settings-index)\.css|styles\/canvas(?:-composer|-shell|-reading|-routing|-routing-experience|-screens)?\.css|components\/(?:RoutingCenter|PrismModels|PrismLayouts|CanvasCollectionPage|RoutingInsight|ToolsWorkspace|SettingsIndex)\.tsx)(?:\?|$)/;
function assertIsolated(ids) {
  const leaked = ids.map(id => id.replaceAll('\\', '/')).filter(id => forbidden.test(id));
  assert.deepEqual(leaked, [], 'ordinary build must not reach proof, fixtures, test auth/transport, or Canvas foundation');
}
// Negative controls: catch static/dynamic/CSS/test imports and Windows/query-shaped IDs.
for (const id of ['/repo/docs/blackout/workspace-proofs/bootstrap.ts', '/repo/tests/e2e/helpers/preview-profile.cjs',
  '/repo/src/styles/canvas-composer.css', '/repo/src/styles/canvas-shell.css', '/repo/src/styles/canvas-reading.css', '/repo/src/components/RoutingCenter.tsx', '/repo/qa/iphone/adapters/canvas-presentation.ts',
  '/repo/src/styles/canvas.css?direct', 'C:\\repo\\docs\\blackout\\workspace-proofs\\proposals\\ProposalChrome.tsx',
  '/repo/src/lib/workspace-presentation.ts', '/repo/src/lib/canvas-presentation.on.ts', '/repo/src/lib/provider-presentation.ts', '/repo/src/lib/provider-settings-target.ts', '/repo/src/components/PrismModels.tsx', '/repo/src/components/PrismLayouts.tsx', '/repo/src/components/RoutingInsight.tsx', '/repo/src/styles/canvas-routing-experience.css', '/repo/src/components/CanvasCollectionPage.tsx', '/repo/src/components/canvas-library.css', '/repo/src/lib/library-items.ts', '/repo/src/components/ToolsWorkspace.tsx', '/repo/src/components/tools-workspace.css', '/repo/src/components/SettingsIndex.tsx', '/repo/src/components/settings-index.css', '/repo/src/lib/router-settings-route.ts', '/repo/src/lib/provider-icons.ts']) {
  assert.throws(() => assertIsolated(['/repo/src/main.tsx', id]), /ordinary build/);
}
const NEGATIVE_CONTROLS = 26;
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
// CP02 markers: the flag-off build must fold the Canvas composer away entirely (no attribute, class or label).
const sentinels = ['__blackoutHarness', 'preview-blackout-interactive', 'synthetic-contract-marker', 'data-lumen-canvas-foundation', 'lumen.blackout.canvasNav',
  'data-lumen-canvas-composer', 'data-composer-state', 'canvas-sheet-head', 'canvas-writing-scrim', 'Expand writing', 'canvas-writing-title',
  'data-lumen-canvas-shell', 'cv-nav', 'cv-fold', 'cv-section-toggle', 'cv-stopped', 'cv-file-meta',
  'rc-page', 'rc-provider', 'Providers · Models · Policies'];
for (const file of Object.keys(artifacts).filter(f => /\.(?:html|js|css)$/.test(f))) {
  const content = readFileSync(join(output, file), 'utf8');
  for (const marker of sentinels) assert(!content.includes(marker), `${file}: unexpected proof/test marker ${marker}`);
}
if (process.env.CP01_BASELINE_DIST) assert.deepEqual(artifacts, manifest(resolve(process.env.CP01_BASELINE_DIST)), 'default emitted file names and bytes must match baseline');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'build-isolation.json'), JSON.stringify({ status: 'passed', modules: modules.map(id => relative(root, id)),
  artifacts, baselineByteEquality: Boolean(process.env.CP01_BASELINE_DIST), negativeControls: NEGATIVE_CONTROLS, sentinelChecks: sentinels }, null, 2));
console.log(`PASS CP01 production graph: ${modules.length} modules, ${Object.keys(artifacts).length} artifact hashes, ${NEGATIVE_CONTROLS} negative controls; baseline equality: ${Boolean(process.env.CP01_BASELINE_DIST)}`);
