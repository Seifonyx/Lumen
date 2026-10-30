// Quotas: one typed model for every allowance Lumen can actually measure, and one place that decides its state and
// forecast. A metric only carries numbers that came from somewhere real (a provider's reported limit, Lumen's own
// counters, the browser's storage estimate); a missing limit stays `null` ("unknown"), never a guess. Forecasts are
// labelled estimates and are made only when the period has run long enough to say anything.
//
// Extension point: add a source by returning more `QuotaMetric`s from `collectQuotas` (or a new collector that it
// calls). Nothing downstream assumes a category, unit or period: the UI groups, sorts and explains from these fields.
import type { UsageView } from '../usage';
import type { QuotaView } from '../quota';
import { FREE_LIMITS } from '../quota';

export type QuotaCategory = 'requests' | 'tokens' | 'credits' | 'operations' | 'storage';
/** provider: the provider told us (headers or account endpoint) · learned: a limit a provider reported earlier and
 * Lumen remembered · counted: Lumen's own counters (a lower bound when other devices or apps share it) · device: the
 * browser's own estimate. */
export type QuotaSource = 'provider' | 'learned' | 'counted' | 'device';
export type QuotaPeriod = { kind: 'day'; start: number; resetAt: number; timeZone: string } | { kind: 'minute'; resetAt: number } | { kind: 'none' };
export type QuotaState = 'ok' | 'warning' | 'critical' | 'exhausted' | 'blocked' | 'unknown' | 'unlimited';

export interface QuotaMetric {
  id: string;
  /** Who owns the allowance: a provider id, or 'lumen' / 'device'. */
  owner: string;
  label: string;
  category: QuotaCategory;
  unit: string;
  used: number | null;
  /** null: no limit known. Infinity: the owner says there is none. */
  limit: number | null;
  period: QuotaPeriod;
  source: QuotaSource;
  /** A provider block on this allowance (it answered "limit reached"), until this time. */
  blockedUntil?: number | null;
  /** True when other devices or apps can spend from the same allowance, so `used` is a lower bound. */
  shared?: boolean;
  note?: string;
}

export interface QuotaSettings { warnAt: number; criticalAt: number }
export const DEFAULT_THRESHOLDS: QuotaSettings = { warnAt: 0.8, criticalAt: 0.95 };

export const ratio = (m: QuotaMetric) => m.used !== null && m.limit && Number.isFinite(m.limit) ? m.used / m.limit : null;

export function stateOf(m: QuotaMetric, t: QuotaSettings = DEFAULT_THRESHOLDS, now = Date.now()): QuotaState {
  if (m.blockedUntil && m.blockedUntil > now) return 'blocked';
  if (m.limit === Infinity) return 'unlimited';
  const r = ratio(m);
  if (r === null) return 'unknown';
  return r >= 1 ? 'exhausted' : r >= t.criticalAt ? 'critical' : r >= t.warnAt ? 'warning' : 'ok';
}
export const needsAttention = (s: QuotaState) => s === 'warning' || s === 'critical' || s === 'exhausted' || s === 'blocked';

export interface Forecast {
  /** Projected use at the end of the period at today's average rate. An estimate. */
  projected: number;
  /** When the limit would be reached at that rate, if before the reset. */
  exhaustAt: number | null;
  ratePerHour: number;
}
const HOUR = 36e5, MIN_ELAPSED = HOUR, MIN_USED = 3;
/** Linear forecast over the current day: only when an hour has passed and a few units are used; otherwise null. */
export function forecast(m: QuotaMetric, now = Date.now()): Forecast | null {
  if (m.period.kind !== 'day' || m.used === null || m.used < MIN_USED) return null;
  const elapsed = now - m.period.start, left = m.period.resetAt - now;
  if (elapsed < MIN_ELAPSED || left <= 0) return null;
  const rate = m.used / elapsed;
  const projected = Math.round(m.used + rate * left);
  const exhaustAt = m.limit && Number.isFinite(m.limit) && m.used < m.limit ? now + (m.limit - m.used) / rate : null;
  return { projected, exhaustAt: exhaustAt && exhaustAt < m.period.resetAt ? exhaustAt : null, ratePerHour: rate * HOUR };
}

/** Words for what to do, in Lumen's voice. Only for states that need someone to act. */
export function advice(m: QuotaMetric, s: QuotaState): string | null {
  if (m.owner === 'lumen') return s === 'exhausted' || s === 'critical' ? 'Sync pauses near the limit; chats stay on each device and catch up after the reset.' : s === 'warning' ? 'Sync now sends changes in batches to stay inside the free plan.' : null;
  if (m.owner === 'device') return needsAttention(s) ? 'Delete chats or files you no longer need, or export and remove old ones.' : null;
  if (s === 'blocked' || s === 'exhausted') return 'Auto skips this model until the reset. Turn on “Switch models automatically” in Routing so other models answer.';
  if (s === 'critical' || s === 'warning') return 'Close to the limit. Add another free provider in Providers so Auto has somewhere to go.';
  return null;
}

const DAY = 864e5;
const periodOf = (resetAt: number, timeZone: string): QuotaPeriod => ({ kind: 'day', start: resetAt - DAY, resetAt, timeZone });

export interface QuotaInputs {
  usage: UsageView | null;
  cloud: QuotaView;
  storage?: { usage: number; quota: number } | null;
  label: (modelId: string) => string;
  providerName: (provider: string) => string;
  /** Next daily reset for a provider (its own time zone). */
  resetFor: (provider: string) => number;
  timeZoneFor: (provider: string) => string;
}

/** Every measurable allowance, from real data only. */
export function collectQuotas(i: QuotaInputs): QuotaMetric[] {
  const out: QuotaMetric[] = [];
  const models = Object.values(i.usage?.models || {});
  // Per-model daily requests: the limit is one a provider reported (headers or a "limit reached" answer).
  for (const m of models) {
    const owner = m.id.split(':')[0];
    if (owner === 'openrouter' && m.id.endsWith(':free')) continue; // counted in the shared pool below
    if (!m.requests && m.quota === null && !m.blockedUntil) continue;
    const reset = i.resetFor(owner);
    out.push({ id: `requests:${m.id}`, owner, label: i.label(m.id), category: 'requests', unit: 'requests', used: m.requests, limit: m.quota, period: m.blockScope === 'minute' && m.blockedUntil ? { kind: 'minute', resetAt: m.blockedUntil } : periodOf(reset, i.timeZoneFor(owner)), source: m.quota !== null ? 'learned' : 'counted', blockedUntil: m.blockedUntil, shared: true });
  }
  // Tokens per provider per day: Lumen counts them; providers rarely publish a daily token limit, so it stays unknown.
  const tokens = new Map<string, number>();
  for (const m of models) { const p = m.id.split(':')[0]; tokens.set(p, (tokens.get(p) || 0) + m.input + m.output); }
  for (const [p, n] of tokens) if (n > 0) out.push({ id: `tokens:${p}`, owner: p, label: 'Tokens today', category: 'tokens', unit: 'tokens', used: n, limit: null, period: periodOf(i.resetFor(p), i.timeZoneFor(p)), source: 'counted', shared: true });
  // OpenRouter's free models share one daily allowance, reported by OpenRouter for this key.
  if (i.usage && (i.usage.openrouter.used > 0 || i.usage.openrouter.limit !== null)) out.push({ id: 'requests:openrouter:free-pool', owner: 'openrouter', label: 'Free models (shared)', category: 'requests', unit: 'requests', used: i.usage.openrouter.used, limit: i.usage.openrouter.limit, period: periodOf(i.usage.openrouter.resetAt, 'UTC'), source: i.usage.openrouter.limit !== null ? 'provider' : 'counted', shared: true, note: 'Every free OpenRouter model draws from this one allowance.' });
  // Cloud sync: Firebase's free plan, counted by the app across everyone invited (approximate).
  const cloudReset = i.cloud.resetAt;
  for (const op of ['reads', 'writes', 'deletes'] as const) out.push({ id: `operations:sync:${op}`, owner: 'lumen', label: `Sync ${op}`, category: 'operations', unit: op, used: i.cloud.used[op], limit: FREE_LIMITS[op], period: periodOf(cloudReset, 'America/Los_Angeles'), source: 'counted', shared: true, note: 'Firebase free plan, shared by everyone invited. Counted by the app, so approximate.' });
  // This browser's storage for Lumen (chats, files and caches kept on the device).
  if (i.storage && i.storage.quota > 0) out.push({ id: 'storage:device', owner: 'device', label: 'Storage on this device', category: 'storage', unit: 'bytes', used: i.storage.usage, limit: i.storage.quota, period: { kind: 'none' }, source: 'device', note: 'The browser’s own estimate for this site.' });
  return out;
}

const ORDER: QuotaState[] = ['blocked', 'exhausted', 'critical', 'warning', 'ok', 'unknown', 'unlimited'];
/** Most urgent first, then the fullest. */
export function sortByUrgency(list: QuotaMetric[], t = DEFAULT_THRESHOLDS, now = Date.now()) {
  return [...list].sort((a, b) => ORDER.indexOf(stateOf(a, t, now)) - ORDER.indexOf(stateOf(b, t, now)) || (ratio(b) ?? -1) - (ratio(a) ?? -1) || a.label.localeCompare(b.label));
}

export function formatAmount(n: number, unit: string) {
  if (unit === 'bytes') { const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0, v = n; while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; } return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${u[i]}`; }
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : n.toLocaleString();
}
