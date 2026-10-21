// Synthetic QA build only: the review lease. The gate answers `./__lease` only while this reviewer may
// still use this exact build; any other answer locks the app. Checked at start, every 60 seconds, when
// the page returns to view, and before each synthetic reply.

import { nativeFetch } from './native-fetch';

export interface Lease { buildId: string; namespace: string; expiresAt: number; now: number }

const LEASE_URL = new URL('./__lease', document.baseURI).href;
let locked = false;
const lockListeners = new Set<(reason: string) => void>();

export async function readLease(): Promise<Lease | null> {
  try {
    const response = await nativeFetch(LEASE_URL, { credentials: 'same-origin', cache: 'no-store', redirect: 'error' });
    if (!response.ok) return null;
    const lease = (await response.json()) as Lease;
    const valid = /^[0-9a-f]{40}-\d+-\d+$/.test(lease.buildId) && /^[0-9a-f]{32}$/.test(lease.namespace) && Number.isFinite(lease.expiresAt) && lease.expiresAt > lease.now;
    return valid ? lease : null;
  } catch {
    return null;
  }
}

export function lock(reason: string) {
  if (locked) return;
  locked = true;
  lockListeners.forEach((fn) => fn(reason));
}
export const isLocked = () => locked;
export function onLock(listener: (reason: string) => void) { lockListeners.add(listener); }

/** True only when the gate still admits this build now; otherwise locks and returns false. */
export async function ensureLease(): Promise<boolean> {
  if (locked) return false;
  const lease = await readLease();
  if (!lease) lock('This review build has expired or access was removed.');
  return Boolean(lease) && !locked;
}

export function watchLease(intervalMs = 60_000) {
  const check = () => { void ensureLease(); };
  setInterval(check, intervalMs);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('focus', check);
  window.addEventListener('pageshow', check);
}
