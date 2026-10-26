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
  const counts = Array.from({ length: days }, (_, i) => ({ day: start + i * DAY, answers: 0, failed: 0, stopped: 0 }));
  const byModel = new Map<string, number>();
  for (const c of chats) {
    if (isTemporaryChat(c)) continue;
    for (const m of c.messages) {
      if (m.role !== 'assistant' || !m.model || m.createdAt < start || m.status === 'streaming') continue;
      const slot = counts[Math.floor((dayStart(m.createdAt) - start) / DAY)];
      if (!slot) continue;
      if (m.status === 'error') slot.failed++;
      else if (m.status === 'stopped') slot.stopped++;
      else { slot.answers++; byModel.set(m.model, (byModel.get(m.model) || 0) + 1); }
    }
  }
  return { days: counts, models: [...byModel].sort((a, b) => b[1] - a[1]) };
}

export type RequestRecord = { at: number; model: string; outcome: 'answered' | 'rerouted' | 'stopped' | 'failed'; detail: string; chatId: string; chatTitle: string };
export type RequestEvidence = Omit<RequestRecord, 'outcome'> & {
  outcome: RequestRecord['outcome'] | 'in-progress';
  route: string | null;
};

const requestOutcome = (status: import('../types').Message['status'], reroute?: string) =>
  status === 'streaming' ? 'in-progress' as const
    : status === 'error' ? 'failed' as const
      : status === 'stopped' ? 'stopped' as const
        : reroute ? 'rerouted' as const : 'answered' as const;

/** The latest answers' outcomes; detail is the app's own wording (reroute reason or error kind), never message text. */
export function recentRequests(chats: Chat[], limit = 20): RequestRecord[] {
  const out: RequestRecord[] = [];
  for (const c of chats) {
    if (isTemporaryChat(c)) continue;
    for (const m of c.messages) {
      if (m.role !== 'assistant' || !m.model || m.status === 'streaming') continue;
      const reroute = rerouteReason(m.notices);
      const outcome = requestOutcome(m.status, reroute);
      if (outcome === 'in-progress') continue;
      out.push({ at: m.createdAt, model: m.model, outcome, detail: outcome === 'failed' ? errorKind(m.error) : reroute || '', chatId: c.id, chatTitle: c.title });
    }
  }
  return out.sort((a, b) => b.at - a.at).slice(0, limit);
}

/** Latest saved request evidence, including an active stream. The caller supplies the already account-scoped chats. */
export function latestRequestEvidence(chats: Chat[]): RequestEvidence | null {
  let latest: RequestEvidence | null = null;
  for (const c of chats) {
    if (isTemporaryChat(c)) continue;
    for (const m of c.messages) {
      if (m.role !== 'assistant' || !m.model) continue;
      const reroute = rerouteReason(m.notices);
      const outcome = requestOutcome(m.status, reroute);
      const record: RequestEvidence = {
        at: m.createdAt,
        model: m.model,
        outcome,
        detail: outcome === 'failed' ? errorKind(m.error) : reroute || '',
        chatId: c.id,
        chatTitle: c.title,
        route: m.route || null,
      };
      if (!latest || record.at > latest.at) latest = record;
    }
  }
  return latest;
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
