// Password login with signed, expiring tokens, so the password itself is only sent once.
// Tokens are signed with a key derived from APP_PASSWORD, so changing the password logs everyone out.

import { json } from './http.js';

const TOKEN_DAYS = 180;
const enc = new TextEncoder();

function b64url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function key() {
  const material = `${process.env.APP_PASSWORD}::${process.env.AUTH_SECRET || 'model-router'}`;
  return crypto.subtle.importKey('raw', enc.encode(material), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

// Compares two strings without leaking where they differ.
export async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function issueToken() {
  const payload = b64url(enc.encode(JSON.stringify({ v: 1, exp: Date.now() + TOKEN_DAYS * 86400000 })));
  const sig = b64url(await crypto.subtle.sign('HMAC', await key(), enc.encode(payload)));
  return `${payload}.${sig}`;
}

// Returns an error Response when the request isn't signed in, otherwise null.
export async function requireAuth(request) {
  if (!process.env.APP_PASSWORD) {
    return json({ error: 'APP_PASSWORD is not set in Vercel. Add it under Settings → Environment Variables and redeploy.' }, 500);
  }
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const [payload, sig] = token.split('.');
  if (payload && sig) {
    try {
      const ok = await crypto.subtle.verify('HMAC', await key(), fromB64url(sig), enc.encode(payload));
      const { exp } = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
      if (ok && exp > Date.now()) return null;
    } catch {
      // Fall through to the error below.
    }
  }
  return json({ error: 'Please sign in again.' }, 401);
}
