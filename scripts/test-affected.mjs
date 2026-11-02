// Fast local check: only the tests a change can affect (scripts/affected.mjs explains how they are chosen). CI runs the
// same selection on a pull request, and everything after merging (Deploy waits for that run).
//   npm run test:affected                    list them and why
//   npm run test:affected -- --run           type check, unit, Canvas build and budget, then the affected suites:
//                                            Canvas suites on the Canvas build, the rest on the ordinary build
//   npm run test:affected -- --run --both    also re-run the Canvas suites on the ordinary build (CI does this)
// The Firebase emulators are started for the run if they are not already listening.
import { spawnSync } from 'node:child_process';
import { cpus } from 'node:os';
import { createConnection } from 'node:net';
import { SEC, affected, lists } from './affected.mjs';

const run = process.argv.includes('--run'), both = process.argv.includes('--both');
const a = affected();
console.log(`Changed since ${a.base.slice(0, 7)}: ${a.changed.length} files (${a.appFiles.length} app files)`);
for (const p of a.picked) console.log(`  ${p}  ← ${[...a.hits.get(p)].slice(0, 3).join('; ')}${a.hits.get(p).size > 3 ? ` (+${a.hits.get(p).size - 3})` : ''}`);
if (!a.picked.length) console.log('  No suite references the changed code: unit tests and builds are enough locally.');
if (a.broad.length) console.log(`  Broad change (${a.broad.slice(0, 3).join(', ')}): CI will run everything on the pull request.`);
if (!run) process.exit(0);

const step = (label, cmd, args, env = {}) => {
  console.log(`\n■ ${label}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, ...env } });
  if (r.status) { console.log(`✗ ${label} failed`); process.exit(r.status || 1); }
};
const { canvasCore, canvasPhone } = lists();
const onCanvas = a.e2e.filter((s) => canvasCore.includes(s) || canvasPhone.includes(s));
const onOrdinary = both ? a.e2e : a.e2e.filter((s) => !onCanvas.includes(s));
const lanes = String(Math.max(2, Math.min(6, cpus().length - 2)));
step('Type check and unit tests', 'npm', ['test']);
step('Canvas build', 'npm', ['run', 'build', '--', '--outDir', 'dist-canvas'], { LUMEN_CANVAS: '1' });
step('Ordinary build', 'npm', ['run', 'build']);
step('Size budget', 'node', ['scripts/canvas-budget.mjs', 'dist', 'dist-canvas']);
const listening = (port) => new Promise((ok) => { const s = createConnection(port, '127.0.0.1'); s.on('connect', () => { s.end(); ok(true); }); s.on('error', () => ok(false)); });
const emulators = (await listening(8080)) && (await listening(9099));
const e2eRun = (label, names, dist) => names.length && step(label, emulators ? 'node' : 'npx', emulators
  ? ['scripts/test-e2e.mjs', ...names]
  : ['--yes', 'firebase-tools@15.30.2', 'emulators:exec', '--only', 'auth,firestore', '--project', 'the-model-router', `"node scripts/test-e2e.mjs ${names.join(' ')}"`],
  { MR_TEST_DIST: dist, E2E_LANES: lanes });
e2eRun(`In-app suites on the Canvas build (${onCanvas.length})`, onCanvas, 'dist-canvas');
e2eRun(`In-app suites on the ordinary build (${onOrdinary.length})`, onOrdinary, 'dist');
// The QA build only builds an exact commit, so the contracts need the change committed. The suites above rewrite the
// tracked review screenshots in .impeccable/review; they are test output, so they are put back first.
spawnSync('git', ['checkout', '--', '.impeccable/review']); spawnSync('git', ['clean', '-fq', '--', '.impeccable/review']);
const dirty = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).stdout.trim();
if (a.contracts.length && dirty) console.log(`\n⚠ Canvas contracts skipped (${a.contracts.join(', ')}): commit first, or let CI run them.`);
else if (a.contracts.length) {
  step('Synthetic QA build for the Canvas contracts', 'node', ['scripts/qa/build.mjs', '--out', '.qa-build']);
  for (const c of a.contracts) step(`Canvas contract ${c}`, 'node', [`${SEC}/private-qa-${c}.mjs`], { QA_BUILD_DIR: '.qa-build' });
}
console.log('\n✓ Affected checks passed. CI runs them on the pull request and everything after merging.');
