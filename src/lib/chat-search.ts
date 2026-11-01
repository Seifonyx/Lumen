// Conversation search: one rule for the drawer, All chats and Jump to, so they all find the same chats. A chat matches
// on its title or on any message, ignoring case. A chat found through a message (not its title) also gets the newest
// matching message and a short excerpt around the match, so the result can say where it matched and open there.
import type { Chat } from '../types';
import { plainText } from './chat-preview';

export interface Excerpt { before: string; match: string; after: string }
export interface ChatMatch { messageId: string; excerpt: Excerpt; count: number }

/** The query as every search compares it. */
export const searchKey = (query: string) => query.trim().toLowerCase();

/** Where `key` (from searchKey) starts in `text` and how long the match is, in `text`'s own positions. */
export function findIn(text: string, key: string): { index: number; length: number } | null {
  if (!key) return null;
  const lower = text.toLowerCase();
  const at = lower.indexOf(key);
  if (at < 0) return null;
  if (lower.length === text.length) return { index: at, length: key.length };
  // Lower-casing changed the length (İ becomes i + a combining dot): walk the characters to map back.
  let low = 0, start = -1;
  for (let i = 0; i < text.length;) {
    const ch = String.fromCodePoint(text.codePointAt(i)!);
    if (start < 0 && low + ch.toLowerCase().length > at) start = i;
    if (start >= 0 && low >= at + key.length) return { index: start, length: i - start };
    low += ch.toLowerCase().length;
    i += ch.length;
  }
  return start < 0 ? null : { index: start, length: text.length - start };
}

export const chatMatches = (chat: Chat, key: string) =>
  chat.title.toLowerCase().includes(key) || chat.messages.some((m) => m.text.toLowerCase().includes(key));

const BEFORE = 22, AFTER = 140;

/** A short excerpt of `text` around a match: whole words, an ellipsis where it was cut. */
export function excerptAt(text: string, index: number, length: number): Excerpt {
  const from = Math.max(0, index - BEFORE), to = Math.min(text.length, index + length + AFTER);
  let before = text.slice(from, index), after = text.slice(index + length, to);
  if (from > 0) before = `…${before.replace(/^\S*\s/, '')}`;
  if (to < text.length) after = `${after.replace(/\s\S*$/, '')}…`;
  return { before, match: text.slice(index, index + length), after };
}

/** The excerpt for a matching message, from its readable text (Markdown stripped, src/lib/chat-preview.ts); from the
 *  raw text when the match is in the syntax itself (code, a link address). */
function excerptOf(text: string, key: string): Excerpt | null {
  for (const source of [plainText(text), text.replace(/\s+/g, ' ')]) {
    const at = findIn(source, key);
    if (at) return excerptAt(source, at.index, at.length);
  }
  return null;
}

/** How `chat` matches `key`: null for no match or a title match, otherwise the newest matching message. */
export function messageMatch(chat: Chat, key: string): ChatMatch | null {
  if (!key || chat.title.toLowerCase().includes(key)) return null;
  let found: { messageId: string; excerpt: Excerpt } | null = null, count = 0;
  for (let i = chat.messages.length - 1; i >= 0; i--) {
    const m = chat.messages[i];
    if (!m.text.toLowerCase().includes(key)) continue;
    count++;
    if (!found) { const excerpt = excerptOf(m.text, key); if (excerpt) found = { messageId: m.id, excerpt }; }
  }
  return found ? { ...found, count } : null;
}

export const excerptText = (e: Excerpt) => `${e.before}${e.match}${e.after}`;
