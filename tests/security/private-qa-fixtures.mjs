// Test-only support for the private QA gate: an in-memory store with the conditional-write semantics
// the gate requires, and synthetic RS256 identities generated fresh for each run (never committed,
// never real). Nothing here talks to a network or reads a credential.

import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';

export { MemoryStorage } from '../../server/private-qa/memory-storage.mjs';

const b64url = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

/** A synthetic signer with its public JWK. */
export function testIdentityProvider({ kid = `qa-test-${randomUUID().slice(0, 8)}`, issuer = 'https://qa-test.invalid', audience = 'qa-test-audience', modulusLength = 2048 } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' };
  const sign = async (claims, header = {}) => {
    const h = b64url({ alg: 'RS256', kid, typ: 'JWT', ...header });
    const p = b64url(claims);
    const { createSign } = await import('node:crypto');
    const signature = createSign('RSA-SHA256').update(`${h}.${p}`).sign(privateKey).toString('base64url');
    return `${h}.${p}.${signature}`;
  };
  const token = (email, { now = Date.now(), ttl = 3600, ...extra } = {}) => {
    const iat = Math.floor(now / 1000);
    return sign({ iss: issuer, aud: [audience], email, iat, nbf: iat, exp: iat + ttl, sub: createHash('sha256').update(email).digest('hex'), ...extra });
  };
  return { kid, issuer, audience, jwk, sign, token, trust: { issuer, audience, keys: [jwk] } };
}

export const unsigned = (claims) => `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(claims)}.`;
