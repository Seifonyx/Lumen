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
  previewListeners.push(cb);
  const stored = getStoredPreviewUser();
  if (stored) {
    setTimeout(() => cb(stored), 0);
  }
  const unsub = onAuthStateChanged(auth, (user) => {
    if (getStoredPreviewUser()) return;
    cb(user);
  });
  return () => {
    previewListeners = previewListeners.filter((l) => l !== cb);
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
  /** Explicit consent to credit-consuming or billable APIs; disabled by default. */
  providerAccess?: Partial<Record<keyof typeof EXTRA_PROVIDERS, boolean>>;
  cloudflareAccountId?: string;
  alibabaBaseUrl?: string;
  providerRelayUrl?: string;
}

const keysDoc = (uid: string) => doc(db, 'modelRouter', uid);

// A copy of keys and settings stays on the device so the app also opens without a connection.
const localKey = (uid: string) => `mr.account.${uid}`;
type Account = { geminiKey?: string; openrouterKey?: string; groqKey?: string; cerebrasKey?: string; githubKey?: string; providerConnections?: Partial<ApiKeys>; settings?: Record<string, unknown> };
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
  } catch {
    /* private mode */
  }
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
let accountRead: { uid: string; at: number; data: Promise<Account> } | null = null;
function readAccount(uid: string): Promise<Account> {
  if (!accountRead || accountRead.uid !== uid || Date.now() - accountRead.at > 5000) {
    accountRead = { uid, at: Date.now(), data: fetchAccount(uid) };
  }
  return accountRead.data;
}

async function fetchAccount(uid: string): Promise<Account> {
  const saved = localAccount(uid);
  if (isPreviewUser(uid)) {
    return saved || { geminiKey: '', openrouterKey: '', groqKey: '', cerebrasKey: '', githubKey: '', settings: {} };
  }
  if (!navigator.onLine && saved) return saved;
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(Object.assign(new Error('offline'), { code: 'unavailable' })), saved ? 8000 : 20000));
    const snap = (await Promise.race([getDoc(keysDoc(uid)), timeout])) as DocumentSnapshot;
    quota.count('reads');
    const d = (snap.data() || {}) as Account;
    keepLocal(uid, { geminiKey: d.geminiKey || '', openrouterKey: d.openrouterKey || '', groqKey: d.groqKey || '', cerebrasKey: d.cerebrasKey || '', githubKey: d.githubKey || '', providerConnections: d.providerConnections || {}, settings: d.settings });
    return d;
  } catch (e) {
    if (saved) return saved;
    if (isPreviewUser(uid)) return { geminiKey: '', openrouterKey: '', groqKey: '', cerebrasKey: '', githubKey: '', settings: {} };
    // Not invited: never fall back to the saved copy.
    if ((e as { code?: string }).code === 'permission-denied' || !saved) throw e;
    return saved;
  }
}

export async function loadKeys(uid: string): Promise<ApiKeys> {
  const d = await readAccount(uid);
  return normalizeKeys({ ...d.providerConnections, gemini: d.geminiKey || '', openrouter: d.openrouterKey || '', groq: d.groqKey || '', cerebras: d.cerebrasKey || '', github: d.githubKey || '' }) as unknown as ApiKeys;
}

/** Settings shared across devices (model list, instructions, appearance). */
export function cacheAccountSettings(uid: string, settings: object): void {
  keepLocal(uid, { settings: settings as Record<string, unknown> });
}

export async function loadRemoteSettings(uid: string): Promise<Record<string, unknown> | null> {
  return (await readAccount(uid)).settings || null;
}

export async function saveRemoteSettings(uid: string, settings: object): Promise<void> {
  quota.count('writes');
  keepLocal(uid, { settings: settings as Record<string, unknown> });
  if (isPreviewUser(uid)) return;
  try {
    await setDoc(keysDoc(uid), { settings, updatedAt: serverTimestamp() }, { merge: true });
  } catch {
    /* ignore Firestore errors in preview/offline */
  }
}

export async function saveKeys(uid: string, keys: ApiKeys): Promise<void> {
  accountRead = null;
  quota.count('writes');
  const clean = normalizeKeys(keys) as unknown as ApiKeys;
  const providerConnections: Partial<ApiKeys> = {
    ...Object.fromEntries(Object.keys(EXTRA_PROVIDERS).map(id => [id, clean[id as keyof typeof EXTRA_PROVIDERS]])),
    providerAccess: clean.providerAccess, cloudflareAccountId: clean.cloudflareAccountId,
    alibabaBaseUrl: clean.alibabaBaseUrl, providerRelayUrl: clean.providerRelayUrl,
  };
  const fields = { geminiKey: clean.gemini, openrouterKey: clean.openrouter, groqKey: clean.groq, cerebrasKey: clean.cerebras, githubKey: clean.github, providerConnections };
  keepLocal(uid, fields);
  if (isPreviewUser(uid)) return;
  try {
    await setDoc(keysDoc(uid), { ...fields, updatedAt: serverTimestamp() }, { merge: true });
  } catch {
    /* ignore Firestore errors in preview/offline */
  }
}
