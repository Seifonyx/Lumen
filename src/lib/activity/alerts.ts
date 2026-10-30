// Quota alerts: at most one notice per allowance per period when it crosses the warning level, and one when it runs
// out. Remembered per account on this device, so a reload or a second tab doesn't repeat it. Off with one switch.
import type { QuotaMetric } from './quotas';
import { DEFAULT_THRESHOLDS, stateOf } from './quotas';

const keyFor = (uid: string) => `mr.quotaAlerts.${uid}`;
type Seen = Record<string, { period: number; level: 'warning' | 'exhausted' }>;

export function thresholds(warnAt?: number) {
  const warn = Math.min(0.95, Math.max(0.5, warnAt ?? DEFAULT_THRESHOLDS.warnAt));
  return { warnAt: warn, criticalAt: Math.max(warn, DEFAULT_THRESHOLDS.criticalAt) };
}

/** Returns the alerts to show now (and remembers them). Only metrics with a known, finite limit can alert. */
export function dueAlerts(uid: string, metrics: QuotaMetric[], warnAt?: number, now = Date.now()): { metric: QuotaMetric; level: 'warning' | 'exhausted' }[] {
  let seen: Seen = {};
  try { seen = JSON.parse(localStorage.getItem(keyFor(uid)) || '{}') || {}; } catch { /* private mode */ }
  const t = thresholds(warnAt), out: { metric: QuotaMetric; level: 'warning' | 'exhausted' }[] = [];
  for (const m of metrics) {
    if (m.limit === null || !Number.isFinite(m.limit) || m.period.kind !== 'day') continue;
    const s = stateOf({ ...m, blockedUntil: null }, t, now);
    const level = s === 'exhausted' ? 'exhausted' : s === 'warning' || s === 'critical' ? 'warning' : null;
    if (!level) continue;
    const prev = seen[m.id];
    if (prev && prev.period === m.period.resetAt && (prev.level === level || prev.level === 'exhausted')) continue;
    seen[m.id] = { period: m.period.resetAt, level };
    out.push({ metric: m, level });
  }
  for (const [id, v] of Object.entries(seen)) if (v.period < now) delete seen[id];
  if (out.length) try { localStorage.setItem(keyFor(uid), JSON.stringify(seen)); } catch { /* private mode */ }
  return out;
}
