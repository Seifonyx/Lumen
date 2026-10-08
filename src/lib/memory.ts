// Memory: short facts about you that every chat can use (your job, preferences, ongoing projects…).
// Stored at modelRouter/{uid}/memories/{id} so they're shared by your devices.
// Models save or drop memories by ending a reply with hidden lines:
//   [[remember: Works as a pharmacist in Cairo]]   [[forget: Prefers English replies]]
// The app removes these lines from the reply and shows "Memory updated" instead.

import { collection, deleteDoc, doc, onSnapshot, setDoc, writeBatch, type Unsubscribe } from 'firebase/firestore';
import type { Memory } from '../types';
import { db } from './firebase';
import { uid } from './util';

export const MAX_MEMORIES = 200;
export const MAX_MEMORY_CHARS = 500;
/** Roughly how much memory text goes to the model with each message. */
const PROMPT_BUDGET = 8_000;

const col = (userId: string) => collection(db, 'modelRouter', userId, 'memories');

export class MemoryStore {
  private unsub: Unsubscribe | null = null;
  constructor(private userId: string, private onChange: (items: Memory[]) => void, private onError: (msg: string) => void) {}

  start() {
    this.unsub = onSnapshot(
      col(this.userId),
      (snap) => {
        const items = snap.docs
          .map((d) => ({ ...(d.data() as Omit<Memory, 'id'>), id: d.id }))
          .filter((m) => typeof m.text === 'string' && m.text.trim())
          .sort((a, b) => b.updatedAt - a.updatedAt);
        this.onChange(items);
      },
      (e) => this.onError(`Memory sync paused: ${e.message}`),
    );
  }

  stop() {
    this.unsub?.();
    this.unsub = null;
  }

  async add(text: string, extra: Partial<Memory> = {}): Promise<Memory> {
    const now = Date.now();
    const m: Memory = { id: uid(), text: clip(text), createdAt: now, updatedAt: now, source: 'manual', ...extra };
    // Not awaited: Firestore saves offline and sends it when back online.
    setDoc(doc(col(this.userId), m.id), m).catch((e) => this.onError(`Couldn't save to memory: ${e.message}`));
    return m;
  }

  async update(id: string, text: string) {
    await setDoc(doc(col(this.userId), id), { text: clip(text), updatedAt: Date.now() }, { merge: true });
  }

  async remove(id: string) {
    deleteDoc(doc(col(this.userId), id)).catch((e) => this.onError(`Couldn't delete from memory: ${e.message}`));
  }

  async clear(ids: string[]) {
    for (let i = 0; i < ids.length; i += 450) {
      const b = writeBatch(db);
      ids.slice(i, i + 450).forEach((id) => b.delete(doc(col(this.userId), id)));
      await b.commit();
    }
  }
}

const clip = (t: string) => t.replace(/\s+/g, ' ').trim().slice(0, MAX_MEMORY_CHARS);
const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** True if the two texts say (nearly) the same thing. */
export function sameMemory(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const wx = new Set(x.split(' '));
  const wy = new Set(y.split(' '));
  const common = [...wx].filter((w) => wy.has(w)).length;
  return common / Math.max(wx.size, wy.size) >= 0.75;
}

/** The memory a "forget" line refers to, if any. */
export function findMemory(items: Memory[], text: string): Memory | undefined {
  return items.find((m) => sameMemory(m.text, text));
}

const MARKER = /\[\[\s*(remember|forget)\s*:\s*([\s\S]*?)\]\]/gi;

/** Splits a finished reply into the visible text and its memory changes. */
export function extractMemoryOps(raw: string): { text: string; remember: string[]; forget: string[] } {
  const remember: string[] = [];
  const forget: string[] = [];
  const text = raw
    .replace(MARKER, (_, kind: string, body: string) => {
      const t = clip(body);
      if (t) (kind.toLowerCase() === 'remember' ? remember : forget).push(t);
      return '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
  return { text, remember, forget };
}

/** While a reply streams in, hides memory lines, including one that's only half written. */
export function hideMemoryLines(raw: string): string {
  return raw.replace(MARKER, '').replace(/\[(\[\s*(r|re|rem|reme|remem|rememb|remembe|remember|f|fo|for|forg|forge|forget)?(\s*:[^\]]*)?\]?)?$/i, '').replace(/\n{3,}/g, '\n\n');
}

/** The memory section of the instructions sent to the model. */
export function memoryInstructions(items: Memory[], autoSave: boolean): string {
  const lines: string[] = [];
  let size = 0;
  for (const m of items) {
    if (size + m.text.length > PROMPT_BUDGET) break;
    lines.push(`- ${m.text}`);
    size += m.text.length + 3;
  }
  const known = lines.length
    ? `What you remember about the user from earlier chats (use it naturally when relevant; don't recite it unless asked):\n${lines.join('\n')}`
    : 'You have no saved memories about the user yet.';
  const when = autoSave
    ? 'Save a memory when the user asks you to remember something, or when they share a lasting fact or preference that will help in future chats (their name, job, workplace, ongoing projects, preferred language, tone or formats). Don\'t save one-off details, things already listed above, or what you said yourself.'
    : 'Save a memory only when the user explicitly asks you to remember something.';
  return [
    '# Memory',
    known,
    `To save a memory, end your reply with a line [[remember: short fact in the third person, e.g. "Prefers answers in Arabic"]]. To remove one (when the user asks you to forget it, or it is no longer true), add [[forget: the memory as written above]]. To change a memory, forget the old one and remember the new one. These lines are hidden from the user; the app shows "Memory updated". ${when}`,
    'Never save passwords, API keys, financial account details, health information, or anything about patients, other people or confidential work figures — even if asked; say you can\'t store that.',
  ].join('\n');
}
