// Search your chats by meaning: each exchange (your message and the reply) gets a small "meaning vector" from
// Gemini's free embedding model, kept on this device. A question is turned into a vector too, and the closest
// exchanges are the answer's sources. Only changed chats are sent again; nothing is stored in the account.

import { embed } from './ai/providers.js';
import { isTemporaryChat } from './temporary-chat';
import type { Chat } from '../types';

export interface Chunk { id: string; chatId: string; idx: number; hash: string; text: string; vec: number[] }
export interface Hit { chatId: string; title: string; text: string; score: number; at: number }

const CHUNK_CHARS = 1400;
const BATCH = 50;
const MAX_CHUNKS = 4000;

/** One piece per exchange: your message and the start of the reply. */
export function chunksOf(chat: Chat): { id: string; idx: number; text: string; hash: string }[] {
  const out: { id: string; idx: number; text: string; hash: string }[] = [];
  const msgs = chat.messages.filter((m) => m.text.trim() && !m.auto);
  for (let i = 0; i < msgs.length; i++) {
    if (msgs[i].role !== 'user') continue;
    const reply = msgs[i + 1]?.role === 'assistant' ? msgs[i + 1].text : '';
    const text = `${chat.title}\nQ: ${msgs[i].text.slice(0, 600)}\nA: ${reply}`.slice(0, CHUNK_CHARS);
    out.push({ id: `${chat.id}:${out.length}`, idx: out.length, text, hash: hash(text) });
  }
  return out;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36) + s.length;
}

const cosine = (a: number[], b: number[]) => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na * nb) || 1);
};

function open(uid: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(`model-router-meaning-${uid}`, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('chunks', { keyPath: 'id' }); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
const all = (d: IDBDatabase) => new Promise<Chunk[]>((res, rej) => { const q = d.transaction('chunks').objectStore('chunks').getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
const write = (d: IDBDatabase, put: Chunk[], del: string[]) => new Promise<void>((res, rej) => {
  const tx = d.transaction('chunks', 'readwrite'), st = tx.objectStore('chunks');
  put.forEach((c) => st.put(c)); del.forEach((id) => st.delete(id));
  tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
});

export class HistoryIndex {
  private db: Promise<IDBDatabase>;
  constructor(uid: string) { this.db = open(uid); }

  /**
   * Brings the index up to date with your chats (newest first). Calls `progress(done, total)`. Stops early on a
   * rate limit; what's indexed so far is kept and used.
   */
  async update(chats: Chat[], progress?: (done: number, total: number) => void, signal?: AbortSignal): Promise<{ limited: boolean }> {
    const d = await this.db;
    const have = new Map((await all(d)).map((c) => [c.id, c]));
    const wanted = new Map<string, { chatId: string; idx: number; text: string; hash: string }>();
    for (const chat of [...chats].filter((c) => !isTemporaryChat(c)).sort((a, b) => b.updatedAt - a.updatedAt)) {
      for (const c of chunksOf(chat)) { if (wanted.size >= MAX_CHUNKS) break; wanted.set(c.id, { ...c, chatId: chat.id }); }
    }
    const stale = [...have.keys()].filter((id) => !wanted.has(id));
    const todo = [...wanted.entries()].filter(([id, c]) => have.get(id)?.hash !== c.hash).map(([id, c]) => ({ id, ...c }));
    if (stale.length) await write(d, [], stale);
    let done = 0;
    progress?.(0, todo.length);
    for (let i = 0; i < todo.length; i += BATCH) {
      if (signal?.aborted) break;
      const part = todo.slice(i, i + BATCH);
      try {
        const vecs = await embed(part.map((c) => c.text), 'RETRIEVAL_DOCUMENT', signal);
        await write(d, part.map((c, k) => ({ ...c, vec: vecs[k] || [] })).filter((c) => c.vec.length), []);
      } catch (e) {
        if ((e as { status?: number }).status === 429) return { limited: true };
        throw e;
      }
      done += part.length;
      progress?.(done, todo.length);
    }
    return { limited: false };
  }

  /** The exchanges closest in meaning to `query`, best first (at most a few per chat). */
  async search(query: string, chats: Chat[], limit = 10, signal?: AbortSignal): Promise<Hit[]> {
    const d = await this.db;
    const [q] = await embed([query], 'RETRIEVAL_QUERY', signal);
    const byId = new Map(chats.map((c) => [c.id, c]));
    const scored = (await all(d)).filter((c) => byId.has(c.chatId) && c.vec.length).map((c) => ({ c, score: cosine(q, c.vec) })).sort((a, b) => b.score - a.score);
    const perChat = new Map<string, number>();
    const out: Hit[] = [];
    for (const { c, score } of scored) {
      if (out.length >= limit || score < 0.45) break;
      const n = perChat.get(c.chatId) || 0;
      if (n >= 3) continue;
      perChat.set(c.chatId, n + 1);
      const chat = byId.get(c.chatId)!;
      out.push({ chatId: c.chatId, title: chat.title, text: c.text.slice(chat.title.length + 1), score, at: chat.updatedAt });
    }
    return out;
  }

  async clear() { const d = await this.db; const ids = (await all(d)).map((c) => c.id); await write(d, [], ids); }
}

export function askPrompt(question: string, hits: Hit[]) {
  return `Answer the question using only the excerpts from the user's earlier chats below. Cite the excerpts you use with their numbers in square brackets, like [1] or [2][3], right after the claim. If the excerpts don't answer it, say so plainly. Be concise. Use the same language as the question.

Question: ${question}

${hits.map((h, i) => `[${i + 1}] Chat "${h.title}" (${new Date(h.at).toLocaleDateString()}):\n${h.text}`).join('\n\n')}`;
}
