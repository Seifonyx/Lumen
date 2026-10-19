// Firebase: Google sign-in and the user's private settings document (API keys).

import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider, browserLocalPersistence, connectAuthEmulator, getAuth, getRedirectResult, onAuthStateChanged, setPersistence,
  signInWithCredential, signInWithPopup, signInWithRedirect, signOut, type User,
} from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, initializeFirestore, serverTimestamp, setDoc, type DocumentSnapshot } from 'firebase/firestore';
import config from '../firebase-config.json';
import { quota } from './quota';
import { EXTRA_PROVIDERS, normalizeKeys } from './ai/provider-config.js';
import { createAccountKeyPersistence, type AccountKeyCache } from './account-key-persistence';
import { createAccountSettingsPersistence } from './account-settings-persistence';

// Sign-in runs through the app's own address where Google allows it. Phones (Safari, home-screen
// apps) block the cross-site storage that sign-in through the-model-router.firebaseapp.com needs.
// A host is listed here only after https://<host>/__/auth/handler was added to the OAuth client's
// authorized redirect URIs in Google Cloud (otherwise Google refuses the sign-in).
// lumen-chat.web.app is the app's address; model-router.web.app is the old one (it now forwards), and
// the third is the preview address for trying updates first (npm run deploy:preview).
const SAME_SITE_AUTH_HOSTS: string[] = ['lumen-chat.web.app', 'model-router.web.app', 'model-router--dev-82jv5mm2.web.app'];
// Anywhere else (localhost while developing) signs in through the live site's handler too: it's the
// one Google allows, and the sign-in popup works across sites.
const sameSite = SAME_SITE_AUTH_HOSTS.includes(location.hostname);
const app = initializeApp({ ...config, authDomain: sameSite ? location.hostname : SAME_SITE_AUTH_HOSTS[0] });
export const auth = getAuth(app);
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

// Local testing only: http://localhost…/?emulator connects to the Firebase emulators instead of the real project.
if (location.hostname === 'localhost' && new URLSearchParams(location.search).has('emulator')) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  // Lets automated tests sign in without the Google popup (the emulator accepts unsigned test tokens).
  (window as unknown as Record<string, unknown>).__testSignIn = (email: string) =>
    signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true })));
}
void setPersistence(auth, browserLocalPersistence);

export interface PreviewUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

const PREVIEW_KEY = 'mr.preview_user';

export function isPreviewUser(uid?: string | null): boolean {
  return Boolean(uid && uid.startsWith('preview-'));
}

export function getStoredPreviewUser(): PreviewUser | null {
  try {
    const raw = localStorage.getItem(PREVIEW_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let accountSession=0;
let previewListeners: Array<(user: User | PreviewUser | null) => void> = [];

export function signInPreview(email = 'preview@local.user', name = 'Guest'): PreviewUser {
  const user: PreviewUser = {
    uid: `preview-${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    email,
    displayName: name,
    photoURL: '',
  };
  try {
    localStorage.setItem(PREVIEW_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
  previewListeners.forEach((fn) => fn(user));
  return user;
}

export function watchUser(cb: (user: User | PreviewUser | null) => void) {
  // Finishes a redirect sign-in if one was in progress (used when popups are blocked).
  getRedirectResult(auth).catch((e) => {
    redirectError = friendly(e);
  });
  const deliver = (user: User | PreviewUser | null) => {accountSession++;cb(user);};
  previewListeners.push(deliver);
  const stored = getStoredPreviewUser();
  if (stored) {
    setTimeout(() => deliver(stored), 0);
  }
  const unsub = onAuthStateChanged(auth, (user) => {
    if (getStoredPreviewUser()) return;
    deliver(user);
  });
  return () => {
    previewListeners = previewListeners.filter((l) => l !== deliver);
    unsub();
  };
}

let redirectError = '';
/** An error from a sign-in that came back through a redirect (shown on the sign-in page). */
export function takeRedirectError() {
  const e = redirectError;
  redirectError = '';
  return e;
}

/** Installed to the home screen (or another app-like window), where pop-ups don't work well. */
const standalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function friendly(e: unknown): string {
  const code = (e as { code?: string }).code || '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/redirect-cancelled-by-user') return 'Sign-in was closed before it finished.';
  if (code === 'auth/network-request-failed') return "Couldn't reach Google. Check your connection and try again.";
  if (code === 'auth/unauthorized-domain') return "This address isn't allowed to sign in yet.";
  return (e as Error).message.replace(/^Firebase:\s*/, '');
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  // Home-screen apps and iPhones: full-page redirect (pop-ups open in a separate browser there and
  // often never report back). It needs same-site sign-in, so only where that's switched on.
  if (sameSite && (standalone() || isIOS())) {
    await signInWithRedirect(auth, provider);
    return;
  }
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code || '';
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(code)) {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw new Error(friendly(e));
  }
}

export const signOutUser = async () => {
  try {
    localStorage.removeItem(PREVIEW_KEY);
  } catch {
    /* ignore */
  }
  previewListeners.forEach((fn) => fn(null));
  await signOut(auth);
};

export interface ApiKeys {
  gemini: string;
  openrouter: string;
  groq: string;
  cerebras: string;
  /** GitHub token for the coding workspace */
  github: string;
  mistral?: string;
  cohere?: string;
  nvidia?: string;
  huggingface?: string;
  deepseek?: string;
  alibaba?: string;
  cloudflare?: string;
  aion?: string;
  openai?: string;
  anthropic?: string;
  xai?: string;
  perplexity?: string;
  together?: string;
  fireworks?: string;
  deepinfra?: string;
  sambanova?: string;
  novita?: string;
  hyperbolic?: string;
  nebius?: string;
  scaleway?: string;
  ovh?: string;
  siliconflow?: string;
  chutes?: string;
  featherless?: string;
  zai?: string;
  moonshot?: string;
  venice?: string;
  baseten?: string;
  /** Explicit consent to credit-consuming or billable APIs; disabled by default. */
  providerAccess?: Partial<Record<keyof typeof EXTRA_PROVIDERS, boolean>>;
  cloudflareAccountId?: string;
  alibabaBaseUrl?: string;
  providerRelayUrl?: string;
}

const keysDoc = (uid: string) => doc(db, 'modelRouter', uid);

// A copy of keys and settings stays on the device so the app also opens without a connection.
const localKey = (uid: string) => `mr.account.${uid}`;
type Account = AccountKeyCache;
function localAccount(uid: string): Account | null {
  try {
    return JSON.parse(localStorage.getItem(localKey(uid)) || 'null');
  } catch {
    return null;
  }
}
function keepLocal(uid: string, patch: Account) {
  try {
    localStorage.setItem(localKey(uid), JSON.stringify({ ...(localAccount(uid) || {}), ...patch }));
    return true;
  } catch {
    return false;
  }
}

const deniedAccounts = new Set<string>();
const denialListeners = new Set<(uid: string) => void>();
export function watchAccountAccessDenied(listener: (uid: string) => void): void {denialListeners.add(listener);}
function denyAccount(uid: string): void {
  deniedAccounts.add(uid);
  accountRead = null;
  forgetLocalAccount(uid);
  denialListeners.forEach(listener=>listener(uid));
}
const accountKeyPersistence = createAccountKeyPersistence({
  readLocal: localAccount, writeLocal: keepLocal,
  onRemoteDenied: denyAccount,
  currentSession: () => accountSession,
  currentUid: () => getStoredPreviewUser()?.uid || auth.currentUser?.uid || null,
  isPreview: isPreviewUser,
  enqueueRemote: (uid, fields) => {
    quota.count('writes');
    return setDoc(keysDoc(uid), { ...fields, updatedAt: serverTimestamp() }, { merge: true });
  },
});

const accountSettingsPersistence = createAccountSettingsPersistence({
  readLocal: localAccount, writeLocal: keepLocal,
  currentUid: () => getStoredPreviewUser()?.uid || auth.currentUser?.uid || null,
  currentSession: () => accountSession, isDenied: uid => deniedAccounts.has(uid),
  isPreview: isPreviewUser, onRemoteDenied: denyAccount,
  enqueueRemote: (uid, settings) => {
    quota.count('writes');
    return setDoc(keysDoc(uid), { settings, updatedAt: serverTimestamp() }, { mergeFields: ['settings','updatedAt'] });
  },
});

/** Authenticated recovery for both independent pending fields; no automatic retry loop. */
export function resumePendingAccountWrites(uid: string): void {
  if(deniedAccounts.has(uid))return;
  accountKeyPersistence.resume(uid);accountSettingsPersistence.resume(uid);
}

/** Retry durable pending keys only for the active, non-denied account. SDK owns transport retries. */
export function resumePendingAccountKeys(uid: string): void {
  if (!deniedAccounts.has(uid)) accountKeyPersistence.resume(uid);
}

/** Removes this device's copy (on sign-out). */
export function forgetLocalAccount(uid: string) {
  try {
    localStorage.removeItem(localKey(uid));
  } catch {
    /* ignore */
  }
}

// Keys and settings live in the same document: read it once when both are loaded together.
let accountRead: { uid: string; session: number; at: number; data: Promise<Account> } | null = null;
function readAccount(uid: string): Promise<Account> {
  if (!accountRead || accountRead.uid !== uid || accountRead.session !== accountSession || Date.now() - accountRead.at > 5000) {
    accountRead = { uid, session: accountSession, at: Date.now(), data: fetchAccount(uid) };
  }
  return accountRead.data;
}

async function fetchAccount(uid: string): Promise<Account> {
  const saved = localAccount(uid);
  if (isPreviewUser(uid)) return saved || {};
  if (deniedAccounts.has(uid) && !navigator.onLine) throw Object.assign(new Error('Account access was denied.'), {code:'permission-denied'});
  if (!navigator.onLine && saved) return saved;
  const start = accountKeyPersistence.captureRead(uid);
  const settingsStart = accountSettingsPersistence.captureRead(uid);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {timer=setTimeout(() => reject(Object.assign(new Error('offline'), { code: 'unavailable' })), saved ? 8000 : 20000);});
    const snap = (await Promise.race([getDoc(keysDoc(uid)), timeout])) as DocumentSnapshot;
    if(start.session!==accountSession || auth.currentUser?.uid!==uid)throw new Error('The account changed during this read.');
    quota.count('reads');
    if (!snap.metadata.fromCache) deniedAccounts.delete(uid);
    if (deniedAccounts.has(uid)) throw Object.assign(new Error('Account access was denied.'), {code:'permission-denied'});
    const remote=(snap.data() || {}) as Account;
    const settings=accountSettingsPersistence.reconcileRead(uid,settingsStart,remote.settings);
    const result=accountKeyPersistence.reconcileRead(uid,start,{...remote,settings:settings || undefined});
    resumePendingAccountWrites(uid);
    return result;
  } catch (e) {
    // An explicit access denial must never turn into an offline-cache login or replay.
    if ((e as {code?:string}).code === 'permission-denied') {
      if(start.session===accountSession && auth.currentUser?.uid===uid)denyAccount(uid);
      throw e;
    }
    // Re-read: a newer local save may have happened while the network was pending.
    const latest=localAccount(uid);
    if (latest && start.session===accountSession && (getStoredPreviewUser()?.uid || auth.currentUser?.uid) === uid && !deniedAccounts.has(uid)) {
      resumePendingAccountWrites(uid);
      return latest;
    }
    throw e;
  } finally {clearTimeout(timer);}
}

/** This device's saved copy of the account (keys and settings), so the app can open at once while the fresh
 *  copy loads. Null the first time on a device, and for the preview account. */
export function savedAccount(uid: string): { keys: ApiKeys; settings: Record<string, unknown> | null } | null {
  if (isPreviewUser(uid)) return null;
  const d = localAccount(uid);
  if (!d) return null;
  return { keys: normalizeKeys({ ...d.providerConnections, gemini: d.geminiKey || '', openrouter: d.openrouterKey || '', groq: d.groqKey || '', cerebras: d.cerebrasKey || '', github: d.githubKey || '' }) as unknown as ApiKeys, settings: d.settings || null };
}

export async function loadKeys(uid: string): Promise<ApiKeys> {
  const d = await readAccount(uid);
  return normalizeKeys({ ...d.providerConnections, gemini: d.geminiKey || '', openrouter: d.openrouterKey || '', groq: d.groqKey || '', cerebras: d.cerebrasKey || '', github: d.githubKey || '' }) as unknown as ApiKeys;
}

/** Settings shared across devices (model list, instructions, appearance). */
export function cacheAccountSettings(uid: string, settings: object): boolean {
  try {accountSettingsPersistence.stage(uid,settings);return true;} catch {return false;}
}

export async function loadRemoteSettings(uid: string): Promise<Record<string, unknown> | null> {
  return (await readAccount(uid)).settings || null;
}

/** Resolves after local durability + SDK enqueue, without waiting for a server ACK. */
export async function saveRemoteSettings(uid: string, settings: object): Promise<void> {
  accountSettingsPersistence.stage(uid,settings);
  accountSettingsPersistence.flush(uid);
}

/** Resolves after durable local save and SDK enqueue, independently of server acknowledgement. */
export async function saveKeys(uid: string, keys: ApiKeys): Promise<void> {
  if (deniedAccounts.has(uid)) throw new Error('Account access was denied. Sign in again before saving keys.');
  accountKeyPersistence.save(uid,keys);
  accountRead = null;
}
