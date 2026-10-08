// Firebase: Google sign-in and the user's private settings document (API keys).

import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider, browserLocalPersistence, connectAuthEmulator, getAuth, getRedirectResult, onAuthStateChanged, setPersistence,
  signInWithCredential, signInWithPopup, signInWithRedirect, signOut, type User,
} from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, initializeFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import config from '../firebase-config.json';

const app = initializeApp(config);
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
  getRedirectResult(auth).catch(() => {});
  return onAuthStateChanged(auth, cb);
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code || '';
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(code)) {
      await signInWithRedirect(auth, provider);
      return;
    }
    if (code === 'auth/popup-closed-by-user') throw new Error('Sign-in was closed before it finished.');
    throw new Error((e as Error).message.replace(/^Firebase:\s*/, ''));
  }
}

export const signOutUser = () => signOut(auth);

export interface ApiKeys {
  gemini: string;
  openrouter: string;
}

const keysDoc = (uid: string) => doc(db, 'modelRouter', uid);

export async function loadKeys(uid: string): Promise<ApiKeys> {
  const snap = await getDoc(keysDoc(uid));
  const d = snap.data() || {};
  return { gemini: d.geminiKey || '', openrouter: d.openrouterKey || '' };
}

/** Settings shared across devices (model list, instructions, appearance). */
export async function loadRemoteSettings(uid: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(keysDoc(uid));
  return (snap.data()?.settings as Record<string, unknown>) || null;
}

export async function saveRemoteSettings(uid: string, settings: object): Promise<void> {
  await setDoc(keysDoc(uid), { settings, updatedAt: serverTimestamp() }, { merge: true });
}

export async function saveKeys(uid: string, keys: ApiKeys): Promise<void> {
  await setDoc(keysDoc(uid), { geminiKey: keys.gemini.trim(), openrouterKey: keys.openrouter.trim(), updatedAt: serverTimestamp() }, { merge: true });
}
