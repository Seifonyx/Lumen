// Firebase: Google sign-in and the user's private settings document (API keys).

import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider, browserLocalPersistence, connectAuthEmulator, getAuth, getRedirectResult, onAuthStateChanged, setPersistence,
  signInWithCredential, signInWithPopup, signInWithRedirect, signOut, type User,
} from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, initializeFirestore, serverTimestamp, setDoc, type DocumentSnapshot } from 'firebase/firestore';
import config from '../firebase-config.json';
import { quota } from './quota';

// Sign-in runs through the app's own address where Google allows it. Phones (Safari, home-screen
// apps) block the cross-site storage that sign-in through the-model-router.firebaseapp.com needs.
// A host is listed here only after https://<host>/__/auth/handler was added to the OAuth client's
// authorized redirect URIs in Google Cloud (otherwise Google refuses the sign-in).
const SAME_SITE_AUTH_HOSTS: string[] = [];
const sameSite = SAME_SITE_AUTH_HOSTS.includes(location.hostname);
const app = initializeApp(sameSite ? { ...config, authDomain: location.hostname } : config);
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

export function watchUser(cb: (user: User | null) => void) {
  // Finishes a redirect sign-in if one was in progress (used when popups are blocked).
  getRedirectResult(auth).catch((e) => {
    redirectError = friendly(e);
  });
  return onAuthStateChanged(auth, cb);
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

export const signOutUser = () => signOut(auth);

export interface ApiKeys {
  gemini: string;
  openrouter: string;
}

const keysDoc = (uid: string) => doc(db, 'modelRouter', uid);

// A copy of keys and settings stays on the device so the app also opens without a connection.
const localKey = (uid: string) => `mr.account.${uid}`;
type Account = { geminiKey?: string; openrouterKey?: string; settings?: Record<string, unknown> };
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
  if (!navigator.onLine && saved) return saved;
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(Object.assign(new Error('offline'), { code: 'unavailable' })), saved ? 8000 : 20000));
    const snap = (await Promise.race([getDoc(keysDoc(uid)), timeout])) as DocumentSnapshot;
    quota.count('reads');
    const d = (snap.data() || {}) as Account;
    keepLocal(uid, { geminiKey: d.geminiKey || '', openrouterKey: d.openrouterKey || '', settings: d.settings });
    return d;
  } catch (e) {
    // Not invited: never fall back to the saved copy.
    if ((e as { code?: string }).code === 'permission-denied' || !saved) throw e;
    return saved;
  }
}

export async function loadKeys(uid: string): Promise<ApiKeys> {
  const d = await readAccount(uid);
  return { gemini: d.geminiKey || '', openrouter: d.openrouterKey || '' };
}

/** Settings shared across devices (model list, instructions, appearance). */
export async function loadRemoteSettings(uid: string): Promise<Record<string, unknown> | null> {
  return (await readAccount(uid)).settings || null;
}

export async function saveRemoteSettings(uid: string, settings: object): Promise<void> {
  quota.count('writes');
  keepLocal(uid, { settings: settings as Record<string, unknown> });
  await setDoc(keysDoc(uid), { settings, updatedAt: serverTimestamp() }, { merge: true });
}

export async function saveKeys(uid: string, keys: ApiKeys): Promise<void> {
  quota.count('writes');
  keepLocal(uid, { geminiKey: keys.gemini.trim(), openrouterKey: keys.openrouter.trim() });
  await setDoc(keysDoc(uid), { geminiKey: keys.gemini.trim(), openrouterKey: keys.openrouter.trim(), updatedAt: serverTimestamp() }, { merge: true });
}
