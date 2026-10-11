// Keeps chats in step across devices through Firestore:
//   modelRouter/{uid}/chats/{chatId}                 chat details (title, pinned, updatedAt, deleted, ids…)
//   modelRouter/{uid}/chats/{chatId}/messages/{id}   one document per message
// Attachment contents stay on the device that added them (Firestore documents are limited to 1 MB);
// names, thumbnails and small extracted texts are synced.
//
// To stay inside Firebase's free daily reads, every write carries a server time (`srv`). After the
// first full sync a device only asks for chats changed since it last looked, and for those chats
// only the messages that changed (the chat's `ids` list gives the order and shows deletions).

import {
  collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, Timestamp, where, writeBatch,
  type DocumentData, type Query, type Unsubscribe,
} from 'firebase/firestore';
import type { Attachment, Chat, Message } from '../types';
import { db } from './firebase';
import { quota, type GuardLevel } from './quota';
import { normalizeAssistant } from './assistants';
import { normalizeDocuments } from './canvas';

const MAX_SYNCED_TEXT = 100_000;
const MAX_DOC_CHARS = 900_000;
/** Allowance for writes that were still in flight when we last looked. */
const MARGIN_MS = 60_000;
/** In "slow" mode, changes to a chat are sent at most this often. */
const SLOW_DELAY_MS = 60_000;

type RemoteMessage = Omit<Message, 'files'> & { index: number; files?: Attachment[]; srv?: unknown };

const chatsCol = (uid: string) => collection(db, 'modelRouter', uid, 'chats');
const messagesCol = (uid: string, chatId: string) => collection(db, 'modelRouter', uid, 'chats', chatId, 'messages');

function toRemoteMessage(m: Message, index: number): RemoteMessage {
  const out: RemoteMessage = { ...m, index };
  if (m.status === 'streaming') out.status = 'stopped';
  if (m.files?.length) {
    out.files = m.files.map(({ data: _data, text, ...f }) => ({ ...f, ...(text && text.length <= MAX_SYNCED_TEXT ? { text } : {}) }));
  }
  let json = JSON.stringify(out);
  // Very long replies are trimmed rather than failing to sync.
  if (json.length > MAX_DOC_CHARS) {
    out.text = out.text.slice(0, MAX_DOC_CHARS - (json.length - out.text.length) - 200) + '\n\n[…trimmed on other devices]';
    out.thinking = undefined;
    json = JSON.stringify(out);
  }
  return JSON.parse(json);
}

/** Uses the remote version but keeps attachment contents this device still has. */
function mergeMessage(remote: RemoteMessage, mine: Message | undefined): Message {
  const { index: _index, srv: _srv, ...m } = remote;
  if (!m.files?.length) return m as Message;
  return {
    ...m,
    files: m.files.map((f) => {
      const had = mine?.files?.find((x) => x.id === f.id);
      return had ? { ...f, data: had.data, text: had.text ?? f.text } : f;
    }),
  } as Message;
}

const revOf = (c: { rev?: unknown; updatedAt?: unknown }) => Number(c.rev ?? c.updatedAt) || 0;
const srvOf = (d: DocumentData) => (d.srv instanceof Timestamp ? d.srv.toMillis() : 0);
const fingerprint = (m: Message, i: number) => JSON.stringify(toRemoteMessage(m, i));

interface Handlers {
  local(id: string): Chat | undefined;
  allLocal(): Chat[];
  apply(chat: Chat): void;
  remove(id: string): void;
  error(message: string): void;
}

function load<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || '') ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or private mode: we'll just read a bit more next time */
  }
}

export class ChatSync {
  private unsub: Unsubscribe | null = null;
  /** What this device last wrote or read for each message, to send only changes. */
  private known = new Map<string, Map<string, string>>();
  private queue: Promise<void> = Promise.resolve();
  private reported = false;
  /** server time of the newest change this device has taken in */
  private seen: number;
  /** each chat's rev as last sent or received, so unsent chats can be found later */
  private synced: Record<string, number>;
  private waiting = new Map<string, { chat: Chat; timer: ReturnType<typeof setTimeout> }>();
  private level: GuardLevel = 'normal';
  private stopQuota: (() => void) | null = null;

  constructor(private uid: string, private h: Handlers) {
    this.seen = Number(load(`mr.sync.seen.${uid}`, 0)) || 0;
    this.synced = load(`mr.sync.revs.${uid}`, {} as Record<string, number>);
  }

  start() {
    if (this.uid.startsWith('preview-')) return;
    this.level = quota.level();
    this.stopQuota = quota.subscribe((v) => this.onLevel(v.level));
    if (this.level !== 'paused') {
      this.listen();
      this.flushDeletes();
    }
  }

  stop() {
    this.unsub?.();
    this.unsub = null;
    this.stopQuota?.();
    this.stopQuota = null;
    this.waiting.forEach((w) => clearTimeout(w.timer));
    this.waiting.clear();
  }

  private onLevel(level: GuardLevel) {
    if (level === this.level) return;
    const was = this.level;
    this.level = level;
    if (level === 'paused') {
      this.unsub?.();
      this.unsub = null;
    } else if (was === 'paused') {
      // New day: catch up both ways.
      this.listen();
      this.flushDeletes();
    }
    if (level === 'normal') [...this.waiting.keys()].forEach((id) => this.sendNow(id));
  }

  private listen() {
    if (this.unsub) return;
    let first = true;
    const full = !this.seen;
    const q: Query = full ? chatsCol(this.uid) : query(chatsCol(this.uid), where('srv', '>', Timestamp.fromMillis(this.seen - MARGIN_MS)));
    this.unsub = onSnapshot(
      q,
      (snap) => {
        const changes = snap.docChanges().filter((c) => !c.doc.metadata.hasPendingWrites);
        if (!snap.metadata.fromCache) quota.count('reads', Math.max(first ? 1 : 0, changes.length));
        const remoteRevs = new Map<string, number>();
        snap.docs.forEach((d) => remoteRevs.set(d.id, revOf(d.data())));
        const isFirst = first;
        first = false;
        this.serial(async () => {
          const since = this.seen;
          let newest = this.seen;
          for (const c of changes) {
            if (c.type === 'removed') continue;
            const data = c.doc.data();
            const id = c.doc.id;
            newest = Math.max(newest, srvOf(data));
            if (data.deleted) {
              if (this.h.local(id)) this.h.remove(id);
              this.known.delete(id);
              this.synced[id] = revOf(data);
              continue;
            }
            const local = this.h.local(id);
            const remoteRev = revOf(data);
            if (local && revOf(local) >= remoteRev && this.known.has(id)) continue;
            if (local && revOf(local) === remoteRev) {
              // Same version as ours: nothing to download.
              this.known.set(id, new Map(local.messages.map((m, i) => [m.id, fingerprint(m, i)])));
              this.synced[id] = remoteRev;
              continue;
            }
            if (local && revOf(local) > remoteRev) continue; // ours is newer; it gets pushed below
            const messages = await this.fetchMessages(id, data, local, since);
            this.known.set(id, new Map(messages.map((m, i) => [m.id, fingerprint(m, i)])));
            this.synced[id] = remoteRev;
            this.h.apply({
              id,
              title: data.title || 'New chat',
              createdAt: Number(data.createdAt) || Date.now(),
              updatedAt: Number(data.updatedAt) || Date.now(),
              pinned: Boolean(data.pinned),
              tags: Array.isArray(data.tags) ? data.tags.filter((t: unknown): t is string => typeof t === 'string').slice(0, 5) : undefined,
              model: data.model || undefined,
              projectId: typeof data.projectId === 'string' ? data.projectId : undefined,
              task: data.task && typeof data.task.id==='string' ? data.task : undefined,
              assistant: data.assistant ? normalizeAssistant(data.assistant) || undefined : undefined,
              documents: normalizeDocuments(data.documents),
              rev: remoteRev,
              summary: data.summary?.text ? data.summary : undefined,
              repo: data.repo?.owner ? data.repo : undefined,
              context: Array.isArray(data.context) ? data.context : undefined,
              // Uncommitted edits stay on the device that made them.
              changes: local?.changes,
              contextSent: local?.contextSent,
              messages,
            });
          }
          // First look on this device (or after a pause): send chats the server doesn't have yet.
          if (isFirst) {
            for (const chat of this.h.allLocal()) {
              if (!chat.messages.length && !chat.documents?.length) continue;
              const remote = remoteRevs.get(chat.id) ?? (full ? -1 : this.synced[chat.id] ?? -1);
              if (revOf(chat) > remote) await this.write(chat);
            }
          }
          if (newest > this.seen) this.seen = newest;
          save(`mr.sync.seen.${this.uid}`, this.seen);
          save(`mr.sync.revs.${this.uid}`, this.synced);
        });
      },
      (e) => this.fail(e),
    );
  }

  /** Gets a chat's messages: only the changed ones when this device already has the rest. */
  private async fetchMessages(id: string, data: DocumentData, local: Chat | undefined, since: number): Promise<Message[]> {
    const ids: unknown = data.ids;
    const mine = new Map((local?.messages || []).map((m) => [m.id, m]));
    if (local && since && Array.isArray(ids)) {
      const snap = await getDocs(query(messagesCol(this.uid, id), where('srv', '>', Timestamp.fromMillis(since - MARGIN_MS))));
      quota.count('reads', Math.max(1, snap.size));
      const fresh = new Map(snap.docs.map((d) => [d.id, d.data() as RemoteMessage]));
      if (ids.every((mid) => fresh.has(mid) || mine.has(mid))) {
        return ids.map((mid) => (fresh.has(mid) ? mergeMessage(fresh.get(mid)!, mine.get(mid)) : mine.get(mid)!));
      }
    }
    const snap = await getDocs(query(messagesCol(this.uid, id), orderBy('index')));
    quota.count('reads', Math.max(1, snap.size));
    return snap.docs.map((d) => d.data() as RemoteMessage).sort((a, b) => a.index - b.index).map((m) => mergeMessage(m, mine.get(m.id)));
  }

  push(chat: Chat) {
    if (this.uid.startsWith('preview-')) return;
    if (!chat.messages.length && !chat.documents?.length) return;
    if (this.level === 'normal') {
      this.serial(() => this.write(chat));
      return;
    }
    // Slow or paused: keep only the newest version and send it a little later.
    const w = this.waiting.get(chat.id);
    if (w) clearTimeout(w.timer);
    const timer = setTimeout(() => this.sendNow(chat.id), SLOW_DELAY_MS);
    this.waiting.set(chat.id, { chat, timer });
  }

  private sendNow(id: string) {
    const w = this.waiting.get(id);
    if (!w) return;
    clearTimeout(w.timer);
    this.waiting.delete(id);
    // While paused it isn't sent now; the catch-up after the reset finds it (its rev is newer).
    if (this.level !== 'paused') this.serial(() => this.write(w.chat));
  }

  remove(id: string) {
    if (this.uid.startsWith('preview-')) return;
    const w = this.waiting.get(id);
    if (w) clearTimeout(w.timer);
    this.waiting.delete(id);
    if (this.level === 'paused') {
      // Can't tell other devices right now; remember to do it after the reset.
      const pending = load<string[]>(`mr.sync.deletes.${this.uid}`, []);
      save(`mr.sync.deletes.${this.uid}`, [...new Set([...pending, id])]);
      return;
    }
    this.serial(() => this.removeNow(id));
  }

  /** Sends deletions made while syncing was paused. */
  private flushDeletes() {
    const pending = load<string[]>(`mr.sync.deletes.${this.uid}`, []);
    if (!pending.length) return;
    save(`mr.sync.deletes.${this.uid}`, []);
    pending.forEach((id) => this.serial(() => this.removeNow(id)));
  }

  private async removeNow(id: string) {
    const ids = await this.remoteIds(id);
    const batches = [writeBatch(db)];
    let ops = 0;
    for (const mid of ids) {
      if (++ops % 450 === 0) batches.push(writeBatch(db));
      batches[batches.length - 1].delete(doc(messagesCol(this.uid, id), mid));
    }
    const rev = Date.now();
    batches[batches.length - 1].set(doc(chatsCol(this.uid), id), { deleted: true, rev, updatedAt: rev, srv: serverTimestamp() });
    for (const b of batches) await b.commit();
    quota.count('deletes', ids.size);
    quota.count('writes', 1);
    this.known.delete(id);
    this.synced[id] = rev;
    save(`mr.sync.revs.${this.uid}`, this.synced);
  }

  private async remoteIds(chatId: string): Promise<Set<string>> {
    const known = this.known.get(chatId);
    if (known) return new Set(known.keys());
    const snap = await getDocs(messagesCol(this.uid, chatId));
    quota.count('reads', Math.max(1, snap.size));
    return new Set(snap.docs.map((d) => d.id));
  }

  private async write(chat: Chat) {
    const previous = this.known.get(chat.id) ?? new Map(Array.from(await this.remoteIds(chat.id), (id) => [id, ''] as [string, string]));
    const next = new Map<string, string>();
    const batches = [writeBatch(db)];
    let writes = 0;
    let deletes = 0;
    const op = () => {
      if ((writes + deletes + 1) % 450 === 0) batches.push(writeBatch(db));
      return batches[batches.length - 1];
    };
    chat.messages.forEach((m, i) => {
      const json = fingerprint(m, i);
      next.set(m.id, json);
      if (previous.get(m.id) !== json) {
        op().set(doc(messagesCol(this.uid, chat.id), m.id), { ...toRemoteMessage(m, i), srv: serverTimestamp() });
        writes++;
      }
    });
    for (const id of previous.keys()) {
      if (!next.has(id)) {
        op().delete(doc(messagesCol(this.uid, chat.id), id));
        deletes++;
      }
    }
    op().set(doc(chatsCol(this.uid), chat.id), {
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      pinned: Boolean(chat.pinned),
      tags: chat.tags?.length ? chat.tags.slice(0, 5) : null,
      model: chat.model || null,
      projectId: chat.projectId || null,
      task: chat.task ? {...chat.task} : null,
      assistant: chat.assistant ? { ...chat.assistant } : null,
      documents: chat.documents?.length ? chat.documents.map(doc => ({ ...doc })) : null,
      rev: revOf(chat),
      deleted: false,
      count: chat.messages.length,
      ids: chat.messages.map((m) => m.id),
      summary: chat.summary ? JSON.parse(JSON.stringify(chat.summary)) : null,
      repo: chat.repo ? { ...chat.repo } : null,
      context: chat.context?.length ? chat.context.slice(0, 50) : null,
      srv: serverTimestamp(),
    });
    writes++;
    for (const b of batches) await b.commit();
    quota.count('writes', writes);
    quota.count('deletes', deletes);
    this.known.set(chat.id, next);
    this.synced[chat.id] = revOf(chat);
    save(`mr.sync.revs.${this.uid}`, this.synced);
  }

  private serial(task: () => Promise<void>) {
    this.queue = this.queue.then(task).catch((e) => this.fail(e));
  }

  private fail(e: unknown) {
    if (this.reported) return;
    this.reported = true;
    this.h.error(`Chat sync paused: ${(e as Error).message}`);
  }
}
