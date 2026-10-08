// Keeps chats in step across devices through Firestore:
//   modelRouter/{uid}/chats/{chatId}                 chat details (title, pinned, updatedAt, deleted…)
//   modelRouter/{uid}/chats/{chatId}/messages/{id}   one document per message
// Attachment contents stay on the device that added them (Firestore documents are limited to 1 MB);
// names, thumbnails and small extracted texts are synced.

import { collection, doc, getDocs, onSnapshot, orderBy, query, writeBatch, type Unsubscribe } from 'firebase/firestore';
import type { Attachment, Chat, Message } from '../types';
import { db } from './firebase';

const MAX_SYNCED_TEXT = 100_000;
const MAX_DOC_CHARS = 900_000;

type RemoteMessage = Omit<Message, 'files'> & { index: number; files?: Attachment[] };

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
function mergeMessages(remote: RemoteMessage[], local: Message[] | undefined): Message[] {
  const byId = new Map((local || []).map((m) => [m.id, m]));
  return remote
    .sort((a, b) => a.index - b.index)
    .map(({ index: _index, ...m }) => {
      const mine = byId.get(m.id);
      if (!m.files?.length) return m as Message;
      return {
        ...m,
        files: m.files.map((f) => {
          const had = mine?.files?.find((x) => x.id === f.id);
          return had ? { ...f, data: had.data, text: had.text ?? f.text } : f;
        }),
      } as Message;
    });
}

const revOf = (c: { rev?: unknown; updatedAt?: unknown }) => Number(c.rev ?? c.updatedAt) || 0;

interface Handlers {
  local(id: string): Chat | undefined;
  allLocal(): Chat[];
  apply(chat: Chat): void;
  remove(id: string): void;
  error(message: string): void;
}

export class ChatSync {
  private unsub: Unsubscribe | null = null;
  /** What this device last wrote or read for each message, to send only changes. */
  private known = new Map<string, Map<string, string>>();
  private queue: Promise<void> = Promise.resolve();
  private reported = false;

  constructor(private uid: string, private h: Handlers) {}

  start() {
    let first = true;
    this.unsub = onSnapshot(
      chatsCol(this.uid),
      (snap) => {
        const remoteDates = new Map<string, number>();
        const changes = snap.docChanges().filter((c) => !c.doc.metadata.hasPendingWrites);
        snap.docs.forEach((d) => remoteDates.set(d.id, revOf(d.data())));
        this.serial(async () => {
          for (const c of changes) {
            if (c.type === 'removed') continue;
            const data = c.doc.data();
            const id = c.doc.id;
            if (data.deleted) {
              if (this.h.local(id)) this.h.remove(id);
              this.known.delete(id);
              continue;
            }
            const local = this.h.local(id);
            const remoteRev = revOf(data);
            if (local && revOf(local) >= remoteRev && this.known.has(id)) continue;
            if (local && revOf(local) > remoteRev) continue; // ours is newer; it gets pushed below
            const msgs = await getDocs(query(messagesCol(this.uid, id), orderBy('index')));
            const remote = msgs.docs.map((d) => d.data() as RemoteMessage);
            this.known.set(id, new Map(remote.map((m) => [m.id, JSON.stringify(m)])));
            this.h.apply({
              id,
              title: data.title || 'New chat',
              createdAt: Number(data.createdAt) || Date.now(),
              updatedAt: Number(data.updatedAt) || Date.now(),
              pinned: Boolean(data.pinned),
              model: data.model || undefined,
              rev: remoteRev,
              messages: mergeMessages(remote, local?.messages),
            });
          }
          // First time on this device: upload chats the server doesn't have yet (or has older copies of).
          if (first) {
            first = false;
            for (const chat of this.h.allLocal()) {
              if (chat.messages.length && revOf(chat) > (remoteDates.get(chat.id) ?? -1)) await this.write(chat);
            }
          }
        });
      },
      (e) => this.fail(e),
    );
  }

  stop() {
    this.unsub?.();
    this.unsub = null;
  }

  push(chat: Chat) {
    if (!chat.messages.length) return;
    this.serial(() => this.write(chat));
  }

  remove(id: string) {
    this.serial(async () => {
      const ids = await this.remoteIds(id);
      const batches = [writeBatch(db)];
      let ops = 0;
      for (const mid of ids) {
        if (++ops % 450 === 0) batches.push(writeBatch(db));
        batches[batches.length - 1].delete(doc(messagesCol(this.uid, id), mid));
      }
      batches[batches.length - 1].set(doc(chatsCol(this.uid), id), { deleted: true, rev: Date.now(), updatedAt: Date.now() });
      for (const b of batches) await b.commit();
      this.known.delete(id);
    });
  }

  private async remoteIds(chatId: string): Promise<Set<string>> {
    const known = this.known.get(chatId);
    if (known) return new Set(known.keys());
    const snap = await getDocs(messagesCol(this.uid, chatId));
    return new Set(snap.docs.map((d) => d.id));
  }

  private async write(chat: Chat) {
    const previous = this.known.get(chat.id) ?? new Map(Array.from(await this.remoteIds(chat.id), (id) => [id, ''] as [string, string]));
    const next = new Map<string, string>();
    const batches = [writeBatch(db)];
    let ops = 0;
    const op = () => {
      if (++ops % 450 === 0) batches.push(writeBatch(db));
      return batches[batches.length - 1];
    };
    chat.messages.forEach((m, i) => {
      const remote = toRemoteMessage(m, i);
      const json = JSON.stringify(remote);
      next.set(m.id, json);
      if (previous.get(m.id) !== json) op().set(doc(messagesCol(this.uid, chat.id), m.id), remote);
    });
    for (const id of previous.keys()) if (!next.has(id)) op().delete(doc(messagesCol(this.uid, chat.id), id));
    op().set(doc(chatsCol(this.uid), chat.id), {
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      pinned: Boolean(chat.pinned),
      model: chat.model || null,
      rev: revOf(chat),
      deleted: false,
      count: chat.messages.length,
    });
    for (const b of batches) await b.commit();
    this.known.set(chat.id, next);
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
