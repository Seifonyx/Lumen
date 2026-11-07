// Offline native demo account adapter. No Firebase SDK, OAuth or remote account IO.
import { normalizeKeys } from '../../src/lib/ai/provider-config.js';
import type { ApiKeys as CanonicalApiKeys } from '../../src/lib/firebase';

export type ApiKeys = CanonicalApiKeys;
export interface PreviewUser { uid: string; email: string; displayName: string; photoURL: string }

/** Not a credential: a fixed label the synthetic transport accepts and no real provider would. */
export const SYNTHETIC_KEY = 'native-demo-not-a-real-key';
const PREVIEW_KEY = 'mr.preview_user';

let session: PreviewUser | null = null;
/** Select one of the two public local demo profiles. */
export function selectDemo(namespace: string): PreviewUser {
  if (!['a','b'].includes(namespace)) throw new Error('Unknown demo profile');
  session = { uid: `preview-native-demo-${namespace}`, email: `demo-${namespace}@synthetic.invalid`, displayName: `Demo ${namespace.toUpperCase()}`, photoURL: '' };
  return session;
}

try {
  const prior = JSON.parse(localStorage.getItem(PREVIEW_KEY) || 'null');
  if (prior?.uid === 'preview-native-demo-a') selectDemo('a');
  if (prior?.uid === 'preview-native-demo-b') selectDemo('b');
} catch { /* no saved demo */ }

export const auth = Object.freeze({ currentUser: null });
export const db = Object.freeze({ type: 'native-demo' });

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
  throw new Error('Google sign-in is disabled in this offline native demo. Use the synthetic account.');
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
  throw new Error('Saving provider keys is disabled in this offline native demo. No real keys are used here.');
}
