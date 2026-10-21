// Test-only support for the private QA gate: an in-memory store with the conditional-write semantics
// the gate requires, and synthetic RS256 identities generated fresh for each run (never committed,
// never real). Nothing here talks to a network or reads a credential.

import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';

export class MemoryStorage {
  constructor() {
    this.objects = new Map();
    this.failGet = null; // (key) => boolean: simulate an unavailable read
    this.gets = [];
  }
  async get(key) {
    this.gets.push(key);
    if (this.failGet?.(key)) throw new Error('storage unavailable');
    const object = this.objects.get(key);
    return object ? { bytes: object.bytes.slice(), etag: object.etag } : null;
  }
  async put(key, bytes, { onlyIf } = {}) {
    const current = this.objects.get(key);
    if (onlyIf?.etagDoesNotMatch === '*' && current) return null;
    if (onlyIf?.etagMatches !== undefined && current?.etag !== onlyIf.etagMatches) return null;
    const etag = `"${createHash('sha256').update(bytes).update(randomUUID()).digest('hex').slice(0, 16)}"`;
    this.objects.set(key, { bytes: Uint8Array.from(bytes), etag });
    return { etag };
  }
  /** Out-of-band tampering, as a compromised or buggy writer would do. */
  overwrite(key, bytes) { this.objects.set(key, { bytes: Uint8Array.from(bytes), etag: `"tampered-${randomUUID()}"` }); }
  keys(prefix = '') { return [...this.objects.keys()].filter((k) => k.startsWith(prefix)); }
}

const b64url = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

/** A synthetic signer with its public JWK. */
export function testIdentityProvider({ kid = `qa-test-${randomUUID().slice(0, 8)}`, issuer = 'https://qa-test.invalid', audience = 'qa-test-audience' } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
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
