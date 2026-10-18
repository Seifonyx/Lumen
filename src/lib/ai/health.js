// Short, device-local cooldowns for transient failures. Never retire a model or share these.
import { isUnavailableFailure } from './model-status.js';

const cooldowns = new Map();
const timings = new Map();
const MAX_TIMINGS = 128;
const TIMING_TTL = 6 * 3600_000;
let scope = null;
/** Opaque account/configuration fingerprint; never pass credentials themselves. */
export const healthScope = () => scope;
export function setHealthScope(next) {
  if (next !== null && (typeof next !== 'string' || !/^[a-f0-9]{64}$/.test(next))) throw new TypeError('Health scope must be a SHA-256 fingerprint or null.');
  if (next !== null && next === scope) return;
  scope = next;
  clearHealth();
  record = null;
}
// Only compare ordinary, short-context chats. Document and reasoning latency is different.
export function replyLatency(id) {
  const sample = timings.get(id);
  if (!sample || Date.now() - sample.at > TIMING_TTL) { timings.delete(id); return null; }
  return sample.count >= 2 ? sample.ms : null;
}
export function noteReplyLatency(id, ms, expectedScope = scope) {
  if (expectedScope !== scope) return;
  if (!Number.isFinite(ms) || ms < 0 || ms > 120_000) return;
  const old = timings.get(id);
  const fresh = old && Date.now() - old.at <= TIMING_TTL;
  timings.delete(id);
  timings.set(id, { ms: fresh ? old.ms * 0.65 + ms * 0.35 : ms, count: fresh ? old.count + 1 : 1, at: Date.now() });
  if (timings.size > MAX_TIMINGS) timings.delete(timings.keys().next().value);
}
export function isCoolingDown(id) {
  const until = cooldowns.get(id) || 0;
  if (until <= Date.now()) { cooldowns.delete(id); return false; }
  return true;
}

// Track record: how often each model actually answered, remembered on this device across visits.
// Older results fade (half weight after about a week), so a model that improves recovers.
const recordKey = () => `mr.modelRecord.v2.${scope}`;
const HALF_LIFE = 7 * 24 * 3600_000;
let record = null;
const loadRecord = () => {
  if (record) return record;
  record = Object.create(null);
  if (scope === null) return record;
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(recordKey()) || '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return record;
    const now = Date.now();
    const entries = Object.entries(saved).filter(([, r]) => r && !Array.isArray(r) &&
      Number.isFinite(r.ok) && Number.isFinite(r.n) && Number.isFinite(r.at) &&
      r.ok >= 0 && r.n > 0 && r.ok <= r.n && r.at >= 0 && r.at <= now);
    entries.sort((a, b) => b[1].at - a[1].at).slice(0, 400).forEach(([id, r]) => { record[id] = { ok: r.ok, n: r.n, at: r.at }; });
  } catch { /* optional or malformed local history */ }
  return record;
};
const saveRecord = () => { if (scope === null) return; try { globalThis.localStorage?.setItem(recordKey(), JSON.stringify(record)); } catch { /* storage full or blocked */ } };
function noteOutcome(id, ok) {
  const all = loadRecord();
  const now = Date.now(), old = all[id];
  const fade = old ? Math.pow(0.5, (now - old.at) / HALF_LIFE) : 0;
  all[id] = { ok: (old ? old.ok * fade : 0) + (ok ? 1 : 0), n: (old ? old.n * fade : 0) + 1, at: now };
  const ids = Object.keys(all);
  if (ids.length > 400) ids.sort((a, b) => all[a].at - all[b].at).slice(0, ids.length - 400).forEach((k) => delete all[k]);
  saveRecord();
}
/** Share of recent attempts that answered (0–1), or null with too little history to judge. */
export function reliability(id) {
  const r = loadRecord()[id];
  if (!r) return null;
  const fade = Math.pow(0.5, (Date.now() - r.at) / HALF_LIFE);
  const n = r.n * fade;
  return n >= 2 ? (r.ok * fade + 1) / (n + 2) : null; // gently pulled toward 50% until there's history
}

export function noteFailure(id, status, message = '', expectedScope = scope) {
  if (expectedScope !== scope) return;
  if (status >= 500 || ['timeout', 'network', 'empty'].includes(status)) cooldowns.set(id, Date.now() + 90_000);
  // Quota and rejected credentials say nothing about a model's ability to answer.
  // Explicit model-access failures still matter, even when the provider uses 403.
  if (status !== 429 && status !== 401 && (status !== 403 || isUnavailableFailure(status, message))) noteOutcome(id, false);
}
export function noteSuccess(id, expectedScope = scope) { if (expectedScope !== scope) return; cooldowns.delete(id); noteOutcome(id, true); }
export function clearHealth() { cooldowns.clear(); timings.clear(); }
/** Forgets the track record (tests). */
export function clearRecord() { record = Object.create(null); saveRecord(); }
