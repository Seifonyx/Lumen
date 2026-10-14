// Public share links: a read-only copy of one chat's text that anyone with the link can open.
// The copy lives in modelRouterShares/{id} (see firestore.rules): unguessable id, no listing for others,
// only the owner can update or remove it. Attachments are listed by name only; nothing else is shared.
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { Masker, scan, type Finding } from './privacy';
import type { Chat } from '../types';

export type SharedMessage = { role: 'user' | 'assistant'; text: string; model?: string; files?: string[] };
export type SharedChat = { id: string; title: string; messages: SharedMessage[]; masked: boolean; updatedAt?: number };
export type ShareInfo = { id: string; chatId: string; title: string; masked: boolean; updatedAt: number };

const COLLECTION = 'modelRouterShares';
const MAX_CHARS = 600_000; // Firestore documents hold up to 1 MB
const MAX_MESSAGES = 400;

export const shareUrl = (id: string) => `${location.origin}/share/${id}`;
export const shareIdFromPath = (path = location.pathname) => /^\/share\/([A-Za-z0-9]{20,40})\/?$/.exec(path)?.[1] || null;

const newId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => chars[b % chars.length]).join('');
};

const shareable = (chat: Chat) => chat.messages.filter((m) => (m.role === 'user' || m.role === 'assistant') && (m.text?.trim() || m.files?.length) && !m.error);

/** Personal details (names, phone numbers, IDs…) found in what would be shared. */
export function shareFindings(chat: Chat): Finding[] {
  return [chat.title, ...shareable(chat).map((m) => m.text || '')].flatMap((t) => scan(t));
}

function payload(chat: Chat, mask: boolean) {
  const masker = mask ? new Masker() : null;
  const hide = (t: string) => (masker ? masker.mask(t).text : t);
  let messages: SharedMessage[] = shareable(chat).map((m) => ({
    role: m.role as 'user' | 'assistant',
    text: hide(m.text || ''),
    ...(m.role === 'assistant' && m.model ? { model: m.model } : {}),
    ...(m.files?.length ? { files: m.files.filter((f) => !f.auto).map((f) => hide(f.name)) } : {}),
  })).slice(-MAX_MESSAGES);
  // Keep the newest messages if the chat is too long for one document.
  while (messages.length > 1 && messages.reduce((n, m) => n + m.text.length, 0) > MAX_CHARS) messages = messages.slice(1);
  return { title: hide(chat.title || 'Shared chat').slice(0, 200), messages, masked: mask };
}

/** Creates the link, or refreshes the existing one for this chat with its latest messages. */
export async function shareChat(owner: string, chat: Chat, mask: boolean, existing?: string): Promise<string> {
  const id = existing || newId();
  await setDoc(doc(db, COLLECTION, id), { owner, chatId: chat.id, ...payload(chat, mask), v: 1, updatedAt: serverTimestamp(), ...(existing ? {} : { createdAt: serverTimestamp() }) }, { merge: Boolean(existing) });
  return id;
}

export async function listShares(owner: string): Promise<ShareInfo[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), where('owner', '==', owner)));
  return snap.docs.map((d) => {
    const x = d.data();
    return { id: d.id, chatId: x.chatId, title: x.title, masked: Boolean(x.masked), updatedAt: x.updatedAt?.toMillis?.() || 0 };
  }).sort((a, b) => b.updatedAt - a.updatedAt);
}

export const stopSharing = (id: string) => deleteDoc(doc(db, COLLECTION, id));

/** Reads a shared chat for the public page (works signed out). */
export async function readShare(id: string): Promise<SharedChat | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  const x = snap.data();
  return { id, title: String(x.title || 'Shared chat'), messages: Array.isArray(x.messages) ? x.messages : [], masked: Boolean(x.masked), updatedAt: x.updatedAt?.toMillis?.() };
}
