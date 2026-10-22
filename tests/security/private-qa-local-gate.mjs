// Test-only: serves one built review build through the real QA gate on loopback (127.0.0.1), with
// in-memory storage and synthetic identities. Nothing is published; the server is not reachable from
// other devices and stops with the test.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGate } from '../../server/private-qa/gate.mjs';
import { initRegistry, publish, revoke } from '../../server/private-qa/control.mjs';
import { listFiles } from '../../scripts/qa/audit.mjs';
import { MemoryStorage, testIdentityProvider } from './private-qa-fixtures.mjs';

export const REVIEWERS = Object.freeze({ owner: 'owner@qa-review.test', second: 'second@qa-review.test', stranger: 'stranger@qa-review.test' });

export async function startLocalGate(buildDir, { clock = () => Date.now() } = {}) {
  const storage = new MemoryStorage();
  const idp = testIdentityProvider();
  await initRegistry({ storage, reviewers: [REVIEWERS.owner, REVIEWERS.second], namespaceSalt: '5a'.repeat(16) });
  const manifestBytes = new Uint8Array(readFileSync(join(buildDir, 'manifest.json')));
  const site = join(buildDir, 'site');
  const files = listFiles(site).map((path) => ({ path, bytes: new Uint8Array(readFileSync(join(site, path))) }));
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  await publish({ storage, manifestBytes, files, reviewers: [REVIEWERS.owner, REVIEWERS.second], now: clock() });

  let gate;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(name, value);
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks);
    const response = await gate.fetch(new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers, body }));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const host = `127.0.0.1:${server.address().port}`;
  gate = createGate({ storage, trust: idp.trust, hosts: [host], now: clock });
  return {
    origin: `http://${host}`,
    buildUrl: `http://${host}/b/${manifest.buildId}/`,
    buildId: manifest.buildId,
    manifest,
    storage,
    token: (email, options) => idp.token(email, { now: clock(), ...options }),
    revoke: (options) => revoke({ storage, now: clock(), ...options }),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
