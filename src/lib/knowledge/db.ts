import type { KnowledgeChunk, KnowledgeDocument, KnowledgePage } from "./core";
const connections = new Map<string, Promise<IDBDatabase>>();
async function open(uid: string) {
  if (!uid) throw new Error("Sign in to use your knowledge library.");
  if (!connections.has(uid))
    connections.set(
      uid,
      new Promise((resolve, reject) => {
        const request = indexedDB.open(`model-router-knowledge-${uid}`, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          db.createObjectStore("documents", { keyPath: "id" });
          db.createObjectStore("files");
          for (const name of ["pages", "chunks"]) {
            const store = db.createObjectStore(name, { keyPath: "id" });
            store.createIndex("docId", "docId");
            if (name === "chunks")
              store.createIndex("docOrdinal", ["docId", "ordinal"], {
                unique: true,
              });
          }
        };
        request.onerror = () => {
          connections.delete(uid);
          reject(request.error);
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            connections.delete(uid);
          };
          resolve(db);
        };
      }),
    );
  return connections.get(uid)!;
}
export async function transaction<T>(
  uid: string,
  names: string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction, done: (value: T) => void) => void,
): Promise<T> {
  const db = await open(uid);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, mode);
    let result: T;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || new Error("Library operation cancelled."));
    try {
      work(tx, (value) => {
        result = value;
      });
    } catch (error) {
      tx.abort();
      reject(error);
    }
  });
}
export const documents = (uid: string) =>
  transaction<KnowledgeDocument[]>(
    uid,
    ["documents"],
    "readonly",
    (tx, done) => {
      const r = tx.objectStore("documents").getAll();
      r.onsuccess = () => done(r.result);
    },
  );
export const document = (uid: string, id: string) =>
  transaction<KnowledgeDocument | undefined>(
    uid,
    ["documents"],
    "readonly",
    (tx, done) => {
      const r = tx.objectStore("documents").get(id);
      r.onsuccess = () => done(r.result);
    },
  );
export const page = (uid: string, id: string, number: number) =>
  transaction<KnowledgePage | undefined>(
    uid,
    ["pages"],
    "readonly",
    (tx, done) => {
      const r = tx.objectStore("pages").get(`${id}:${number}`);
      r.onsuccess = () => done(r.result);
    },
  );
export const original = (uid: string, id: string) =>
  transaction<Blob | undefined>(uid, ["files"], "readonly", (tx, done) => {
    const r = tx.objectStore("files").get(id);
    r.onsuccess = () => done(r.result);
  });
export const nextChunk = (uid: string, id: string, ordinal: number) =>
  transaction<KnowledgeChunk | undefined>(
    uid,
    ["chunks"],
    "readonly",
    (tx, done) => {
      const r = tx.objectStore("chunks").index("docOrdinal").get([id, ordinal]);
      r.onsuccess = () => done(r.result);
    },
  );
export const notify = () =>
  window.dispatchEvent(new Event("mr:knowledge-changed"));
export async function updateDocument(
  uid: string,
  id: string,
  patch: Partial<KnowledgeDocument>,
) {
  await transaction<void>(uid, ["documents"], "readwrite", (tx) => {
    const store = tx.objectStore("documents"),
      r = store.get(id);
    r.onsuccess = () => {
      if (r.result) store.put({ ...r.result, ...patch });
    };
  });
  notify();
}
export async function saveEmbedding(
  uid: string,
  doc: KnowledgeDocument,
  chunk: KnowledgeChunk,
  vector: Float32Array,
) {
  await transaction<void>(uid, ["documents", "chunks"], "readwrite", (tx) => {
    const store = tx.objectStore("documents"),
      r = store.get(doc.id);
    r.onsuccess = () => {
      if (!r.result) return;
      tx.objectStore("chunks").put({ ...chunk, vector });
      store.put({
        ...r.result,
        indexed: chunk.ordinal + 1,
        status: chunk.ordinal + 1 === doc.chunks ? "indexed" : "indexing",
        error: undefined,
      });
    };
  });
  notify();
}
export async function removeDocument(uid: string, id: string) {
  await transaction<void>(
    uid,
    ["documents", "pages", "chunks", "files"],
    "readwrite",
    (tx) => {
      tx.objectStore("documents").delete(id);
      tx.objectStore("files").delete(id);
      for (const name of ["pages", "chunks"]) {
        const r = tx
          .objectStore(name)
          .index("docId")
          .openKeyCursor(IDBKeyRange.only(id));
        r.onsuccess = () => {
          const cursor = r.result;
          if (cursor) {
            tx.objectStore(name).delete(cursor.primaryKey);
            cursor.continue();
          }
        };
      }
    },
  );
  notify();
}
/** Read bounded batches in the search worker; never clone the entire library into the UI. */
export const chunkBatch = (uid: string, after?: IDBValidKey) =>
  transaction<KnowledgeChunk[]>(uid, ["chunks"], "readonly", (tx, done) => {
    const rows: KnowledgeChunk[] = [];
    const r = tx
      .objectStore("chunks")
      .openCursor(after ? IDBKeyRange.lowerBound(after, true) : undefined);
    r.onsuccess = () => {
      const cursor = r.result;
      if (!cursor || rows.length === 256) {
        done(rows);
        return;
      }
      rows.push(cursor.value);
      cursor.continue();
    };
  });
