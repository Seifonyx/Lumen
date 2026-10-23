// What this account's saved chats record about answers (Canvas Routing Center): answers per day and model, and a short
// list of recent requests and how each ended. Read only from chats on this device; temporary chats are never kept, so
// they never count, and deleted chats leave the history. Never includes what you asked or what was answered.
import type { Chat } from '../types';
import { isTemporaryChat } from './temporary-chat';
import { rerouteReason } from './reroute';

const DAY = 864e5;
const dayStart = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function answersByDay(chats: Chat[], days = 14, now = Date.now()) {
  const start = dayStart(now) - (days - 1) * DAY;
  const counts = Array.from({ length: days }, (_, i) => ({ day: start + i * DAY, answers: 0, failed: 0 }));
  const byModel = new Map<string, number>();
  for (const c of chats) {
    if (isTemporaryChat(c)) continue;
    for (const m of c.messages) {
      if (m.role !== 'assistant' || !m.model || m.createdAt < start || m.status === 'streaming') continue;
      const slot = counts[Math.floor((dayStart(m.createdAt) - start) / DAY)];
      if (!slot) continue;
      if (m.status === 'error') slot.failed++;
      else { slot.answers++; byModel.set(m.model, (byModel.get(m.model) || 0) + 1); }
    }
  }
  return { days: counts, models: [...byModel].sort((a, b) => b[1] - a[1]) };
}

export type RequestRecord = { at: number; model: string; outcome: 'answered' | 'rerouted' | 'stopped' | 'failed'; detail: string; chatId: string; chatTitle: string };

/** The latest answers' outcomes; detail is the app's own wording (reroute reason or error kind), never message text. */
export function recentRequests(chats: Chat[], limit = 20): RequestRecord[] {
  const out: RequestRecord[] = [];
  for (const c of chats) {
    if (isTemporaryChat(c)) continue;
    for (const m of c.messages) {
      if (m.role !== 'assistant' || !m.model || m.status === 'streaming') continue;
      const reroute = rerouteReason(m.notices);
      const outcome = m.status === 'error' ? 'failed' : m.status === 'stopped' ? 'stopped' : reroute ? 'rerouted' : 'answered';
      out.push({ at: m.createdAt, model: m.model, outcome, detail: outcome === 'failed' ? errorKind(m.error) : reroute || '', chatId: c.id, chatTitle: c.title });
    }
  }
  return out.sort((a, b) => b.at - a.at).slice(0, limit);
}

/** A category for an error, so provider messages (which can quote a request) are not repeated. */
function errorKind(error = '') {
  if (/quota|rate.?limit|exhausted|usage limit|429/i.test(error)) return 'Usage limit';
  if (/key|unauthori[sz]ed|401|403|refused/i.test(error)) return 'Connection refused';
  if (/time(d)? ?out|didn.t respond/i.test(error)) return 'Timed out';
  if (/network|offline|fetch|reach/i.test(error)) return 'Network';
  if (/overloaded|unavailable|50\d|down/i.test(error)) return 'Provider unavailable';
  if (/context|too long|too large|tokens/i.test(error)) return 'Too long for the model';
  return 'Failed';
}
