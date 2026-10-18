// Runs the in-app tests in tests/e2e against the built app (dist) and the Firebase emulators.
// Locally: start the emulators (npx firebase-tools emulators:start --only auth,firestore --project the-model-router),
// run `npm run build`, then `npm run test:e2e`. In CI, `npm run test:e2e:ci` starts the emulators itself.
// Pick tests with arguments: npm run test:e2e -- memory compact
//
// Speed: tests that use the shared Firebase emulators run one after another in one lane (they reset its
// data); the others are fully isolated and run side by side in the remaining lanes, longest first
// (durations in tests/e2e/timings.json). E2E_LANES sets the number of lanes (default 3).
// A file that fails is run once more on its own; it only counts as failed if it fails twice.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'tests/e2e';
mkdirSync(join(dir, 'out'), { recursive: true });
const only = process.argv.slice(2);
const available=readdirSync(dir).filter(f=>f.endsWith('.cjs'));
const unknown=only.filter(name=>!available.includes(`${name}.cjs`));
if(unknown.length) {console.error(`Unknown in-app test suite(s): ${unknown.join(', ')}`);process.exit(2);}
const files = available.filter(f=>!only.length || only.includes(f.replace(/\.cjs$/, ''))).sort();
if(!files.length) {console.error('No in-app test suites selected.');process.exit(2);}
const timingsFile = join(dir, 'timings.json');
const timings = existsSync(timingsFile) ? JSON.parse(readFileSync(timingsFile, 'utf8')) : {};
const usesEmulators = (f) => /127\.0\.0\.1:(8080|9099)|localhost:(8080|9099)|__testSignIn|emulator\/v1/.test(readFileSync(join(dir, f), 'utf8'));
const lanes = Math.max(1, Number(process.env.E2E_LANES) || 3);
const byLength = (a, b) => (timings[b] ?? 30) - (timings[a] ?? 30) || a.localeCompare(b);
const shared = files.filter(usesEmulators).sort(byLength);
const isolated = files.filter((f) => !usesEmulators(f)).sort(byLength);

const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', '5190', '--strictPort', ...(process.env.MR_TEST_DIST ? ['--outDir', process.env.MR_TEST_DIST] : [])], { stdio: 'ignore' });
const up = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch('http://localhost:5190/')).ok) return;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('The preview server did not start (did you run npm run build?)');
};

// Output is collected per file and printed in one piece, so parallel runs stay readable.
const runFile = (file) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [join(dir, file)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    const timer = setTimeout(() => child.kill('SIGKILL'), 10 * 60_000);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, out });
    });
  });

const failed = [];
const flaky = [];
const measured = {};
const runOne = async (file, retry) => {
  const t0 = Date.now();
  const first = await runFile(file);
  measured[file] = Math.round((Date.now() - t0) / 1000);
  if (first.ok) return console.log(`\n▶ ${file}\n${first.out.trimEnd()}\n  (${measured[file]} s)`);
  if (!retry) return failed.push({ file, out: first.out });
  retry.push({ file, out: first.out });
};

const t0 = Date.now();
const again = [];
try {
  await up();
  const queue = [...isolated];
  const isolatedLane = async () => {
    for (let f = queue.shift(); f; f = queue.shift()) await runOne(f, again);
  };
  const sharedLane = async () => {
    for (const f of shared) await runOne(f, again);
  };
  await Promise.all([shared.length ? sharedLane() : isolatedLane(), ...Array.from({ length: Math.max(1, lanes - 1) }, isolatedLane)]);
  // Second tries run alone, so a busy machine can't be the reason they fail again.
  for (const { file, out } of again) {
    console.log(`\n▶ ${file} (first try failed)\n${out.trimEnd()}\n  ↻ running it again on its own`);
    const second = await runFile(file);
    console.log(second.out.trimEnd());
    if (second.ok) flaky.push(file);
    else failed.push({ file, out: '', detail: second.out });
  }
} finally {
  preview.kill();
}
for (const { file, out } of failed) if (out) console.log(`\n▶ ${file}\n${out.trimEnd()}`);
if (process.env.SAVE_TIMINGS) writeFileSync(timingsFile, `${JSON.stringify(Object.fromEntries(Object.entries({ ...timings, ...measured }).sort()), null, 1)}\n`);
console.log(`\n${files.length} files in ${Math.round((Date.now() - t0) / 1000)} s (${lanes} lanes)`);
if (flaky.length) console.log(`⚠ passed on the second try: ${flaky.join(', ')}`);
// On GitHub, each failure becomes an annotation (readable without downloading the log).
if (process.env.GITHUB_ACTIONS) for (const { file, out, detail } of failed) {
  const lines = (detail || out).split('\n').filter((l) => /FAIL|Error|assert|expected|actual|Timeout|waiting for/i.test(l)).slice(0, 12).join('\n') || (detail || out).slice(-1500);
  console.log(`::error title=${file} failed::${lines.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')}`);
}
console.log(failed.length ? `✗ failed: ${failed.map((f) => f.file).join(', ')}` : `✓ all ${files.length} in-app test files passed`);
process.exit(failed.length ? 1 : 0);
