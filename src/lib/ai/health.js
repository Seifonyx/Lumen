// Short, device-local cooldowns for transient failures. Never retire a model or share these.
const cooldowns = new Map();
const timings = new Map();
const MAX_TIMINGS = 128;
const TIMING_TTL = 30 * 60_000;
// Only compare ordinary, short-context chats. Document and reasoning latency is different.
export function replyLatency(id) {
  const sample = timings.get(id);
  if (!sample || Date.now() - sample.at > TIMING_TTL) { timings.delete(id); return null; }
  return sample.count >= 2 ? sample.ms : null;
}
export function noteReplyLatency(id, ms) {
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
export function noteFailure(id, status) {
  if (status >= 500 || ['timeout', 'network', 'empty'].includes(status)) cooldowns.set(id, Date.now() + 90_000);
}
export function noteSuccess(id) { cooldowns.delete(id); }
export function clearHealth() { cooldowns.clear(); timings.clear(); }
