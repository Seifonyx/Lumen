// CI splits the in-app tests across 5 machines (E2E_SHARD=i/n): every selected file must run on exactly one machine,
// for the ordinary run and the Canvas list alike, and the machines' recorded work must stay balanced.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { parseShard, shardFiles } from '../../scripts/e2e-shards.mjs';

const dir = 'tests/e2e';
const timings = JSON.parse(readFileSync(`${dir}/timings.json`, 'utf8'));
const duration = (f) => timings[f] ?? 30;
const usesEmulators = (f) => /127\.0\.0\.1:(8080|9099)|localhost:(8080|9099)|__testSignIn|emulator\/v1/.test(readFileSync(`${dir}/${f}`, 'utf8'));
const all = readdirSync(dir).filter((f) => f.endsWith('.cjs')).sort();
const canvas = readFileSync(`${dir}/canvas-core.txt`, 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#')).map((n) => `${n}.cjs`).sort();

test('parses i/n and rejects anything else', () => {
  assert.equal(parseShard(''), null);
  assert.deepEqual(parseShard('2/4'), { index: 2, count: 4 });
  for (const bad of ['0/4', '5/4', '1/0', '2', 'a/b', '1/4/2']) assert.throws(() => parseShard(bad), /E2E_SHARD/);
});

for (const [name, files, count] of [['ordinary run', all, 5], ['Canvas list', canvas, 5]]) {
  test(`${name}: each file runs on exactly one of ${count} machines, with balanced work`, () => {
    const groups = [files.filter(usesEmulators), files.filter((f) => !usesEmulators(f))];
    const shards = Array.from({ length: count }, (_, i) => shardFiles(groups, { index: i + 1, count }, duration));
    assert.deepEqual(shards.flat().sort(), [...files].sort(), 'every file once, none lost or repeated');
    const loads = shards.map((s) => s.reduce((n, f) => n + duration(f), 0));
    const longest = Math.max(...files.map(duration));
    assert.ok(Math.max(...loads) - Math.min(...loads) <= longest, `balanced within one file: ${loads.join(', ')}`);
    // Emulator suites are spread too (each machine runs its own emulators).
    assert.ok(shards.filter((s) => s.some(usesEmulators)).length > 1);
  });
}
