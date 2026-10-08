// Usage meter: counts requests and tokens per model per day, remembers limits that providers report,
// and knows which models are blocked until their limit resets. Synced across devices via Firestore:
//   modelRouter/{uid}/usage/{provider}-{YYYY-MM-DD}   today's counts and daily blocks
//   modelRouter/{uid}/usage/quotas                    daily limits learned from providers

import { doc, increment, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { quota } from './quota';

export type Provider = 'gemini' | 'openrouter';
export interface LimitInfo {
  scope: 'day' | 'minute' | 'unknown';
  quota?: number;
  resetAt?: number;
  retryAfterSec?: number;
}
export interface ModelUsage {
  id: string;
  requests: number;
  input: number;
  output: number;
  /** daily request limit, if known */
  quota: number | null;
  /** blocked until this time (ms), if a limit was hit */
  blockedUntil: number | null;
  blockScope: 'day' | 'minute' | null;
}
export interface UsageView {
  models: Record<string, ModelUsage>;
  /** OpenRouter free models share one daily allowance */
  openrouter: { used: number; limit: number | null; resetAt: number };
  geminiResetAt: number;
}

// Google's free quotas reset at midnight Pacific time; OpenRouter's at midnight UTC.
const TZ: Record<Provider, string> = { gemini: 'America/Los_Angeles', openrouter: 'UTC' };

export const providerOf = (id: string): Provider => (id.startsWith('gemini:') ? 'gemini' : 'openrouter');
const enc = (id: string) => id.replace(/[^A-Za-z0-9]/g, '_');

export function dayKey(p: Provider, now = new Date()) {
  return `${p}-${new Intl.DateTimeFormat('en-CA', { timeZone: TZ[p], year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)}`;
}

/** The next midnight in the provider's time zone, as a timestamp. */
export function nextReset(p: Provider, now = Date.now()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ[p], hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' })
      .formatToParts(new Date(now))
      .map((x) => [x.type, Number(x.value)]),
  );
  const elapsed = ((parts.hour % 24) * 3600 + parts.minute * 60 + parts.second) * 1000 + (now % 1000);
  return now - elapsed + 86_400_000;
}

type DayDoc = {
  m?: Record<string, { id: string; requests?: number; input?: number; output?: number }>;
  b?: Record<string, { id: string; until: number; quota?: number }>;
};
type QuotaDoc = Record<string, { id: string; quota: number }>;

export class UsageTracker {
  private days: Record<Provider, DayDoc> = { gemini: {}, openrouter: {} };
  private quotas: QuotaDoc = {};
  private shortBlocks = new Map<string, number>();
  private unsubs: Unsubscribe[] = [];
  private dayTimer: ReturnType<typeof setTimeout> | undefined;
  /** counts not yet sent (sent in batches when the free-plan guard asks for it) */
  private pending = new Map<string, { requests: number; input: number; output: number }>();
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private stopQuota: (() => void) | null = null;
  openrouterDaily: number | null = null;

  constructor(private uid: string, private onChange: (v: UsageView) => void) {}

  private ref(id: string) {
    return doc(db, 'modelRouter', this.uid, 'usage', id);
  }

  start() {
    this.stop();
    for (const p of ['gemini', 'openrouter'] as Provider[]) {
      this.unsubs.push(
        onSnapshot(this.ref(dayKey(p)), (s) => {
          if (!s.metadata.fromCache && !s.metadata.hasPendingWrites) quota.count('reads');
          this.days[p] = (s.data() as DayDoc) || {};
          this.emit();
        }, () => {}),
      );
    }
    this.unsubs.push(
      onSnapshot(this.ref('quotas'), (s) => {
        if (!s.metadata.fromCache && !s.metadata.hasPendingWrites) quota.count('reads');
        this.quotas = (s.data() as QuotaDoc) || {};
        this.emit();
      }, () => {}),
    );
    // Start fresh counts when a provider's day rolls over.
    const soonest = Math.min(nextReset('gemini'), nextReset('openrouter'));
    this.dayTimer = setTimeout(() => this.start(), soonest - Date.now() + 2000);
    this.stopQuota = quota.subscribe((v) => {
      if (v.level !== 'paused' && this.pending.size && !this.flushTimer) this.flush();
    });
  }

  stop() {
    this.flush();
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    clearTimeout(this.dayTimer);
    this.stopQuota?.();
    this.stopQuota = null;
  }

  record(id: string, delta: { requests?: number; input?: number; output?: number }) {
    const p = this.pending.get(id) || { requests: 0, input: 0, output: 0 };
    p.requests += delta.requests || 0;
    p.input += delta.input || 0;
    p.output += delta.output || 0;
    this.pending.set(id, p);
    const level = quota.level();
    if (level === 'normal') this.flush();
    else {
      // Close to Firebase's free limit: send counts once a minute (or after the reset when paused).
      if (level === 'slow') this.flushTimer ??= setTimeout(() => this.flush(), 60_000);
      this.emit();
    }
  }

  private flush() {
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    if (!this.pending.size || quota.level() === 'paused') return;
    const byDay = new Map<string, Record<string, unknown>>();
    for (const [id, d] of this.pending) {
      const fields: Record<string, unknown> = { id };
      if (d.requests) fields.requests = increment(d.requests);
      if (d.input) fields.input = increment(d.input);
      if (d.output) fields.output = increment(d.output);
      const key = dayKey(providerOf(id));
      byDay.set(key, { ...(byDay.get(key) || {}), [enc(id)]: fields });
    }
    this.pending.clear();
    for (const [key, m] of byDay) {
      quota.count('writes');
      void setDoc(this.ref(key), { m }, { merge: true }).catch(() => {});
    }
  }

  block(id: string, limit: LimitInfo) {
    const p = providerOf(id);
    const now = Date.now();
    if (limit.scope === 'day') {
      const until = limit.resetAt && limit.resetAt > now ? limit.resetAt : nextReset(p);
      quota.count('writes');
      void setDoc(this.ref(dayKey(p)), { b: { [enc(id)]: { id, until, ...(limit.quota ? { quota: limit.quota } : {}) } } }, { merge: true }).catch(() => {});
      if (limit.quota && !(p === 'openrouter' && id.endsWith(':free'))) {
        quota.count('writes');
        void setDoc(this.ref('quotas'), { [enc(id)]: { id, quota: limit.quota } }, { merge: true }).catch(() => {});
      }
    } else {
      // Per-minute (or unspecified) limits clear quickly, so they stay on this device only.
      this.shortBlocks.set(id, now + Math.max(15, limit.retryAfterSec || 60) * 1000);
      setTimeout(() => this.emit(), Math.max(15, limit.retryAfterSec || 60) * 1000 + 500);
    }
    this.emit();
  }

  blockedUntil(id: string): number | null {
    const now = Date.now();
    const p = providerOf(id);
    const day = this.days[p].b?.[enc(id)]?.until || 0;
    const short = this.shortBlocks.get(id) || 0;
    // When the shared OpenRouter allowance is used up, every free model is blocked.
    const v = this.view();
    const pool = p === 'openrouter' && id.endsWith(':free') && v.openrouter.limit && v.openrouter.used >= v.openrouter.limit ? v.openrouter.resetAt : 0;
    const until = Math.max(day, short, pool);
    return until > now ? until : null;
  }

  view(): UsageView {
    const models: Record<string, ModelUsage> = {};
    const now = Date.now();
    let orUsed = 0;
    for (const p of ['gemini', 'openrouter'] as Provider[]) {
      for (const m of Object.values(this.days[p].m || {})) {
        models[m.id] = { id: m.id, requests: m.requests || 0, input: m.input || 0, output: m.output || 0, quota: null, blockedUntil: null, blockScope: null };
        if (p === 'openrouter' && m.id.endsWith(':free')) orUsed += m.requests || 0;
      }
      for (const b of Object.values(this.days[p].b || {})) {
        const u = (models[b.id] ??= { id: b.id, requests: 0, input: 0, output: 0, quota: null, blockedUntil: null, blockScope: null });
        if (b.until > now) {
          u.blockedUntil = b.until;
          u.blockScope = 'day';
        }
        if (b.quota && p === 'gemini') u.quota = b.quota;
      }
    }
    // Counts waiting to be sent.
    for (const [id, d] of this.pending) {
      const u = (models[id] ??= { id, requests: 0, input: 0, output: 0, quota: null, blockedUntil: null, blockScope: null });
      u.requests += d.requests;
      u.input += d.input;
      u.output += d.output;
      if (id.startsWith('openrouter:') && id.endsWith(':free')) orUsed += d.requests;
    }
    for (const q of Object.values(this.quotas)) {
      const u = (models[q.id] ??= { id: q.id, requests: 0, input: 0, output: 0, quota: null, blockedUntil: null, blockScope: null });
      u.quota ??= q.quota;
    }
    for (const [id, until] of this.shortBlocks) {
      if (until <= now) continue;
      const u = (models[id] ??= { id, requests: 0, input: 0, output: 0, quota: null, blockedUntil: null, blockScope: null });
      if (!u.blockedUntil || until > u.blockedUntil) {
        u.blockedUntil = until;
        u.blockScope = u.blockScope || 'minute';
      }
    }
    return {
      models,
      openrouter: { used: orUsed, limit: this.openrouterDaily, resetAt: nextReset('openrouter') },
      geminiResetAt: nextReset('gemini'),
    };
  }

  private emit() {
    this.onChange(this.view());
  }

  setOpenRouterDaily(limit: number | null) {
    this.openrouterDaily = limit;
    this.emit();
  }
}

/** Requests left today for a model, if its limit is known. */
export function remaining(v: UsageView | null, id: string): number | null {
  if (!v) return null;
  if (id.startsWith('openrouter:') && id.endsWith(':free')) {
    return v.openrouter.limit ? Math.max(0, v.openrouter.limit - v.openrouter.used) : null;
  }
  const u = v.models[id];
  return u?.quota ? Math.max(0, u.quota - u.requests) : null;
}

export const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function formatUntil(ts: number) {
  const mins = Math.round((ts - Date.now()) / 60000);
  if (mins < 1) return 'in a moment';
  if (mins < 60) return `in ${mins} min`;
  const sameDay = new Date(ts).toDateString() === new Date().toDateString();
  return `${sameDay ? 'at' : 'tomorrow at'} ${formatTime(ts)}`;
}

export const formatTokens = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));
