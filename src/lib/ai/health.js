// Short, device-local cooldowns for transient failures. Never retire a model or share these.
const cooldowns = new Map();
export function isCoolingDown(id) {
  const until = cooldowns.get(id) || 0;
  if (until <= Date.now()) { cooldowns.delete(id); return false; }
  return true;
}
export function noteFailure(id, status) {
  if (status >= 500 || ['timeout', 'network', 'empty'].includes(status)) cooldowns.set(id, Date.now() + 90_000);
}
export function noteSuccess(id) { cooldowns.delete(id); }
export function clearHealth() { cooldowns.clear(); }
