// "Delete my account and data": removes everything the app stores for an account, in the cloud and on
// this device, then the sign-in record itself. Firestore has no "delete with sub-collections" from a
// browser, so each collection is listed and removed in batches.
import { deleteUser, GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs, query, where, writeBatch, type DocumentReference } from 'firebase/firestore';
import { auth, db } from './firebase';

const SUBCOLLECTIONS = ['files', 'memory', 'memories', 'usage', 'tasks'];

async function removeAll(refs: DocumentReference[]) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    refs.slice(i, i + 400).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}

/** Deletes the account's cloud data (chats, messages, files, memory, usage, tasks, keys, settings, share links). */
export async function deleteCloudData(uid: string) {
  const root = doc(db, 'modelRouter', uid);
  const chats = await getDocs(collection(root, 'chats'));
  for (const chat of chats.docs) await removeAll((await getDocs(collection(chat.ref, 'messages'))).docs.map((d) => d.ref));
  await removeAll(chats.docs.map((d) => d.ref));
  for (const name of SUBCOLLECTIONS) await removeAll((await getDocs(collection(root, name))).docs.map((d) => d.ref));
  await removeAll((await getDocs(query(collection(db, 'modelRouterShares'), where('owner', '==', uid)))).docs.map((d) => d.ref));
  await deleteDoc(root);
}

/** Deletes what this device keeps for the account: its databases and saved settings. */
export async function deleteLocalData(uid: string) {
  for (const name of [`model-router-account-${uid}`, `model-router-tasks-${uid}`]) {
    await new Promise<void>((done) => { try { const r = indexedDB.deleteDatabase(name); r.onsuccess = r.onerror = r.onblocked = () => done(); } catch { done(); } });
  }
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('mr.') && (key.includes(uid) || !key.startsWith('mr.account.'))) localStorage.removeItem(key);
  } catch { /* private mode */ }
}

/** Removes the sign-in record. Google asks to confirm the account again if the last sign-in was a while ago. */
export async function deleteSignIn(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  try {
    await deleteUser(user);
    return true;
  } catch (e) {
    if ((e as { code?: string }).code !== 'auth/requires-recent-login') return false;
    try {
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
      await deleteUser(user);
      return true;
    } catch {
      return false;
    }
  }
}
