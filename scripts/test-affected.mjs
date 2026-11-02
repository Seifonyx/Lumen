// Picks the in-app suites and Canvas contracts a change can affect, so a local check takes minutes instead of the
// whole run. CI still runs everything on the pull request.
//   npm run test:affected            list them
//   npm run test:affected -- --run   build both presentations and run them (starts the Firebase emulators if needed)
// How it chooses: changed test files, and suites using a changed test helper, are always in. For each changed app
// file it collects the words a test could use to find the changed code (quoted strings such as labels and
// aria-labels, class names, JSX text) from the added and removed lines. A suite is affected when it quotes one of
// those words or uses one of those classes. Words found in more than an eighth of all suites say too little and are
// ignored.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { cpus } from 'node:os';
import { basename, extname } from 'node:path';
import { createConnection } from 'node:net';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const run = process.argv.includes('--run');
const base = (() => { try { return git('merge-base', 'HEAD', 'origin/main'); } catch { return 'origin/main'; } })();
const changed = [...new Set([
  ...git('diff', '--name-only', base).split('\n'),
  ...git('ls-files', '--others', '--exclude-standard').split('\n'),
].filter((f) => f && existsSync(f)))];

const E2E = 'tests/e2e', SEC = 'tests/security';
const suites = readdirSync(E2E).filter((f) => f.endsWith('.cjs'));
const contracts = readdirSync(SEC).filter((f) => /^private-qa-.+\.mjs$/.test(f) && f !== 'private-qa-isolation.mjs');
const text = Object.fromEntries([...suites.map((f) => [`${E2E}/${f}`]), ...contracts.map((f) => [`${SEC}/${f}`])].map(([p]) => [p, readFileSync(p, 'utf8')]));

// Words a test could use to find something in this file.
const NOISE = /^(?:true|false|null|none|auto|button|click|div|span|string|number|object|function|default|utf8|text|value|label|title|name|type|role|dialog|menu|main|link|img|input|submit|hidden|small|primary|success|error|info|light|dark|use strict)$/i;
const EVERYWHERE = new Set(['New chat', 'Send', 'Stop', 'Settings', 'Library', 'Router', 'Projects', 'Search', 'Close', 'Cancel', 'Save', 'Delete', 'Open sidebar', 'Open chats', 'Message', 'Return to chat']);
function words(file) {
  // The changed lines on both sides: a removed label is what the old tests still look for.
  const src = git('diff', '-U0', base, '--', file).split('\n').filter((l) => /^[+-](?![+-])/.test(l)).map((l) => l.slice(1)).join('\n')
    ||(git('ls-files', '--others', '--exclude-standard', '--', file) ? readFileSync(file, 'utf8') : '');
  const out = new Set();
  // Kept: a class (".name"), a label (a capital letter or several words) or a hyphenated token. Dropped: code words
  // such as 'scroll', paths, URLs, template pieces and the labels every screen has.
  const add = (w) => {
    w = w.trim();
    const cls = /^\.[a-z][\w-]+$/i.test(w);
    if (w.length < 3 || w.length > 60 || !/[a-z]/i.test(w) || NOISE.test(w) || EVERYWHERE.has(w)) return;
    if (!cls && (!/[A-Z ]|-/.test(w) || /^[./@]|\$\{|\\|^https?:/.test(w))) return;
    out.add(w);
  };
  if (extname(file) === '.css') {
    for (const [, c] of src.matchAll(/\.([a-z][\w-]{2,})/gi)) add(`.${c}`);
    return out;
  }
  for (const [, , s] of src.matchAll(/(['"])((?:(?!\1)[^\n\\])+)\1/g)) {
    add(s);
    // className lists: each class on its own.
    if (/^[a-z][\w-]*(?: [a-z][\w-]*)+$/.test(s)) for (const c of s.split(' ')) if (c.includes('-')) add(`.${c}`);
    else if (/^[a-z]+-[\w-]+$/.test(s)) add(`.${s}`);
  }
  for (const [, t] of src.matchAll(/>\s*([A-Z][^<>{}\n]{2,58}?)\s*</g)) add(t);
  return out;
}
const escape = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const used = (w) => w.startsWith('.') ? new RegExp(`${escape(w)}(?![\\w-])`) : new RegExp(`['"\`]${escape(w)}['"\`]|name: ?/\\^?${escape(w)}`);

const hits = new Map(); // test path -> reasons
const mark = (path, why) => { if (!hits.has(path)) hits.set(path, new Set()); hits.get(path).add(why); };
for (const f of changed) {
  if (text[f]) mark(f, 'changed');
  if (f.startsWith(`${E2E}/helpers/`)) for (const p of Object.keys(text)) if (text[p].includes(`helpers/${basename(f)}`)) mark(p, `uses ${basename(f)}`);
}
const appFiles = changed.filter((f) => f.startsWith('src/') && /\.(tsx?|css)$/.test(f));
const limit = Math.max(4, Math.ceil(Object.keys(text).length / 8));
for (const f of appFiles) {
  // A label or class that left the file entirely is what old tests still look for, however many use it.
  const now = readFileSync(f, 'utf8');
  for (const w of words(f)) {
    const re = used(w), found = Object.keys(text).filter((p) => re.test(text[p]));
    const removed = !now.includes(w.startsWith('.') ? w.slice(1) : w);
    if (found.length && (removed || found.length <= limit)) for (const p of found) mark(p, `${basename(f)}: ${removed ? 'removed ' : ''}${w}`);
  }
}

const canvasCore = new Set(readFileSync(`${E2E}/canvas-core.txt`, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')));
const picked = [...hits.keys()].sort();
const e2e = picked.filter((p) => p.startsWith(E2E)).map((p) => basename(p, '.cjs'));
const sec = picked.filter((p) => p.startsWith(SEC)).map((p) => basename(p, '.mjs').replace('private-qa-', ''));
console.log(`Changed since ${base.slice(0, 7)}: ${changed.length} files (${appFiles.length} app files)`);
for (const p of picked) console.log(`  ${p}  ← ${[...hits.get(p)].slice(0, 3).join('; ')}${hits.get(p).size > 3 ? ` (+${hits.get(p).size - 3})` : ''}`);
if (!picked.length) console.log('  No suite references the changed code: unit tests and builds are enough locally.');
if (!run) process.exit(0);

const step = (label, cmd, args, env = {}) => {
  console.log(`\n■ ${label}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, ...env } });
  if (r.status) { console.log(`✗ ${label} failed`); process.exit(r.status || 1); }
};
const lanes = String(Math.max(2, Math.min(6, cpus().length - 2)));
step('Type check and unit tests', 'npm', ['test']);
step('Ordinary build', 'npm', ['run', 'build']);
step('Canvas build', 'npm', ['run', 'build', '--', '--outDir', 'dist-canvas'], { LUMEN_CANVAS: '1' });
step('Size budget', 'node', ['scripts/canvas-budget.mjs', 'dist', 'dist-canvas']);
// On the Canvas build: what CI runs there (canvas-core.txt and the suites the workflow runs directly on Canvas).
const workflow = readFileSync('.github/workflows/tests.yml', 'utf8');
const onCanvas = e2e.filter((s) => canvasCore.has(s) || workflow.includes(`tests/e2e/${s}.cjs`));
const listening = (port) => new Promise((ok) => { const s = createConnection(port, '127.0.0.1'); s.on('connect', () => { s.end(); ok(true); }); s.on('error', () => ok(false)); });
const emulators = (await listening(8080)) && (await listening(9099));
const e2eRun = (label, names, dist) => names.length && step(label, emulators ? 'node' : 'npx', emulators
  ? ['scripts/test-e2e.mjs', ...names]
  : ['--yes', 'firebase-tools@15.30.2', 'emulators:exec', '--only', 'auth,firestore', '--project', 'the-model-router', `"node scripts/test-e2e.mjs ${names.join(' ')}"`],
  { MR_TEST_DIST: dist, E2E_LANES: lanes });
e2eRun(`In-app suites on the Canvas build (${onCanvas.length})`, onCanvas, 'dist-canvas');
e2eRun(`In-app suites on the ordinary build (${e2e.length})`, e2e, 'dist');
if (sec.length) {
  step('Synthetic QA build for the Canvas contracts', 'node', ['scripts/qa/build.mjs', '--out', '.qa-build'], {});
  for (const c of sec) step(`Canvas contract ${c}`, 'node', [`${SEC}/private-qa-${c}.mjs`], { QA_BUILD_DIR: '.qa-build' });
}
console.log('\n✓ Affected checks passed. CI runs the full set on the pull request.');
