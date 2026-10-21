// Private iPhone QA in GitHub Codespaces: serves one verified synthetic review build through the QA01
// gate on 127.0.0.1, for GitHub's private (creator-only, signed-in) forwarded HTTPS port.
//
//   node scripts/qa/build.mjs --out /tmp/lumen-qa-build --hours 8
//   node scripts/qa/serve-codespace.mjs --build /tmp/lumen-qa-build [--port 4173]
//
// GitHub's port proxy is the external access boundary. Inside, every request still passes the QA01 gate:
// this process signs a short-lived synthetic identity itself (keys generated at start, never stored) and
// discards any identity header the browser sends. It refuses to start outside a Codespace or for a build
// that does not match its manifest and the checked-out commit. Nothing is published or persisted.

import { execFileSync } from 'node:child_process';
import { createSign, generateKeyPairSync, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGate } from '../../server/private-qa/gate.mjs';
import { initRegistry, publish } from '../../server/private-qa/control.mjs';
import { MemoryStorage } from '../../server/private-qa/memory-storage.mjs';
import { listFiles } from './audit.mjs';
import { verifyBuild } from './verify.mjs';

const REVIEWER = 'reviewer@codespace.invalid';
const ISSUER = 'https://codespace-reviewer.invalid';
const AUDIENCE = 'lumen-qa-codespace';
const IDENTITY_HEADER = 'cf-access-jwt-assertion';

/** The Codespace's forwarded host for `port`, or an error explaining why this is not an authorised Codespace. */
export function codespaceHost(env, port) {
  if (env.CODESPACES !== 'true') throw new Error('Refusing to start: this review server runs only inside a GitHub Codespace (CODESPACES=true).');
  const name = env.CODESPACE_NAME || '';
  const domain = env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || '';
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(name)) throw new Error('Refusing to start: CODESPACE_NAME is missing or malformed.');
  if (!/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/.test(domain)) throw new Error('Refusing to start: GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN is missing or malformed.');
  return `${name}-${port}.${domain}`;
}

function localIdentity() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = `codespace-${randomBytes(8).toString('hex')}`;
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' };
  const b64 = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const token = (now) => {
    const iat = Math.floor(now / 1000);
    const body = `${b64({ alg: 'RS256', kid, typ: 'JWT' })}.${b64({ iss: ISSUER, aud: [AUDIENCE], email: REVIEWER, iat, nbf: iat, exp: iat + 300 })}`;
    return `${body}.${createSign('RSA-SHA256').update(body).sign(privateKey).toString('base64url')}`;
  };
  return { trust: { issuer: ISSUER, audience: AUDIENCE, keys: [jwk] }, token };
}

/**
 * Starts the review server. Options exist for tests; the CLI passes the real environment.
 * Resolves to { url, buildUrl, buildId, host, close }. Rejects (fails closed) on any unmet condition.
 */
export async function startCodespaceServer({ buildDir, port = 4173, env = process.env, expectedCommit, now = () => Date.now() }) {
  const forwardedHost = codespaceHost(env, port);
  const build = resolve(buildDir || '');
  const commit = expectedCommit || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const problems = await verifyBuild(build, commit, now());
  if (problems.length) throw new Error(`Refusing to start: build verification failed:\n${problems.join('\n')}`);

  const storage = new MemoryStorage();
  const identity = localIdentity();
  await initRegistry({ storage, reviewers: [REVIEWER], namespaceSalt: randomBytes(32).toString('hex') });
  const manifestBytes = new Uint8Array(readFileSync(join(build, 'manifest.json')));
  const site = join(build, 'site');
  const files = listFiles(site).map((path) => ({ path, bytes: new Uint8Array(readFileSync(join(site, path))) }));
  await publish({ storage, manifestBytes, files, reviewers: [REVIEWER], now: now() });
  const { buildId } = JSON.parse(new TextDecoder().decode(manifestBytes));

  let gate;
  const server = createServer(async (req, res) => {
    try {
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        // Never trust an identity the browser (or anything in front of us) supplies.
        if (typeof value === 'string' && name.toLowerCase() !== IDENTITY_HEADER) headers.set(name, value);
      }
      headers.set(IDENTITY_HEADER, identity.token(now()));
      const host = typeof req.headers.host === 'string' ? req.headers.host : '';
      const response = await gate.fetch(new Request(`https://${host || 'invalid.invalid'}${req.url}`, { method: req.method, headers }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store' });
      res.end('Bad request.');
    }
  });
  await new Promise((done, fail) => { server.once('error', fail); server.listen(port, '127.0.0.1', done); });
  const actualPort = server.address().port;
  // Only the Codespace's forwarded host and the container's own loopback names are accepted.
  gate = createGate({ storage, trust: identity.trust, hosts: [forwardedHost.replace(`-${port}.`, `-${actualPort}.`), `localhost:${actualPort}`, `127.0.0.1:${actualPort}`], now });
  const host = forwardedHost.replace(`-${port}.`, `-${actualPort}.`);
  return {
    host, buildId, address: server.address(),
    url: `https://${host}/`, buildUrl: `https://${host}/b/${buildId}/`,
    close: () => new Promise((done) => server.close(done)),
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []));
  try {
    const server = await startCodespaceServer({ buildDir: args.build || '/tmp/lumen-qa-build', port: Number(args.port || 4173) });
    console.log(`Lumen synthetic review ready (build ${server.buildId}).\nOpen on your iPhone (GitHub sign-in required; port must show "Private"):\n  ${server.buildUrl}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
