// Firebase: Google sign-in and the user's private settings document (API keys).

import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider, browserLocalPersistence, getAuth, getRedirectResult, onAuthStateChanged, setPersistence,
  signInWithPopup, signInWithRedirect, signOut, type User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import config from '../firebase-config.json';

const app = initializeApp(config);
export const auth = getAuth(app);
const db = getFirestore(app);
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

export async function saveKeys(uid: string, keys: ApiKeys): Promise<void> {
  await setDoc(keysDoc(uid), { geminiKey: keys.gemini.trim(), openrouterKey: keys.openrouter.trim(), updatedAt: serverTimestamp() }, { merge: true });
}
