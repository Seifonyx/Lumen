import { normalizePlan } from './coding-plan';
import { normalizeKnowledgeSources } from './knowledge/core';
// Chats are kept in IndexedDB on the device (attachments are too big for localStorage).
// Account databases keep shared-device sign-ins separate. The legacy database is adopted once.

import { isTemporaryChat } from './temporary-chat';
import type { Chat, Message } from '../types';
import { uid } from './util';
import { normalizeAssistant } from './assistants';
import { normalizeDocuments } from './canvas';

const DB_NAME = 'model-router';
const STORE = 'chats';
let activeName = 'model-router-unassigned';
let legacyOwner: string | null = null;
const databases = new Map<string, Promise<IDBDatabase>>();
const accountName = (id: string) => `model-router-account-${id}`;

function open(name = activeName): Promise<IDBDatabase> {
  if (!databases.has(name)) databases.set(name, new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 2);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => { req.result.onversionchange = () => { req.result.close(); databases.delete(name); }; resolve(req.result); };
    req.onerror = () => { databases.delete(name); reject(req.error); };
  }));
  return databases.get(name)!;
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void, name = activeName): Promise<T | undefined> {
  const db = await open(name);
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

let metaPromise: Promise<IDBDatabase> | null = null;
async function meta<T>(key: string, update?: (previous: T | undefined) => T): Promise<T | undefined> {
  metaPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('model-router-account-migration', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('meta');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { metaPromise = null; reject(request.error); };
  });
  const database = await metaPromise;
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('meta', update ? 'readwrite' : 'readonly');
    const store = transaction.objectStore('meta');
    const request = store.get(key); let result: T | undefined;
    request.onsuccess = () => { result = update ? update(request.result) : request.result; if (update) store.put(result, key); };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

/** Brings chats saved by older versions up to the current shape. */
function normalize(raw: any): Chat {
  const created = raw.createdAt ?? raw.updated ?? Date.now();
  const messages: Message[] = (raw.messages || []).map((m: any, i: number) => ({
    id: m.id || uid() + i,
    role: m.role,
    codeExecution: Boolean(m.codeExecution),
    deepResearch: m.deepResearch ? true : undefined,
    research: m.research && Array.isArray(m.research.steps) ? { phase: m.research.phase === 'searching' || m.research.phase === 'planning' || m.research.phase === 'writing' ? 'stopped' : m.research.phase, steps: m.research.steps.map((s: any) => ({ query: String(s.query || ''), status: s.status === 'searching' || s.status === 'waiting' ? 'failed' : s.status, sources: s.sources })) } : undefined,
    coding: m.coding && typeof m.coding.id === 'string' && ['plan','work'].includes(m.coding.phase) && typeof m.coding.repo === 'string' ? m.coding : undefined,
    text: m.text || '',
    files: (m.files || []).map((f: any) => ({ id: f.id || uid(), size: f.size ?? (f.data?.length ?? f.text?.length ?? 0), mime: f.mime || 'text/plain', ...f })),
    model: m.model,
    route: m.route,
    via: m.via,
    auto: m.auto,
    thinking: m.thinking,
    sources: m.sources,
    knowledgeSources: normalizeKnowledgeSources(m.knowledgeSources),
    notices: m.notices,
    memory: m.memory,
    privacy: m.privacy,
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
    archived: raw.archived ? true : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t: unknown): t is string => typeof t === 'string').slice(0, 5) : undefined,
    model: raw.model,
    projectId: raw.projectId,
    task: raw.task && typeof raw.task.id==='string' && typeof raw.task.name==='string' ? { id:raw.task.id, name:raw.task.name, occurrence:String(raw.task.occurrence||''), search:Boolean(raw.task.search) } : undefined,
    assistant: raw.assistant ? normalizeAssistant(raw.assistant) || undefined : undefined,
    documents: normalizeDocuments(raw.documents),
    rev: raw.rev,
    summary: raw.summary && typeof raw.summary.text === 'string' ? raw.summary : undefined,
    repo: raw.repo,
    context: raw.context,
    contextSent: raw.contextSent,
    changes: raw.changes,
    editReviews: raw.editReviews,
    codingPlanMode: Boolean(raw.codingPlanMode),
    codingPlan: normalizePlan(raw.codingPlan),
    messages,
  };
}

export const db = {
  get legacyOwner() { return legacyOwner; },
  /** First verified account claims legacy local chats atomically, including across open tabs. */
  async useAccount(id: string | null): Promise<Chat[]> {
    const name = id ? accountName(id) : 'model-router-unassigned';
    activeName = name;
    if (!id) return [];
    const owner = await meta<string>('legacyOwner', previous => previous || id);
    legacyOwner = owner || null;
    const migrated = await meta<boolean>(`migrated:${id}`);
    if (!migrated) {
      if (owner === id) {
        const old = (await tx<any[]>('readonly', store => store.getAll(), DB_NAME)) || [];
        const existing = (await tx<any[]>('readonly', store => store.getAll(), name)) || [];
        const latest = new Map(existing.map(chat => [chat.id, chat]));
        await tx('readwrite', store => {
          for (const chat of old) {
            if(isTemporaryChat(chat))continue;
            const saved = latest.get(chat.id);
            if (!saved || Number(chat.rev ?? chat.updatedAt ?? 0) > Number(saved.rev ?? saved.updatedAt ?? 0)) store.put(normalize(chat));
          }
        }, name);
      }
      // The new account database must pull its full remote history, even if the old shared cache did not.
      try { localStorage.removeItem(`mr.sync.seen.${id}`); localStorage.removeItem(`mr.sync.revs.${id}`); } catch { /* private mode */ }
      await meta<boolean>(`migrated:${id}`, () => true);
    }
    const rows = (await tx<any[]>('readonly', store => store.getAll(), name)) || [];
    return rows.filter(chat=>!isTemporaryChat(chat)).map(normalize).sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async all(): Promise<Chat[]> {
    const rows = (await tx<any[]>('readonly', (s) => s.getAll())) || [];
    return rows.filter(chat=>!isTemporaryChat(chat)).map(normalize).sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async put(chat: Chat, accountId?: string): Promise<void> {
    if(isTemporaryChat(chat))return;
    await tx('readwrite', (s) => s.put(chat), accountId ? accountName(accountId) : activeName);
  },
  async remove(id: string): Promise<void> {
    const name = activeName;
    await tx('readwrite', (s) => s.delete(id), name);
    if (legacyOwner && name === accountName(legacyOwner)) await tx('readwrite', store => store.delete(id), DB_NAME);
  },
  async clear(): Promise<void> {
    const name = activeName;
    await tx('readwrite', (s) => s.clear(), name);
    if (legacyOwner && name === accountName(legacyOwner)) await tx('readwrite', store => store.clear(), DB_NAME);
  },
  async bulkPut(chats: Chat[]): Promise<void> {
    await tx('readwrite', (s) => {
      for (const c of chats) if(!isTemporaryChat(c))s.put(normalize(c));
    });
  },
};
