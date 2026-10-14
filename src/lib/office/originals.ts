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

export async function loadOriginal(account: string | undefined, id: string): Promise<Blob | null> {
  if (!account) return null;
  try { return (await run<Blob | undefined>(account, 'readonly', (s) => s.get(id))) || null; } catch { return null; }
}
