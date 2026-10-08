// Memory: short facts about you that every chat can use (your job, preferences, ongoing projects…).
// Stored in one document, modelRouter/{uid}/memory/all (one read per app start), shared by your devices.
// Models save or drop memories by ending a reply with hidden lines:
//   [[remember: Works as a pharmacist in Cairo]]   [[forget: Prefers English replies]]
// The app removes these lines from the reply and shows "Memory updated" instead.

import { collection, deleteField, doc, getDocs, onSnapshot, setDoc, updateDoc, writeBatch, type Unsubscribe } from 'firebase/firestore';
import { quota } from './quota';
import type { Memory } from '../types';
import { db } from './firebase';
import { uid } from './util';

export const MAX_MEMORIES = 200;
export const MAX_MEMORY_CHARS = 500;
/** Roughly how much memory text goes to the model with each message. */
const PROMPT_BUDGET = 8_000;

const ref = (userId: string) => doc(db, 'modelRouter', userId, 'memory', 'all');
/** Where the first version kept memories (one document each); moved into the single document. */
const oldCol = (userId: string) => collection(db, 'modelRouter', userId, 'memories');

export class MemoryStore {
  private unsub: Unsubscribe | null = null;
  private moved = false;
  constructor(private userId: string, private onChange: (items: Memory[]) => void, private onError: (msg: string) => void) {}

  start() {
    this.unsub = onSnapshot(
      ref(this.userId),
      (snap) => {
        if (!snap.metadata.fromCache && !snap.metadata.hasPendingWrites) quota.count('reads');
        if (!snap.exists() && !snap.metadata.fromCache && !this.moved && !localStorage.getItem(`mr.memory.moved.${this.userId}`)) void this.moveOld();
        const raw = (snap.data()?.items || {}) as Record<string, Memory>;
        const items = Object.values(raw)
          .filter((m) => m && typeof m.text === 'string' && m.text.trim())
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

  private async moveOld() {
    this.moved = true;
    try {
      const snap = await getDocs(oldCol(this.userId));
      quota.count('reads', Math.max(1, snap.size));
      if (snap.empty) {
        localStorage.setItem(`mr.memory.moved.${this.userId}`, '1');
        return;
      }
      const items = Object.fromEntries(snap.docs.map((d) => [d.id, { ...d.data(), id: d.id }]));
      await setDoc(ref(this.userId), { items }, { merge: true });
      const b = writeBatch(db);
      snap.docs.forEach((d) => b.delete(d.ref));
      await b.commit();
      quota.count('writes');
      quota.count('deletes', snap.size);
      localStorage.setItem(`mr.memory.moved.${this.userId}`, '1');
    } catch {
      // Try again next time.
      this.moved = false;
    }
  }

  // Writes aren't awaited: Firestore saves offline and sends them when back online.
  private send(p: Promise<void>, what: string) {
    quota.count('writes');
    p.catch((e) => this.onError(`Couldn't ${what}: ${e.message}`));
  }

  async add(text: string, extra: Partial<Memory> = {}): Promise<Memory> {
    const now = Date.now();
    const m: Memory = { id: uid(), text: clip(text), createdAt: now, updatedAt: now, source: 'manual', ...extra };
    this.send(setDoc(ref(this.userId), { items: { [m.id]: m } }, { merge: true }), 'save to memory');
    return m;
  }

  async update(id: string, text: string) {
    this.send(setDoc(ref(this.userId), { items: { [id]: { text: clip(text), updatedAt: Date.now() } } }, { merge: true }), 'save to memory');
  }

  async remove(id: string) {
    this.send(updateDoc(ref(this.userId), { [`items.${id}`]: deleteField() }), 'delete from memory');
  }

  async clear(_ids: string[]) {
    this.send(setDoc(ref(this.userId), { items: {} }), 'clear memory');
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
