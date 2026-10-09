// Runs the in-app tests in tests/e2e against the built app (dist) and the Firebase emulators.
// Locally: start the emulators (npx firebase-tools emulators:start --only auth,firestore --project the-model-router),
// run `npm run build`, then `npm run test:e2e`. In CI, `npm run test:e2e:ci` starts the emulators itself.
// Pick tests with arguments: npm run test:e2e -- memory compact
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'tests/e2e';
mkdirSync(join(dir, 'out'), { recursive: true });
const only = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.endsWith('.cjs') && (!only.length || only.includes(f.replace(/\.cjs$/, '')))).sort();

const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', '5190', '--strictPort'], { stdio: 'ignore' });
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

let failed = [];
try {
  await up();
  for (const file of files) {
    console.log(`\n▶ ${file}`);
    const t0 = Date.now();
    const run = spawnSync(process.execPath, [join(dir, file)], { stdio: 'inherit', timeout: 10 * 60_000 });
    console.log(`  (${Math.round((Date.now() - t0) / 1000)} s)`);
    if (run.status !== 0) failed.push(file);
  }
} finally {
  preview.kill();
}
console.log(failed.length ? `\n✗ failed: ${failed.join(', ')}` : `\n✓ all ${files.length} in-app test files passed`);
process.exit(failed.length ? 1 : 0);
