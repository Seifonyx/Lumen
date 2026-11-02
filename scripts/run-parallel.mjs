// Runs standalone test files side by side: node scripts/run-parallel.mjs <lanes> <file>...
// Each file runs as its own `node <file>` with the caller's environment; output is printed per file when it ends, so
// logs stay readable. Longest first by tests/e2e/timings.json (unknown files count as 60 s). A file that fails is run
// once more on its own; it only counts as failed if it fails twice (the same rule as scripts/test-e2e.mjs).
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { parseShard, shardFiles } from './e2e-shards.mjs';

const [lanesArg, ...files] = process.argv.slice(2);
const lanes = Math.max(1, Number(lanesArg) || 1);
if (!files.length) { console.error('usage: node scripts/run-parallel.mjs <lanes> <file>...'); process.exit(2); }
const timings = existsSync('tests/e2e/timings.json') ? JSON.parse(readFileSync('tests/e2e/timings.json', 'utf8')) : {};
const seconds = (f) => timings[basename(f)] ?? 60;
// RUN_SHARD=i/n: only this machine's share, balanced by recorded duration (the same split as the in-app runner).
const shard = parseShard(process.env.RUN_SHARD);
const mine = shard ? shardFiles([files], shard, seconds) : files;
if (shard) console.log(`Shard ${shard.index}/${shard.count}: ${mine.length} of ${files.length} files`);
if (!mine.length) process.exit(0);
const queue = [...mine].sort((a, b) => seconds(b) - seconds(a));

const run = (file) => new Promise((resolve) => {
  const started = Date.now(), out = [];
  const child = spawn(process.execPath, [file], { env: process.env });
  child.stdout.on('data', (d) => out.push(d)); child.stderr.on('data', (d) => out.push(d));
  child.on('close', (code) => resolve({ file, code, output: Buffer.concat(out).toString(), s: Math.round((Date.now() - started) / 1000) }));
});

const failed = [], retried = [];
const started = Date.now();
await Promise.all(Array.from({ length: Math.min(lanes, queue.length) }, async () => {
  for (let file; (file = queue.shift());) {
    const r = await run(file);
    console.log(`\n▶ ${basename(file)} (${r.s} s)${r.code ? ' (first try failed)' : ''}\n${r.output.trimEnd()}`);
    if (r.code) failed.push(file);
  }
}));
// Retries run alone, so a failure caused only by load on the machine does not count.
for (const file of [...failed]) {
  console.log(`  ↻ running ${basename(file)} again on its own`);
  const r = await run(file);
  console.log(r.output.trimEnd());
  if (!r.code) { failed.splice(failed.indexOf(file), 1); retried.push(file); }
}
console.log(`\n${mine.length} files in ${Math.round((Date.now() - started) / 1000)} s (${lanes} lanes)`);
if (retried.length) console.log(`⚠ passed on the second try: ${retried.map((f) => basename(f)).join(', ')}`);
if (failed.length) { console.log(`✗ failed: ${failed.map((f) => basename(f)).join(', ')}`); process.exit(1); }
