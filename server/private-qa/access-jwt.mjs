// Private iPhone QA: verifies the identity token the access layer forwards with each request.
// RS256 only, through the platform's WebCrypto; trusted public keys are injected (local tests use
// generated synthetic keys; a later, separately authorised slice supplies the real key set).

const decoder = new TextDecoder();

function base64url(text) {
  if (typeof text !== 'string' || !/^[A-Za-z0-9_-]+$/.test(text)) throw new Error('encoding');
  const pad = text.length % 4 === 2 ? '==' : text.length % 4 === 3 ? '=' : text.length % 4 === 0 ? '' : null;
  if (pad === null) throw new Error('encoding');
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

const json = (part) => {
  const value = JSON.parse(decoder.decode(base64url(part)));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('shape');
  return value;
};

/** Imports public RSA JWKs once; anything that is not an RS256 signing key is ignored. */
export async function importTrustKeys(jwks) {
  const keys = new Map();
  for (const jwk of jwks || []) {
    if (!jwk || jwk.kty !== 'RSA' || typeof jwk.kid !== 'string' || !jwk.kid || (jwk.alg && jwk.alg !== 'RS256') || (jwk.use && jwk.use !== 'sig') || jwk.d) continue;
    const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    keys.set(jwk.kid, key);
  }
  return keys;
}

/**
 * Returns `{ email }` for a valid token, or null. Never throws: every malformed, unsigned, wrong-key,
 * wrong-issuer, wrong-audience, expired or not-yet-valid token is simply not an identity.
 */
export async function verifyAccessJwt(token, { keys, issuer, audience, now = Date.now(), maxLifetimeSeconds = 24 * 3600 }) {
  try {
    if (typeof token !== 'string' || token.length > 8192) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = json(parts[0]);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.crit !== undefined) return null;
    const key = keys.get(header.kid);
    if (!key) return null;
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!valid) return null;
    const claims = json(parts[1]);
    const seconds = Math.floor(now / 1000);
    if (claims.iss !== issuer) return null;
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.includes(audience)) return null;
    if (!Number.isSafeInteger(claims.exp) || claims.exp <= seconds) return null;
    if (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf > seconds)) return null;
    if (claims.iat !== undefined && (!Number.isSafeInteger(claims.iat) || claims.iat > seconds + 60 || claims.exp - claims.iat > maxLifetimeSeconds)) return null;
    if (typeof claims.email !== 'string' || !/^[^\s@]+@[^\s@]+$/.test(claims.email) || claims.email.length > 254) return null;
    return { email: claims.email.toLowerCase() };
  } catch {
    return null;
  }
}
