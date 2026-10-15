// Study mode: flashcards and a quiz made from a chat or a document. Flashcards come back on a schedule
// (Leitner boxes): a card you knew waits longer each time; one you missed comes back right away.

import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { quota } from './quota';
import { uid } from './util';

export interface StudyCard { id: string; q: string; a: string; box: number; due: number }
export interface QuizQuestion { id: string; q: string; options: string[]; answer: number; why?: string }
export interface StudyDeck {
  id: string;
  title: string;
  /** what it was made from */
  source: { chatId?: string; document?: string; label: string };
  cards: StudyCard[];
  quiz: QuizQuestion[];
  createdAt: number;
  updatedAt: number;
  /** quiz results, newest last (score out of quiz.length) */
  scores?: { at: number; score: number }[];
}

const DAY = 86_400_000;
/** How long a card waits after you knew it, by box (1–5). */
const WAIT = [0, 0, DAY, 3 * DAY, 7 * DAY, 16 * DAY];
export const MAX_SOURCE_CHARS = 60_000;

export function studyPrompt(source: string, label: string) {
  return `Make study material from the material below ("${label}").

Reply with JSON only, in this shape:
{"title": "short title for the deck", "cards": [{"q": "question or term", "a": "short answer"}], "quiz": [{"q": "question", "options": ["A", "B", "C", "D"], "answer": 0, "why": "one-sentence explanation"}]}

- 10 to 20 flashcards covering the most important facts, terms and ideas. Questions are specific; answers are short (one or two sentences).
- 6 to 10 multiple-choice questions with exactly 4 options each, one correct ("answer" is its index, 0 to 3). Wrong options should be plausible. Vary which position is correct.
- Use only what the material says. Write in the same language as the material.

Material:
${source.slice(0, MAX_SOURCE_CHARS)}`;
}

/** The deck from a model's reply, or null if it isn't usable. */
export function parseDeck(raw: string, source: StudyDeck['source'], now = Date.now()): StudyDeck | null {
  const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  let data: any;
  try { data = JSON.parse(json); } catch { return null; }
  const text = (v: unknown, max = 600) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const cards: StudyCard[] = (Array.isArray(data?.cards) ? data.cards : [])
    .map((c: any) => ({ id: uid(), q: text(c?.q), a: text(c?.a), box: 1, due: now }))
    .filter((c: StudyCard) => c.q && c.a)
    .slice(0, 40);
  const quiz: QuizQuestion[] = (Array.isArray(data?.quiz) ? data.quiz : [])
    .map((x: any) => ({ id: uid(), q: text(x?.q), options: Array.isArray(x?.options) ? x.options.map((o: unknown) => text(o, 300)).filter(Boolean).slice(0, 4) : [], answer: Number(x?.answer), why: text(x?.why) || undefined }))
    .filter((x: QuizQuestion) => x.q && x.options.length >= 2 && Number.isInteger(x.answer) && x.answer >= 0 && x.answer < x.options.length)
    .slice(0, 20);
  if (cards.length < 3 && quiz.length < 2) return null;
  return { id: uid(), title: text(data?.title, 120) || source.label, source, cards, quiz, createdAt: now, updatedAt: now };
}

/** Cards to go through now (due first, then by box). */
export function dueCards(deck: StudyDeck, now = Date.now()) {
  return deck.cards.filter((c) => c.due <= now).sort((a, b) => a.box - b.box || a.due - b.due);
}

/** A card after you answered: knew it → next box, later; missed → box 1, again now. */
export function grade(card: StudyCard, knew: boolean, now = Date.now()): StudyCard {
  const box = knew ? Math.min(5, card.box + 1) : 1;
  return { ...card, box, due: now + WAIT[box] };
}

/** When the next card is due (for "come back in …"). */
export function nextDue(deck: StudyDeck) {
  return deck.cards.reduce((t, c) => Math.min(t, c.due), Infinity);
}

/** How well you know the deck: share of cards in box 3 or higher. */
export function mastery(deck: StudyDeck) {
  return deck.cards.length ? deck.cards.filter((c) => c.box >= 3).length / deck.cards.length : 0;
}

/** Decks: one document each, modelRouter/{uid}/study/{deckId} (preview accounts keep them on the device). */
export class StudyStore {
  constructor(private userId: string) {}
  private get preview() { return this.userId.startsWith('preview-'); }
  private key() { return `mr.study.${this.userId}`; }
  /** What this device has (shown at once while the account copy loads). */
  cached(): StudyDeck[] { return this.local().sort((a, b) => b.updatedAt - a.updatedAt); }
  private local(): StudyDeck[] { try { return JSON.parse(localStorage.getItem(this.key()) || '[]'); } catch { return []; } }
  async list(): Promise<StudyDeck[]> {
    const local = this.local();
    if (this.preview) return local;
    try {
      const snap = await getDocs(collection(db, 'modelRouter', this.userId, 'study'));
      quota.count('reads', Math.max(1, snap.size));
      const decks = snap.docs.map((d) => d.data() as StudyDeck).filter((d) => d && Array.isArray(d.cards));
      try { localStorage.setItem(this.key(), JSON.stringify(decks)); } catch { /* full */ }
      return decks.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch { return local; }
  }
  async put(deck: StudyDeck) {
    const all = [deck, ...this.local().filter((d) => d.id !== deck.id)];
    try { localStorage.setItem(this.key(), JSON.stringify(all)); } catch { /* full */ }
    if (this.preview) return;
    quota.count('writes');
    // Saved on this device at once; the account copy follows in the background.
    void setDoc(doc(db, 'modelRouter', this.userId, 'study', deck.id), JSON.parse(JSON.stringify(deck))).catch(() => {});
  }
  async remove(id: string) {
    try { localStorage.setItem(this.key(), JSON.stringify(this.local().filter((d) => d.id !== id))); } catch { /* full */ }
    if (this.preview) return;
    quota.count('writes');
    void deleteDoc(doc(db, 'modelRouter', this.userId, 'study', id)).catch(() => {});
  }
}
