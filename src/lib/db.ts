// Chats are kept in IndexedDB on the device (attachments are too big for localStorage).
// Database name matches the first version of the app, so its chats carry over.

import type { Chat, Message } from '../types';
import { uid } from './util';

const DB_NAME = 'model-router';
const STORE = 'chats';
let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/** Brings chats saved by older versions up to the current shape. */
function normalize(raw: any): Chat {
  const created = raw.createdAt ?? raw.updated ?? Date.now();
  const messages: Message[] = (raw.messages || []).map((m: any, i: number) => ({
    id: m.id || uid() + i,
    role: m.role,
    text: m.text || '',
    files: (m.files || []).map((f: any) => ({ id: f.id || uid(), size: f.size ?? (f.data?.length ?? f.text?.length ?? 0), mime: f.mime || 'text/plain', ...f })),
    model: m.model,
    thinking: m.thinking,
    sources: m.sources,
    notices: m.notices,
    error: m.error,
    status: m.status === 'streaming' ? 'stopped' : m.status,
    createdAt: m.createdAt ?? created,
  }));
  return {
    id: raw.id,
    title: raw.title || 'New chat',
    createdAt: created,
    updatedAt: raw.updatedAt ?? raw.updated ?? created,
    pinned: Boolean(raw.pinned),
    model: raw.model,
    messages,
  };
}

export const db = {
  async all(): Promise<Chat[]> {
    const rows = (await tx<any[]>('readonly', (s) => s.getAll())) || [];
    return rows.map(normalize).sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async put(chat: Chat): Promise<void> {
    await tx('readwrite', (s) => s.put(chat));
  },
  async remove(id: string): Promise<void> {
    await tx('readwrite', (s) => s.delete(id));
  },
  async clear(): Promise<void> {
    await tx('readwrite', (s) => s.clear());
  },
  async bulkPut(chats: Chat[]): Promise<void> {
    await tx('readwrite', (s) => {
      for (const c of chats) s.put(normalize(c));
    });
  },
};
