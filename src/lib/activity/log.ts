// One log for the Activity page: every request outcome saved in this account's chats, plus the device journal's events.
// Each entry is typed, has a stable id, and carries only Lumen's own wording: never prompts, answers, provider response
// text or keys. Chat titles are attached but shown or exported only when the person turns them on.
import type { Chat } from '../../types';
import { isTemporaryChat } from '../temporary-chat';
import { rerouteReason } from '../reroute';
import type { ActivityEvent, EventLevel } from './journal';

export type LogCategory = 'request' | ActivityEvent['category'];
export type LogLevel = EventLevel;
export interface LogEntry {
  id: string;
  at: number;
  category: LogCategory;
  level: LogLevel;
  title: string;
  detail?: string;
  model?: string;
  provider?: string;
  count?: number;
  /** Where the entry comes from: a saved chat (synced with the account) or this device's journal. */
  source: 'saved-chat' | 'device';
  chatId?: string;
  messageId?: string;
  chatTitle?: string;
  route?: string;
}

export const CATEGORY_LABEL: Record<LogCategory, string> = { request: 'Requests', provider: 'Providers', limit: 'Limits', sync: 'Sync', settings: 'Keys & settings', models: 'Models' };
export const LEVEL_LABEL: Record<LogLevel, string> = { success: 'Success', info: 'Info', warning: 'Warning', error: 'Error' };

/** A category for a failed request's error, so provider messages (which can quote a request) are never repeated. */
export function errorKind(error = '') {
  if (/quota|rate.?limit|exhausted|usage limit|429/i.test(error)) return 'Usage limit reached';
  if (/key|unauthori[sz]ed|401|403|refused/i.test(error)) return 'Provider refused the key';
  if (/time(d)? ?out|didn.t respond/i.test(error)) return 'Timed out';
  if (/network|offline|fetch|reach/i.test(error)) return 'Network problem';
  if (/overloaded|unavailable|50\d|down/i.test(error)) return 'Provider unavailable';
  if (/context|too long|too large|tokens/i.test(error)) return 'Too long for the model';
  return 'Failed';
}

const providerOf = (model: string) => model.split(':')[0];

export function requestEntries(chats: Chat[]): LogEntry[] {
  const out: LogEntry[] = [];
  for (const c of chats) {
    if (isTemporaryChat(c)) continue;
    for (const m of c.messages) {
      if (m.role !== 'assistant' || !m.model || !['done', 'error', 'stopped', 'streaming'].includes(m.status || '')) continue;
      const reroute = rerouteReason(m.notices);
      const [title, level, detail]: [string, LogLevel, string | undefined] =
        m.status === 'streaming' ? ['In progress', 'info', 'Answer still arriving']
          : m.status === 'error' ? ['Request failed', 'error', errorKind(m.error)]
          : m.status === 'stopped' ? ['Request stopped', 'warning', 'Stopped before the answer finished']
            : reroute ? ['Answered after rerouting', 'warning', reroute] : ['Answered', 'success', undefined];
      out.push({ id: `req:${c.id}:${m.id}`, at: m.createdAt, category: 'request', level, title, detail, model: m.model, provider: providerOf(m.model), source: 'saved-chat', chatId: c.id, messageId: m.id, chatTitle: c.title, route: m.route });
    }
  }
  return out;
}

export function buildLog(chats: Chat[], events: readonly ActivityEvent[]): LogEntry[] {
  const device: LogEntry[] = events.map((e) => ({ id: `dev:${e.id}`, at: e.at, category: e.category, level: e.level, title: e.title, detail: e.detail, model: e.model, provider: e.provider ?? (e.model ? providerOf(e.model) : undefined), count: e.count, source: 'device' }));
  return [...requestEntries(chats), ...device].sort((a, b) => b.at - a.at);
}

export type Range = 'today' | '24h' | '7d' | '30d' | 'all' | { from: number; to: number };
const DAY = 864e5;
export function rangeBounds(range: Range, now = Date.now()): [number, number] {
  if (typeof range === 'object') return [range.from, range.to];
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
  return range === 'today' ? [midnight.getTime(), Infinity] : range === '24h' ? [now - DAY, Infinity] : range === '7d' ? [now - 7 * DAY, Infinity] : range === '30d' ? [now - 30 * DAY, Infinity] : [0, Infinity];
}

export interface LogQuery { text?: string; categories?: LogCategory[]; levels?: LogLevel[]; range?: Range; order?: 'newest' | 'oldest'; titles?: boolean; modelLabel?: (id: string) => string }

/** Search, filter and sort. Search covers Lumen's wording, model and provider, ids, and chat titles only when shown. */
export function queryLog(entries: LogEntry[], q: LogQuery, now = Date.now()): LogEntry[] {
  const [from, to] = rangeBounds(q.range ?? 'all', now);
  const terms = (q.text || '').toLowerCase().split(/\s+/).filter(Boolean);
  const out = entries.filter((e) => {
    if (e.at < from || e.at > to) return false;
    if (q.categories?.length && !q.categories.includes(e.category)) return false;
    if (q.levels?.length && !q.levels.includes(e.level)) return false;
    if (!terms.length) return true;
    const hay = [e.title, e.detail, e.model, e.model && q.modelLabel?.(e.model), e.provider, e.id, e.route, q.titles && e.chatTitle, CATEGORY_LABEL[e.category], LEVEL_LABEL[e.level]].filter(Boolean).join(' ').toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
  return q.order === 'oldest' ? out.reverse() : out;
}

/** Export rows: the same fields the page shows. Chat titles only when the person chose to show them. */
export function exportRows(entries: LogEntry[], titles: boolean, modelLabel: (id: string) => string) {
  return entries.map((e) => ({ time: new Date(e.at).toISOString(), category: CATEGORY_LABEL[e.category], status: LEVEL_LABEL[e.level], event: e.title, detail: e.detail || '', model: e.model ? modelLabel(e.model) : '', modelId: e.model || '', provider: e.provider || '', repeats: e.count || 1, source: e.source === 'saved-chat' ? 'Saved chat' : 'This device', id: e.id, ...(titles ? { chat: e.chatTitle || '' } : {}) }));
}

export function toCsv(rows: Record<string, string | number>[]) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  // Quote every cell and neutralise spreadsheet formulas; a byte-order mark makes spreadsheet apps read UTF-8.
  const cell = (v: string | number) => `"${String(v).replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""')}"`;
  return '﻿' + [cols.join(','),...rows.map((r) => cols.map((c) => cell(r[c] ?? '')).join(','))].join('\r\n');
}
