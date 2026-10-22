// Synthetic QA build only: stands in for `firebase/app`, `firebase/auth` and `firebase/firestore`, so no
// Firebase SDK, configuration or connection can exist in this build. Reference builders are inert; every
// read, write, listener, transaction and sign-in refuses. Canonical code already keeps `preview-`
// accounts on the device, so in normal use nothing reaches these refusals; anything that does is
// counted on `window.__qaDisabledCalls` and fails visibly instead of silently pretending to succeed.

type Inert = { readonly path: string; readonly id: string };

const disabledCalls: string[] = [];
(globalThis as { __qaDisabledCalls?: string[] }).__qaDisabledCalls = disabledCalls;

function disabled(name: string): Error {
  disabledCalls.push(name);
  return Object.assign(new Error('Cloud sync and sign-in are disabled in this synthetic review build.'), { code: 'unavailable', name: 'QaDisabled' });
}
const refuse = (name: string) => (..._args: unknown[]): Promise<never> => Promise.reject(disabled(name));
const ref = (...parts: unknown[]): Inert => {
  const path = parts.filter((p) => typeof p === 'string').join('/');
  return Object.freeze({ path, id: path.split('/').pop() || '' });
};
const sentinel = (kind: string) => Object.freeze({ __qaSentinel: kind });

// firebase/app
export const initializeApp = () => Object.freeze({ name: 'qa-synthetic' });

// firebase/auth
export const getAuth = () => Object.freeze({ currentUser: null });
export const browserLocalPersistence = sentinel('persistence');
export const setPersistence = () => Promise.resolve();
export const connectAuthEmulator = () => { throw disabled('connectAuthEmulator'); };
export const onAuthStateChanged = () => () => {};
export const getRedirectResult = () => Promise.resolve(null);
export const signInWithPopup = refuse('signInWithPopup');
export const signInWithRedirect = refuse('signInWithRedirect');
export const signInWithCredential = refuse('signInWithCredential');
export const signOut = () => Promise.resolve();
export const deleteUser = refuse('deleteUser');
export const reauthenticateWithPopup = refuse('reauthenticateWithPopup');
export class GoogleAuthProvider {
  static credential() { throw disabled('GoogleAuthProvider.credential'); }
  setCustomParameters() { return this; }
}

// firebase/firestore
export const initializeFirestore = () => Object.freeze({ type: 'qa-synthetic' });
export const connectFirestoreEmulator = () => { throw disabled('connectFirestoreEmulator'); };
export const doc = ref;
export const collection = ref;
export const query = (base: Inert) => base;
export const where = () => sentinel('where');
export const orderBy = () => sentinel('orderBy');
export const serverTimestamp = () => sentinel('serverTimestamp');
export const deleteField = () => sentinel('deleteField');
export const increment = () => sentinel('increment');
export const getDoc = refuse('getDoc');
export const getDocs = refuse('getDocs');
export const setDoc = refuse('setDoc');
export const updateDoc = refuse('updateDoc');
export const deleteDoc = refuse('deleteDoc');
export const runTransaction = refuse('runTransaction');
export function writeBatch() {
  const batch = { set: () => batch, update: () => batch, delete: () => batch, commit: refuse('writeBatch.commit') };
  return batch;
}
export function onSnapshot(_target: unknown, ...handlers: unknown[]) {
  const onError = handlers.find((h, i) => i > 0 && typeof h === 'function') as ((e: Error) => void) | undefined;
  const error = disabled('onSnapshot');
  queueMicrotask(() => onError?.(error));
  return () => {};
}
export class Timestamp {
  constructor(readonly seconds: number, readonly nanoseconds: number) {}
  static fromMillis(ms: number) { return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); }
  static now() { return Timestamp.fromMillis(Date.now()); }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
}
