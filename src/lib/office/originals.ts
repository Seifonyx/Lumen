// Original Word/Excel files kept on this device so the app can edit them in place later.
// Stored per account in IndexedDB; never synced (the chat only syncs the extracted text).

const MAX_BYTES = 25 * 1024 * 1024;
const open = (account: string) => new Promise<IDBDatabase>((resolve, reject) => {
  const req = indexedDB.open(`model-router-originals-${account}`, 1);
  req.onupgradeneeded = () => req.result.createObjectStore('files');
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
const run = async <T,>(account: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>) => {
  const db = await open(account);
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction('files', mode).objectStore('files'));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
};

export const isEditableOffice = (name: string) => /\.(docx|xlsx|xlsm)$/i.test(name);

/** Keeps the original bytes of an attached Word/Excel file (best effort; editing just becomes unavailable if this fails). */
export async function saveOriginal(account: string | undefined, id: string, file: Blob) {
  if (!account || file.size > MAX_BYTES) return;
  try { await run(account, 'readwrite', (s) => s.put(file, id)); } catch { /* storage full or blocked */ }
}

export async function loadOriginal(account: string | undefined, id: string, remote = false): Promise<Blob | null> {
  if (!account) return null;
  try {
    const local = await run<Blob | undefined>(account, 'readonly', (s) => s.get(id));
    if (local || !remote) return local || null;
  } catch { if (!remote) return null; }
  // Saved from another device: fetch the synced copy once and keep it here.
  const { fetchOriginal } = await import('../sync');
  const synced = await fetchOriginal(account, id);
  if (!synced) return null;
  const bytes = Uint8Array.from(atob(synced.data), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: synced.mime });
  await saveOriginal(account, id, blob);
  return blob;
}
