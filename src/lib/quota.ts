// Free-plan guard. Firebase's free (Spark) plan allows 50,000 document reads, 20,000 writes and
// 20,000 deletes a day for the whole project (everyone invited shares it). Past that, the database
// simply stops answering until midnight Pacific time. The app counts its own use in a shared
// daily document (modelRouterShared/quota-YYYY-MM-DD) and backs off before reaching the limit:
//   slow    (≥ 60% of any limit): chat sync and usage counts are sent in batches
//   paused  (≥ 90%):              syncing stops; everything keeps working on this device and
//                                 catches up after the daily reset

import { doc, getDoc, increment, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { nextReset } from './usage';

export const FREE_LIMITS = { reads: 50_000, writes: 20_000, deletes: 20_000 } as const;
export type Op = keyof typeof FREE_LIMITS;
export type GuardLevel = 'normal' | 'slow' | 'paused';
export const SLOW_AT = 0.6;
export const PAUSE_AT = 0.9;

export interface QuotaView {
  used: Record<Op, number>;
  level: GuardLevel;
  resetAt: number;
}

const FLUSH_MS = 3 * 60_000;
const zero = (): Record<Op, number> => ({ reads: 0, writes: 0, deletes: 0 });

/** Today's date in Pacific time, when Firebase's free quotas reset. */
export function quotaDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

class QuotaGuard {
  /** counted on this device, not yet added to the shared total */
  private pending = zero();
  /** shared total for today, as last read */
  private shared = zero();
  private day = quotaDay();
  private timer: ReturnType<typeof setInterval> | undefined;
  private resetTimer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<(v: QuotaView) => void>();
  private lastLevel: GuardLevel = 'normal';
  private emitTimer: ReturnType<typeof setTimeout> | undefined;
  private active = false;
  private generation = 0;

  private ref() {
    return doc(db, 'modelRouterShared', `quota-${this.day}`);
  }

  /** Records Firebase operations made by the app. */
  count(op: Op, n = 1) {
    if (n <= 0) return;
    this.rollover();
    this.pending[op] += n;
    // Level changes are announced at once; plain count changes at most every 2 seconds.
    if (this.level() !== this.lastLevel) this.emit();
    else this.emitTimer ??= setTimeout(() => this.emit(), 2000);
  }

  /** Counted on this device since the last flush. */
  local(): Record<Op, number> {
    return { ...this.pending };
  }

  used(): Record<Op, number> {
    return { reads: this.shared.reads + this.pending.reads, writes: this.shared.writes + this.pending.writes, deletes: this.shared.deletes + this.pending.deletes };
  }

  level(): GuardLevel {
    const u = this.used();
    const worst = Math.max(...(Object.keys(FREE_LIMITS) as Op[]).map((k) => u[k] / FREE_LIMITS[k]));
    return worst >= PAUSE_AT ? 'paused' : worst >= SLOW_AT ? 'slow' : 'normal';
  }

  view(): QuotaView {
    return { used: this.used(), level: this.level(), resetAt: nextReset('gemini') };
  }

  subscribe(fn: (v: QuotaView) => void) {
    this.listeners.add(fn);
    fn(this.view());
    return () => this.listeners.delete(fn);
  }

  async start() {
    this.stop();
    this.active = true;
    const generation = this.generation;
    this.rollover();
    await this.refresh();
    if (!this.active || generation !== this.generation) return;
    this.timer = setInterval(() => void this.flush(), FLUSH_MS);
    document.addEventListener('visibilitychange', this.onHide);
    this.resetTimer = setTimeout(() => void this.start(), nextReset('gemini') - Date.now() + 5000);
  }

  stop() {
    this.active = false;
    this.generation++;
    clearInterval(this.timer);
    clearTimeout(this.resetTimer);
    clearTimeout(this.emitTimer);
    this.timer = this.resetTimer = this.emitTimer = undefined;
    document.removeEventListener('visibilitychange', this.onHide);
  }

  private onHide = () => {
    if (document.visibilityState === 'hidden') void this.flush();
  };

  /** Adds this device's counts to the shared total and reads the total back. */
  async flush() {
    if (!this.active) return;
    this.rollover();
    const generation = this.generation, day = this.day, ref = this.ref();
    const p = this.pending;
    if (!p.reads && !p.writes && !p.deletes) return;
    this.pending = zero();
    // The flush itself costs one write and one read.
    const delta = { reads: increment(p.reads + 1), writes: increment(p.writes + 1), deletes: increment(p.deletes), day };
    try {
      await setDoc(ref, delta, { merge: true });
      if (!this.current(generation, day)) return;
      await this.refresh(false);
    } catch {
      if (day !== this.day || day !== quotaDay()) return;
      // Costs belong to the shared project, so retain same-day unsent counts
      // across account changes without emitting or reviving the old session.
      (Object.keys(p) as Op[]).forEach((k) => (this.pending[k] += p[k]));
    }
  }

  private async refresh(countRead = true) {
    const generation = this.generation, day = this.day, ref = this.ref();
    try {
      const snap = await getDoc(ref);
      if (!this.current(generation, day)) return;
      const d = snap.data() || {};
      this.shared = { reads: Number(d.reads) || 0, writes: Number(d.writes) || 0, deletes: Number(d.deletes) || 0 };
      if (countRead) this.pending.reads += 1;
    } catch {
      // Offline: keep the last known totals.
    }
    if (this.current(generation, day)) this.emit();
  }

  private current(generation: number, day: string) {
    return this.active && generation === this.generation && day === this.day && day === quotaDay();
  }

  private rollover() {
    const today = quotaDay();
    if (today === this.day) return;
    this.day = today;
    this.shared = zero();
    this.pending = zero();
  }

  private emit() {
    clearTimeout(this.emitTimer);
    this.emitTimer = undefined;
    const v = this.view();
    this.lastLevel = v.level;
    this.listeners.forEach((fn) => fn(v));
  }
}

export const quota = new QuotaGuard();

// Local testing only (see firebase.ts): lets automated tests check the counts.
if (location.hostname === 'localhost' && new URLSearchParams(location.search).has('emulator')) {
  (window as unknown as Record<string, unknown>).__quota = quota;
}
