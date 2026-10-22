// Private iPhone QA: checks a built review build against its manifest before anyone could publish it.
//   node scripts/qa/verify.mjs --out DIR --commit FULL_SHA
// Fails unless every file is listed with a matching digest, nothing extra exists, the commit is exactly
// the expected one and the build has not expired. Local only; no network.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseManifest, sha256 } from '../../server/private-qa/control.mjs';
import { auditOutput, listFiles } from './audit.mjs';

export async function verifyBuild(out, expectedCommit, now = Date.now()) {
  const problems = [];
  const manifest = await parseManifest(new Uint8Array(readFileSync(join(out, 'manifest.json'))));
  if (!manifest) return ['manifest.json is missing or invalid'];
  if (!/^[0-9a-f]{40}$/.test(expectedCommit || '') || manifest.commit !== expectedCommit) problems.push(`commit ${manifest.commit} is not the expected ${expectedCommit}`);
  if (manifest.expiresAt <= now) problems.push('build has expired');
  const site = join(out, 'site');
  const present = new Set(listFiles(site));
  for (const [path, asset] of Object.entries(manifest.assets)) {
    if (!present.has(path)) { problems.push(`${path}: listed but missing`); continue; }
    const bytes = new Uint8Array(readFileSync(join(site, path)));
    if (bytes.byteLength !== asset.bytes || (await sha256(bytes)) !== asset.sha256) problems.push(`${path}: digest mismatch`);
    present.delete(path);
  }
  for (const path of present) problems.push(`${path}: not in the manifest`);
  try { auditOutput(site); } catch (e) { problems.push(...(e.problems || [e.message])); }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/qa/verify.mjs')) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []));
  const problems = await verifyBuild(resolve(args.out || 'dist-qa'), args.commit);
  if (problems.length) { console.error(`QA build verification failed:\n${problems.join('\n')}`); process.exit(1); }
  console.log('QA build verified against its manifest and commit.');
}
