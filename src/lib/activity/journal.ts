// Activity journal: a short, per-account record of what Lumen did on this device that saved chats don't show —
// model-list refreshes that changed state, keys added or removed (names only), limits reached, sync slowing or
// pausing, model checks. Requests themselves come from saved chats (see ./log.ts), so they are never counted twice.
//
// Stored in this browser only (localStorage `mr.activity.v1.<uid>`, removed with the rest of the account's local data),
// capped at MAX events and KEEP_DAYS days. Never holds prompts, answers, chat titles, keys or provider response text:
// every string passes through `redact`, and callers pass Lumen's own wording.

export type EventCategory = 'provider' | 'limit' | 'sync' | 'settings' | 'models';
export type EventLevel = 'success' | 'info' | 'warning' | 'error';

export interface ActivityEvent {
  id: string;
  at: number;
  category: EventCategory;
  level: EventLevel;
  /** Lumen's own one-line wording, e.g. "Model list refreshed". */
  title: string;
  detail?: string;
  provider?: string;
  model?: string;
  /** Repeats of the same event inside DEDUPE_MS are folded into one entry. */
  count?: number;
}

const MAX = 500, KEEP_DAYS = 30, DEDUPE_MS = 60_000, DAY = 864e5;
const keyFor = (uid: string) => `mr.activity.v1.${uid}`;

let uid: string | null = null;
let events: ActivityEvent[] = [];
const listeners = new Set<(events: readonly ActivityEvent[]) => void>();

/** Strips anything that looks like a credential or a URL query before it is stored. */
export function redact(text: string): string {
  return text
    .replace(/\b(sk|gsk|csk|pk|rk|xai|AIza)[-_A-Za-z0-9]{8,}/g, '[key]')
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [hidden]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[id]')
    .replace(/(https?:\/\/[^\s?#]+)\?[^\s]*/g, '$1')
    .slice(0, 240);
}

function read(id: string): ActivityEvent[] {
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(id)) || '[]');
    return Array.isArray(raw) ? raw.filter((e) => e && typeof e.at === 'number' && typeof e.title === 'string') : [];
  } catch { return []; }
}
function write() {
  if (!uid) return;
  try { localStorage.setItem(keyFor(uid), JSON.stringify(events)); } catch { /* storage full or private mode: keep in memory */ }
}
const prune = (list: ActivityEvent[], now = Date.now()) => list.filter((e) => e.at >= now - KEEP_DAYS * DAY).slice(-MAX);
const emit = () => { for (const fn of listeners) fn(events); };

/** Switches the journal to an account (or none, when signed out). Each account only ever sees its own events. */
export function setJournalAccount(next: string | null) {
  if (next === uid) return;
  uid = next;
  events = next ? prune(read(next)) : [];
  emit();
}

export function record(event: Omit<ActivityEvent, 'id' | 'at' | 'count'> & { at?: number }) {
  if (!uid) return;
  const at = event.at ?? Date.now();
  const clean: ActivityEvent = { ...event, id: `${at.toString(36)}-${Math.random().toString(36).slice(2, 8)}`, at, title: redact(event.title), ...(event.detail ? { detail: redact(event.detail) } : {}) };
  const last = events.findLast((e) => e.title === clean.title && e.provider === clean.provider && e.model === clean.model && e.level === clean.level);
  if (last && at - last.at < DEDUPE_MS) { last.count = (last.count || 1) + 1; last.at = at; }
  else events = prune([...events, clean], at);
  events = [...events];
  write();
  emit();
}

export const journal = () => events;
export function subscribe(fn: (events: readonly ActivityEvent[]) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
/** Clears this account's journal on this device (the Logs "Clear" action). Saved chats are untouched. */
export function clearJournal() { events = []; write(); emit(); }
