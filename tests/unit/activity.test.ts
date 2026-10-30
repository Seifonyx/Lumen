import assert from 'node:assert/strict';
import { clearJournal, journal, record, redact, setJournalAccount } from '../../src/lib/activity/journal';
import { buildLog, errorKind, exportRows, queryLog, toCsv } from '../../src/lib/activity/log';
import { collectQuotas, forecast, sortByUrgency, stateOf, type QuotaMetric } from '../../src/lib/activity/quotas';
import { dueAlerts, thresholds } from '../../src/lib/activity/alerts';
import type { Chat, Message } from '../../src/types';

const store = new Map<string, string>();
Object.assign(globalThis, { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } });
const now = new Date(2026, 9, 30, 12).getTime(), HOUR = 36e5;
const msg = (id: string, status: Message['status'], createdAt: number, extra: Partial<Message> = {}): Message => ({ id, role: 'assistant', text: `PRIVATE_${id}`, model: 'gemini:flash', status, createdAt, ...extra });
const chats: Chat[] = [{ id: 'c1', title: 'PRIVATE TITLE', createdAt: now - 10 * HOUR, updatedAt: now, messages: [
  { id: 'u', role: 'user', text: 'PRIVATE PROMPT', createdAt: now - 9 * HOUR },
  msg('ok', 'done', now - 8 * HOUR),
  msg('bad', 'error', now - 2 * HOUR, { error: '401 Unauthorized: sk-or-v1-abcdefghijklmnop quoted PRIVATE PROMPT' }),
  msg('halt', 'stopped', now - HOUR),
  msg('live', 'streaming', now - 1000),
] } as Chat];

// ---- journal: per account, redacted, folded repeats, capped
setJournalAccount('a');
clearJournal();
record({ category: 'provider', level: 'error', provider: 'groq', title: 'Model list couldn’t refresh', detail: 'key gsk_ABCDEFGHIJKLMNOPQRST rejected https://x.test/v1?key=SECRET' });
record({ category: 'provider', level: 'error', provider: 'groq', title: 'Model list couldn’t refresh' });
assert.equal(journal().length, 1, 'repeats within a minute fold into one event');
assert.equal(journal()[0].count, 2);
assert(!/gsk_|SECRET/.test(journal()[0].detail || ''), 'keys and URL queries are redacted');
assert.equal(redact('Bearer abc.def.ghi'), 'Bearer [hidden]');
setJournalAccount('b');
assert.equal(journal().length, 0, 'another account sees none of the first account’s events');
setJournalAccount('a');
assert.equal(journal().length, 1, 'switching back restores the account’s own events');
setJournalAccount(null);
record({ category: 'sync', level: 'info', title: 'ignored' });
assert.equal(journal().length, 0, 'nothing is recorded while signed out');

// ---- log: saved-chat requests + device events; never message text
setJournalAccount('a');
const log = buildLog(chats, journal());
assert.deepEqual(log.map((e) => e.title), ['In progress', 'Request stopped', 'Request failed', 'Answered', 'Model list couldn’t refresh'].sort((a, b) => log.findIndex((e) => e.title === a) - log.findIndex((e) => e.title === b)));
const failed = log.find((e) => e.id === 'req:c1:bad')!;
assert.equal(failed.level, 'error');
assert.equal(failed.detail, 'Provider refused the key');
assert(!JSON.stringify(log.map(({ chatTitle, ...e }) => e)).includes('PRIVATE'), 'no prompt, answer or provider text in entries');
assert.equal(errorKind('429 Too Many Requests'), 'Usage limit reached');
assert.equal(queryLog(log, { text: 'refused' }, now).length, 1);
assert.equal(queryLog(log, { text: 'private title' }, now).length, 0, 'titles are searchable only when shown');
assert.equal(queryLog(log, { text: 'private title', titles: true }, now).length, 4);
assert.equal(queryLog(log, { levels: ['error'] }, now).length, 2);
assert.equal(queryLog(log, { categories: ['provider'] }, now).length, 1);
assert.equal(queryLog(log, { range: { from: now - 3 * HOUR, to: now - 1.5 * HOUR } }, now).length, 1);
assert.equal(queryLog(log, { order: 'oldest' }, now)[0].at, Math.min(...log.map((e) => e.at)));
const rows = exportRows(log, false, (id) => id);
assert(!('chat' in rows[0]), 'exports leave chat titles out unless shown');
const csv = toCsv([{ a: '=SUM(A1)', b: 'say "hi"' }]);
assert.equal(csv, '﻿a,b\r\n"\'=SUM(A1)","say ""hi"""', 'CSV quotes cells and neutralises formulas');
clearJournal();

// ---- quotas: real values only, states, forecasts
const day = { kind: 'day' as const, start: now - 12 * HOUR, resetAt: now + 12 * HOUR, timeZone: 'UTC' };
const m = (used: number | null, limit: number | null, extra: Partial<QuotaMetric> = {}): QuotaMetric => ({ id: `x${used}${limit}`, owner: 'gemini', label: 'X', category: 'requests', unit: 'requests', used, limit, period: day, source: 'learned', ...extra });
const t = thresholds(0.8);
assert.equal(stateOf(m(10, 100), t, now), 'ok');
assert.equal(stateOf(m(80, 100), t, now), 'warning');
assert.equal(stateOf(m(96, 100), t, now), 'critical');
assert.equal(stateOf(m(100, 100), t, now), 'exhausted');
assert.equal(stateOf(m(5, null), t, now), 'unknown', 'no limit is never guessed');
assert.equal(stateOf(m(5, Infinity), t, now), 'unlimited');
assert.equal(stateOf(m(1, 100, { blockedUntil: now + HOUR }), t, now), 'blocked', 'a provider block wins over the count');
assert.equal(thresholds(0.2).warnAt, 0.5, 'warning level is clamped to a sensible range');
const f = forecast(m(60, 100), now)!;
assert.equal(f.projected, 120, 'linear pace over the day');
assert.equal(f.exhaustAt, now + 8 * HOUR, 'runs out when the pace reaches the limit');
assert.equal(forecast(m(60, 100, { period: { ...day, start: now - 10 * 60_000 } }), now), null, 'no forecast in the first hour');
assert.equal(forecast(m(1, 100), now), null, 'no forecast from one or two requests');
assert.equal(forecast(m(10, 100, { period: { kind: 'none' } }), now), null);
assert.deepEqual(sortByUrgency([m(10, 100, { id: 'a' }), m(100, 100, { id: 'b' }), m(5, null, { id: 'c' })], t, now).map((x) => x.id), ['b', 'a', 'c']);

const metrics = collectQuotas({
  usage: { models: { 'gemini:flash': { id: 'gemini:flash', requests: 40, input: 100, output: 50, quota: 50, blockedUntil: null, blockScope: null }, 'groq:llama': { id: 'groq:llama', requests: 3, input: 0, output: 0, quota: null, blockedUntil: null, blockScope: null }, 'openrouter:x:free': { id: 'openrouter:x:free', requests: 9, input: 0, output: 0, quota: null, blockedUntil: null, blockScope: null } }, openrouter: { used: 9, limit: 50, resetAt: now + HOUR }, geminiResetAt: now + HOUR },
  cloud: { used: { reads: 10, writes: 2, deletes: 0 }, level: 'normal', resetAt: now + HOUR },
  storage: { usage: 1024, quota: 0 },
  label: (id) => id, providerName: (p) => p, resetFor: () => now + HOUR, timeZoneFor: () => 'UTC',
});
const byId = Object.fromEntries(metrics.map((x) => [x.id, x]));
assert.equal(byId['requests:gemini:flash'].limit, 50);
assert.equal(byId['requests:gemini:flash'].source, 'learned');
assert.equal(byId['requests:groq:llama'].limit, null, 'a counted model without a reported limit stays unknown');
assert(!byId['requests:openrouter:x:free'], 'free OpenRouter models count in the shared pool, not twice');
assert.equal(byId['requests:openrouter:free-pool'].used, 9);
assert.equal(byId['tokens:gemini'].used, 150);
assert.equal(byId['operations:sync:reads'].limit, 50_000);
assert(!byId['storage:device'], 'no storage metric when the browser reports no quota');

// ---- alerts: once per period per allowance, then once more when used up
const near = m(85, 100, { id: 'q' });
assert.equal(dueAlerts('u', [near], 0.8, now).length, 1);
assert.equal(dueAlerts('u', [near], 0.8, now).length, 0, 'no repeat in the same period');
assert.equal(dueAlerts('u', [{ ...near, used: 100 }], 0.8, now)[0].level, 'exhausted');
assert.equal(dueAlerts('u', [{ ...near, used: 100 }], 0.8, now).length, 0);
assert.equal(dueAlerts('u', [{ ...near, period: { ...day, resetAt: now + 36 * HOUR } }], 0.8, now).length, 1, 'a new period can alert again');
assert.equal(dueAlerts('u', [m(99, null, { id: 'z' })], 0.8, now).length, 0, 'unknown limits never alert');
console.log('PASS activity journal, log, quotas and alerts');
