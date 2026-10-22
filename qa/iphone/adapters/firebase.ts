// Synthetic QA build only: replaces src/lib/firebase.ts with the same exports and no Firebase at all.
// The only account is the synthetic `preview-qa-<namespace>` user the gate's lease names for this
// reviewer and build. Keys are fixed synthetic placeholders that unlock the local synthetic provider;
// saving keys and Google sign-in are refused. Settings stay on this device under the canonical key.

import { normalizeKeys } from '../../../src/lib/ai/provider-config.js';
import type { ApiKeys as CanonicalApiKeys } from '../../../src/lib/firebase';

export type ApiKeys = CanonicalApiKeys;
export interface PreviewUser { uid: string; email: string; displayName: string; photoURL: string }

/** Not a credential: a fixed label the synthetic transport accepts and no real provider would. */
export const SYNTHETIC_KEY = 'qa-synthetic-not-a-real-key';
const PREVIEW_KEY = 'mr.preview_user';

let session: PreviewUser | null = null;
/** Called once by the QA entry, before the app mounts, with the gate-issued namespace. */
export function configureQaAccount(namespace: string): PreviewUser {
  if (!/^[0-9a-f]{32}$/.test(namespace)) throw new Error('Invalid review namespace.');
  session = { uid: `preview-qa-${namespace}`, email: 'reviewer@synthetic.invalid', displayName: 'Synthetic reviewer', photoURL: '' };
  return session;
}

export const auth = Object.freeze({ currentUser: null });
export const db = Object.freeze({ type: 'qa-synthetic' });

export function isPreviewUser(uid?: string | null): boolean {
  return Boolean(uid && uid.startsWith('preview-'));
}

export function getStoredPreviewUser(): PreviewUser | null {
  try {
    const stored = JSON.parse(localStorage.getItem(PREVIEW_KEY) || 'null') as PreviewUser | null;
    return stored && session && stored.uid === session.uid ? stored : null;
  } catch {
    return null;
  }
}

let listeners: Array<(user: PreviewUser | null) => void> = [];
const notify = (user: PreviewUser | null) => listeners.forEach((fn) => fn(user));

/** The sandbox button signs back in as this review's synthetic account, whatever email it passes. */
export function signInPreview(_email?: string, _name?: string): PreviewUser {
  if (!session) throw new Error('This review build has not been authorised.');
  try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(session)); } catch { /* private mode */ }
  notify(session);
  return session;
}

export function watchUser(cb: (user: PreviewUser | null) => void) {
  listeners.push(cb);
  const user = getStoredPreviewUser();
  setTimeout(() => cb(user), 0);
  return () => { listeners = listeners.filter((l) => l !== cb); };
}

export const takeRedirectError = () => '';

export async function signInWithGoogle(): Promise<void> {
  throw new Error('Google sign-in is disabled in this synthetic review build. Use the synthetic account.');
}

export const signOutUser = async () => {
  try { localStorage.removeItem(PREVIEW_KEY); } catch { /* private mode */ }
  notify(null);
};

export function watchAccountAccessDenied(_listener: (uid: string) => void): void {}
export function resumePendingAccountWrites(_uid: string): void {}
export function resumePendingAccountKeys(_uid: string): void {}

const localKey = (uid: string) => `mr.account.${uid}`;
function local(uid: string): { settings?: Record<string, unknown> } {
  try { return JSON.parse(localStorage.getItem(localKey(uid)) || '{}') || {}; } catch { return {}; }
}

export function forgetLocalAccount(uid: string) {
  try { localStorage.removeItem(localKey(uid)); } catch { /* private mode */ }
}

/** Like canonical preview accounts: no instant-open copy. */
export function savedAccount(_uid: string): { keys: ApiKeys; settings: Record<string, unknown> | null } | null {
  return null;
}

export async function loadKeys(_uid: string): Promise<ApiKeys> {
  return normalizeKeys({ gemini: SYNTHETIC_KEY, openrouter: '', groq: '', cerebras: '', github: '' }) as unknown as ApiKeys;
}

export function cacheAccountSettings(uid: string, settings: object): boolean {
  try { localStorage.setItem(localKey(uid), JSON.stringify({ ...local(uid), settings })); return true; } catch { return false; }
}

export async function loadRemoteSettings(uid: string): Promise<Record<string, unknown> | null> {
  return local(uid).settings || null;
}

export async function saveRemoteSettings(uid: string, settings: object): Promise<void> {
  cacheAccountSettings(uid, settings);
}

export async function saveKeys(_uid: string, _keys: ApiKeys): Promise<void> {
  throw new Error('Saving provider keys is disabled in this synthetic review build. No real keys are used here.');
}
