// Imports chat history exported from ChatGPT, Claude or Gemini (or a Lumen backup) as Lumen chats.
//  ChatGPT: Settings → Data controls → Export data. A .zip with conversations.json.
//  Claude:  Settings → Privacy → Export data. A .zip with conversations.json.
//  Gemini:  Google Takeout → "My Activity" → Gemini Apps. MyActivity.json (or .html). It has no
//           conversations, only prompts and replies, so ones less than 30 minutes apart become one chat.
// The zip or the file inside it both work. Imported chats keep their ids, so importing again updates them.

import type { Chat, Message } from '../types';

export type ImportSource = 'ChatGPT' | 'Claude' | 'Gemini' | 'Lumen';
export interface ImportResult { source: ImportSource; chats: Chat[] }

const GAP_MS = 30 * 60_000;
const ms = (v: unknown) => {
  if (typeof v === 'number') return v < 1e12 ? Math.round(v * 1000) : v;
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : 0;
};
const titleOf = (title: unknown, messages: Message[]) => {
  const t = typeof title === 'string' ? title.trim() : '';
  return (t || messages.find((m) => m.role === 'user')?.text.replace(/\s+/g, ' ').slice(0, 60) || 'Imported chat').slice(0, 120);
};
function chat(id: string, title: unknown, messages: Message[], source: ImportSource, created?: number, updated?: number): Chat | null {
  if (!messages.length) return null;
  const createdAt = created || messages[0].createdAt;
  return { id, title: titleOf(title, messages), createdAt, updatedAt: Math.max(updated || 0, messages[messages.length - 1].createdAt, createdAt), messages, tags: [source] };
}

/** ChatGPT keeps every branch; this follows the one you ended on (current_node back to the start). */
export function fromChatGPT(list: any[]): Chat[] {
  const out: Chat[] = [];
  for (const c of list) {
    if (!c || typeof c.mapping !== 'object') continue;
    const created = ms(c.create_time);
    let node = c.current_node && c.mapping[c.current_node] ? c.current_node : Object.keys(c.mapping).find((k) => !c.mapping[k]?.children?.length);
    const path: any[] = [];
    for (let guard = 0; node && c.mapping[node] && guard < 20000; guard++) { path.push(c.mapping[node]); node = c.mapping[node].parent; }
    const messages: Message[] = [];
    for (const n of path.reverse()) {
      const m = n.message;
      const role = m?.author?.role;
      if (role !== 'user' && role !== 'assistant') continue;
      if (m.metadata?.is_visually_hidden_from_conversation || m.recipient && m.recipient !== 'all') continue;
      const type = m.content?.content_type;
      if (type !== 'text' && type !== 'multimodal_text' && type !== 'code') continue;
      const text = type === 'code' ? (m.content.text ? '```\n' + m.content.text + '\n```' : '')
        : (m.content?.parts || []).map((p: unknown) => (typeof p === 'string' ? p : (p as any)?.content_type === 'image_asset_pointer' ? '[image]' : '')).filter(Boolean).join('\n\n');
      if (!text.trim()) continue;
      // Consecutive replies (tool steps) read as one.
      const last = messages[messages.length - 1];
      if (last && last.role === role && role === 'assistant') { last.text += '\n\n' + text; continue; }
      messages.push({ id: `${m.id || messages.length}`, role, text, createdAt: ms(m.create_time) || created || Date.now(), status: role === 'assistant' ? 'done' : undefined });
    }
    const made = chat(`import-chatgpt-${c.conversation_id || c.id || created}`, c.title, messages, 'ChatGPT', created, ms(c.update_time));
    if (made) out.push(made);
  }
  return out;
}

export function fromClaude(list: any[]): Chat[] {
  const out: Chat[] = [];
  for (const c of list) {
    if (!c || !Array.isArray(c.chat_messages)) continue;
    const messages: Message[] = [];
    for (const m of c.chat_messages) {
      const role = m.sender === 'human' ? 'user' : m.sender === 'assistant' ? 'assistant' : null;
      if (!role) continue;
      let text = typeof m.text === 'string' && m.text.trim() ? m.text
        : (m.content || []).filter((p: any) => p?.type === 'text' && typeof p.text === 'string').map((p: any) => p.text).join('\n\n');
      const files = [...(m.attachments || []), ...(m.files || [])].map((f: any) => f?.file_name).filter(Boolean);
      if (files.length) text = `[Attached: ${files.join(', ')}]\n${text}`;
      if (!text.trim()) continue;
      messages.push({ id: m.uuid || `${messages.length}`, role, text, createdAt: ms(m.created_at) || ms(c.created_at) || Date.now(), status: role === 'assistant' ? 'done' : undefined });
    }
    const made = chat(`import-claude-${c.uuid || ms(c.created_at)}`, c.name, messages, 'Claude', ms(c.created_at), ms(c.updated_at));
    if (made) out.push(made);
  }
  return out;
}

/** Gemini's reply HTML as plain text with paragraphs and list items kept. */
export function htmlText(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('br').forEach((b) => b.replaceWith('\n'));
  doc.querySelectorAll('li').forEach((li) => li.prepend('- '));
  doc.querySelectorAll('h1, h2, h3, h4').forEach((h) => h.prepend('#'.repeat(Math.min(4, Number(h.tagName[1]) + 1)) + ' '));
  doc.querySelectorAll('p, li, h1, h2, h3, h4, pre, tr, div').forEach((el) => el.append('\n'));
  return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

interface Turn { prompt: string; reply: string; time: number }
function geminiChats(turns: Turn[]): Chat[] {
  turns.sort((a, b) => a.time - b.time);
  const out: Chat[] = [];
  let group: Turn[] = [];
  const close = () => {
    if (!group.length) return;
    const messages: Message[] = group.flatMap((t, i) => [
      { id: `u${i}`, role: 'user' as const, text: t.prompt, createdAt: t.time },
      ...(t.reply ? [{ id: `a${i}`, role: 'assistant' as const, text: t.reply, createdAt: t.time + 1, status: 'done' as const }] : []),
    ]);
    const made = chat(`import-gemini-${group[0].time}`, '', messages, 'Gemini');
    if (made) out.push(made);
    group = [];
  };
  for (const t of turns) {
    if (group.length && t.time - group[group.length - 1].time > GAP_MS) close();
    group.push(t);
  }
  close();
  return out;
}

export function fromGeminiJson(list: any[]): Chat[] {
  const turns: Turn[] = [];
  for (const e of list) {
    if (typeof e?.title !== 'string' || !/^Prompted /.test(e.title)) continue;
    const reply = (e.safeHtmlItem || []).map((h: any) => (typeof h?.html === 'string' ? htmlText(h.html) : '')).join('\n\n');
    turns.push({ prompt: e.title.replace(/^Prompted /, ''), reply, time: ms(e.time) || Date.now() });
  }
  return geminiChats(turns);
}

export function fromGeminiHtml(html: string): Chat[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const turns: Turn[] = [];
  for (const cell of doc.querySelectorAll('.outer-cell')) {
    const body = cell.querySelector('.content-cell');
    if (!body) continue;
    const full = body.innerHTML;
    const m = /^\s*Prompted(?:&nbsp;|\s)([\s\S]*?)<br\s*\/?>([\s\S]*?)<br\s*\/?>([\s\S]*)$/.exec(full);
    if (!m) continue;
    const prompt = htmlText(m[1]);
    const time = Date.parse(htmlText(m[2]).replace(/ /g, ' ').replace(/\s[A-Z]{2,5}$/, '')) || Date.now();
    turns.push({ prompt, reply: htmlText(m[3]), time });
  }
  return geminiChats(turns.filter((t) => t.prompt));
}

/** Works out which app a parsed file came from. */
export function fromData(data: unknown): ImportResult | null {
  if (Array.isArray(data)) {
    const first = data.find((x) => x && typeof x === 'object');
    if (!first) return null;
    if ('mapping' in first) return { source: 'ChatGPT', chats: fromChatGPT(data) };
    if ('chat_messages' in first) return { source: 'Claude', chats: fromClaude(data) };
    if ('header' in first && 'title' in first) return { source: 'Gemini', chats: fromGeminiJson(data) };
    if ('messages' in first && 'id' in first) return { source: 'Lumen', chats: data as Chat[] };
    return null;
  }
  if (data && typeof data === 'object' && Array.isArray((data as any).chats)) return { source: 'Lumen', chats: (data as any).chats };
  return null;
}

/** Reads an export file (.zip, .json or Gemini's .html). Throws if it isn't one Lumen knows. */
export async function readImport(file: File): Promise<ImportResult> {
  let name = file.name.toLowerCase();
  let text: string;
  if (name.endsWith('.zip') || file.type === 'application/zip') {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files).filter((f) => !f.dir);
    const pick = entries.find((f) => /(^|\/)conversations\.json$/i.test(f.name))
      || entries.find((f) => /gemini[^/]*\/MyActivity\.json$/i.test(f.name))
      || entries.find((f) => /gemini[^/]*\/MyActivity\.html$/i.test(f.name))
      || entries.find((f) => /\.json$/i.test(f.name) && /lumen-backup/i.test(f.name));
    if (!pick) throw new Error('no export');
    name = pick.name.toLowerCase();
    text = await pick.async('string');
  } else text = await file.text();
  if (name.endsWith('.html') || /^\s*</.test(text)) {
    const chats = fromGeminiHtml(text);
    if (!chats.length) throw new Error('no chats');
    return { source: 'Gemini', chats };
  }
  const result = fromData(JSON.parse(text));
  if (!result) throw new Error('unknown');
  return result;
}
