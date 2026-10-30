// Usage meter: counts requests and tokens per model per day, remembers limits that providers report,
// and knows which models are blocked until their limit resets. Synced across devices via Firestore:
//   modelRouter/{uid}/usage/{provider}-{YYYY-MM-DD}   today's counts and daily blocks
//   modelRouter/{uid}/usage/quotas                    daily limits learned from providers

import { doc, increment, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { quota } from './quota';
import { AI_PROVIDERS } from './ai/provider-config.js';

export type Provider = 'gemini' | 'openrouter' | 'groq' | 'cerebras' | 'mistral' | 'cohere' | 'nvidia' | 'huggingface' | 'deepseek' | 'alibaba' | 'cloudflare' | 'aion' | 'openai' | 'anthropic' | 'xai' | 'perplexity' | 'together' | 'fireworks' | 'deepinfra' | 'sambanova' | 'novita' | 'hyperbolic' | 'nebius' | 'scaleway' | 'ovh' | 'siliconflow' | 'chutes' | 'featherless' | 'zai' | 'moonshot' | 'venice' | 'baseten';
const PROVIDERS = AI_PROVIDERS as Provider[];
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

// Google's free quotas reset at midnight Pacific time; OpenRouter's, Groq's and Cerebras's at midnight UTC.
const TZ = Object.fromEntries(PROVIDERS.map(p => [p, p === 'gemini' ? 'America/Los_Angeles' : 'UTC'])) as Record<Provider, string>;
const DAY_FORMATTERS = Object.fromEntries(['UTC', 'America/Los_Angeles'].map(timeZone => [timeZone,
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }),
]));

/** The time zone a provider's daily allowances reset in. */
export const resetTimeZone = (p: string) => TZ[p as Provider] || 'UTC';

export const providerOf = (id: string): Provider => {
  const p = id.split(':')[0] as Provider;
  return PROVIDERS.includes(p) ? p : 'openrouter';
};
const enc = (id: string) => id.replace(/[^A-Za-z0-9]/g, '_');

export function dayKey(p: Provider, now = new Date()) {
  return `${p}-${DAY_FORMATTERS[TZ[p]].format(now)}`;
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
type Counts = { requests: number; input: number; output: number };

export class UsageTracker {
  private days = Object.fromEntries(PROVIDERS.map(p => [p, {}])) as Record<Provider, DayDoc>;
  /** Minimum usage observed on this device, independent of Firestore availability. */
  private localDays = Object.fromEntries(PROVIDERS.map(p => [p, {}])) as Record<Provider, DayDoc>;
  private dayKeys = Object.fromEntries(PROVIDERS.map(p => [p, dayKey(p)])) as Record<Provider, string>;
  private quotas: QuotaDoc = {};
  private localQuotas: QuotaDoc = {};
  private shortBlocks = new Map<string, number>();
  private unsubs: Unsubscribe[] = [];
  private dayTimer: ReturnType<typeof setTimeout> | undefined;
  /** Unsent counts retain their original provider/date, including after a rejected write. */
  private pending = new Map<string, Map<string, Counts>>();
  private inFlight = new Set<string>();
  private active = false;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private stopQuota: (() => void) | null = null;
  openrouterDaily: number | null = null;

  constructor(private uid: string, private onChange: (v: UsageView) => void) {}

  private ref(id: string) {
    return doc(db, 'modelRouter', this.uid, 'usage', id);
  }

  private currentDay(p: Provider) {
    const key = dayKey(p);
    if (this.dayKeys[p] !== key) {
      this.dayKeys[p] = key;
      this.days[p] = {};
      this.localDays[p] = {};
    }
    return key;
  }

  private addPending(key: string, id: string, delta: Counts) {
    const batch = this.pending.get(key) || new Map<string, Counts>();
    const previous = batch.get(id) || { requests: 0, input: 0, output: 0 };
    batch.set(id, { requests: previous.requests + delta.requests, input: previous.input + delta.input, output: previous.output + delta.output });
    this.pending.set(key, batch);
  }

  private scheduleFlush() {
    this.flushTimer ??= setTimeout(() => this.flush(), 60_000);
  }

  /** Providers whose daily counts are watched (each costs a Firebase read when the app opens). */
  private watched = new Set<Provider>(['gemini', 'openrouter']);
  private dayUnsubs = new Map<Provider, () => void>();

  private watch(p: Provider) {
    if (this.dayUnsubs.has(p)) return;
    const key = this.currentDay(p);
    const unsub = onSnapshot(this.ref(key), { includeMetadataChanges: true }, (s) => {
      // Local Firestore echoes already contain our in-flight increments. Wait for the
      // acknowledged snapshot instead of counting the same observation twice.
      if (this.currentDay(p) !== key || s.metadata.hasPendingWrites) return;
      if (!s.metadata.fromCache && !s.metadata.hasPendingWrites) quota.count('reads');
      this.days[p] = (s.data() as DayDoc) || {};
      this.emit();
    }, () => {});
    this.dayUnsubs.set(p, unsub);
  }

  /** Also watch these providers (called once their keys are known, e.g. Groq or Cerebras). */
  useProviders(ps: Provider[]) {
    for (const p of ps) {
      this.watched.add(p);
      if (this.unsubs.length) this.watch(p);
    }
  }

  start() {
    this.stop();
    this.active = true;
    this.emit();
    if (this.uid.startsWith('preview-')) return;
    for (const p of this.watched) this.watch(p);
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
    this.active = false;
    this.flush();
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.dayUnsubs.forEach((u) => u());
    this.dayUnsubs.clear();
    clearTimeout(this.dayTimer);
    this.stopQuota?.();
    this.stopQuota = null;
  }

  record(id: string, delta: { requests?: number; input?: number; output?: number }) {
    const provider = providerOf(id);
    const key = this.currentDay(provider);
    const previous = this.view().models[id];
    const d = { requests: delta.requests || 0, input: delta.input || 0, output: delta.output || 0 };
    (this.localDays[provider].m ??= {})[enc(id)] = {
      id, requests: (previous?.requests || 0) + d.requests, input: (previous?.input || 0) + d.input, output: (previous?.output || 0) + d.output,
    };
    if (!this.uid.startsWith('preview-')) this.addPending(key, id, d);
    const level = quota.level();
    if (level === 'normal') this.flush();
    // Close to Firebase's free limit: send counts once a minute (or after the reset when paused).
    else if (level === 'slow' && this.pending.size) this.scheduleFlush();
    this.emit();
  }

  private flush() {
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    if (this.uid.startsWith('preview-')) {
      this.pending.clear();
      return;
    }
    if (!this.pending.size || quota.level() === 'paused') return;
    const visible = this.view();
    for (const [key, batch] of this.pending) {
      if (this.inFlight.has(key)) continue;
      const m: Record<string, unknown> = {};
      for (const [id, d] of batch) {
        const fields: Record<string, unknown> = { id };
        if (d.requests) fields.requests = increment(d.requests);
        if (d.input) fields.input = increment(d.input);
        if (d.output) fields.output = increment(d.output);
        m[enc(id)] = fields;
        const provider = providerOf(id);
        if (this.currentDay(provider) === key) {
          const u = visible.models[id];
          (this.localDays[provider].m ??= {})[enc(id)] = { id, requests: u.requests, input: u.input, output: u.output };
        }
      }
      // New observations go into a different batch while this immutable batch is in flight.
      this.pending.delete(key);
      this.inFlight.add(key);
      quota.count('writes');
      void setDoc(this.ref(key), { m }, { merge: true }).then(() => {
        this.inFlight.delete(key);
        if (this.pending.size) {
          if (!this.active || quota.level() === 'normal') this.flush();
          else if (quota.level() === 'slow') this.scheduleFlush();
        }
      }).catch((error: unknown) => {
        this.inFlight.delete(key);
        const code = (error as { code?: string } | null)?.code;
        // Firestore retries transport failures itself. Only replay definite server
        // rejections; an ambiguous failed acknowledgment may already have committed.
        if (code && /^(?:firestore\/)?(?:permission-denied|unauthenticated|failed-precondition|resource-exhausted|aborted)$/.test(code)) {
          for (const [id, d] of batch) this.addPending(key, id, d);
        }
        if (this.active && this.pending.size && quota.level() !== 'paused') this.scheduleFlush();
        this.emit();
      });
    }
  }

  /** Told whenever a provider reports a limit, with when it lifts (the Activity journal listens). */
  onLimit?: (id: string, scope: LimitInfo['scope'], until: number) => void;

  block(id: string, limit: LimitInfo) {
    const p = providerOf(id);
    const now = Date.now();
    this.onLimit?.(id, limit.scope, limit.scope === 'day' ? (limit.resetAt && limit.resetAt > now ? limit.resetAt : nextReset(p)) : now + Math.max(15, limit.retryAfterSec || 60) * 1000);
    if (limit.scope === 'day') {
      const until = limit.resetAt && limit.resetAt > now ? limit.resetAt : nextReset(p);
      const key = this.currentDay(p);
      const blocks = (this.localDays[p].b ??= {});
      blocks[enc(id)] = { id, until: Math.max(until, blocks[enc(id)]?.until || 0), ...(limit.quota ? { quota: limit.quota } : {}) };
      if (limit.quota && !(p === 'openrouter' && id.endsWith(':free'))) this.localQuotas[enc(id)] = { id, quota: limit.quota };
      if (!this.uid.startsWith('preview-')) {
        quota.count('writes');
        void setDoc(this.ref(key), { b: { [enc(id)]: blocks[enc(id)] } }, { merge: true }).catch(() => {});
        if (limit.quota && !(p === 'openrouter' && id.endsWith(':free'))) {
          quota.count('writes');
          void setDoc(this.ref('quotas'), { [enc(id)]: { id, quota: limit.quota } }, { merge: true }).catch(() => {});
        }
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
    // When the shared OpenRouter allowance is used up, every free model is blocked.
    const v = this.view();
    const pool = p === 'openrouter' && id.endsWith(':free') && v.openrouter.limit && v.openrouter.used >= v.openrouter.limit ? v.openrouter.resetAt : 0;
    const until = Math.max(v.models[id]?.blockedUntil || 0, pool);
    return until > now ? until : null;
  }

  view(): UsageView {
    const models: Record<string, ModelUsage> = {};
    const now = Date.now();
    for (const p of PROVIDERS) {
      const key = this.currentDay(p);
      for (const m of Object.values(this.days[p].m || {})) {
        models[m.id] = { id: m.id, requests: m.requests || 0, input: m.input || 0, output: m.output || 0, quota: null, blockedUntil: null, blockScope: null };
      }
      for (const [id, d] of this.pending.get(key) || []) {
        const u = (models[id] ??= { id, requests: 0, input: 0, output: 0, quota: null, blockedUntil: null, blockScope: null });
        u.requests += d.requests;
        u.input += d.input;
        u.output += d.output;
      }
      // The server snapshot may already include our sent counts. A local floor
      // preserves them without adding them twice, including when sync is unavailable.
      // Concurrent remote usage is a lower bound until the write is acknowledged.
      for (const m of Object.values(this.localDays[p].m || {})) {
        const u = (models[m.id] ??= { id: m.id, requests: 0, input: 0, output: 0, quota: null, blockedUntil: null, blockScope: null });
        u.requests = Math.max(u.requests, m.requests || 0);
        u.input = Math.max(u.input, m.input || 0);
        u.output = Math.max(u.output, m.output || 0);
      }
      for (const b of [...Object.values(this.days[p].b || {}), ...Object.values(this.localDays[p].b || {})]) {
        const u = (models[b.id] ??= { id: b.id, requests: 0, input: 0, output: 0, quota: null, blockedUntil: null, blockScope: null });
        if (b.until > now && b.until > (u.blockedUntil || 0)) {
          u.blockedUntil = b.until;
          u.blockScope = 'day';
        }
        if (b.quota && p === 'gemini') u.quota = b.quota;
      }
    }
    for (const q of Object.values({ ...this.quotas, ...this.localQuotas })) {
      const u = (models[q.id] ??= { id: q.id, requests: 0, input: 0, output: 0, quota: null, blockedUntil: null, blockScope: null });
      u.quota ??= q.quota;
    }
    const orUsed = Object.values(models).filter(m => m.id.startsWith('openrouter:') && m.id.endsWith(':free')).reduce((total, m) => total + m.requests, 0);
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
