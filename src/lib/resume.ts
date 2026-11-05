// Where you left off, so a relaunch opens the same screen: iOS ends a backgrounded Home Screen app whenever it needs the
// memory, and a refresh or a closed Safari tab starts over too. Like an iOS app's state restoration (HIG, Launching:
// "restore the previous state when your app restarts"), there is no time limit; what ends a snapshot is an event:
// signing out, another account, an incognito chat, New chat (the snapshot then names the new chat) or the chat or
// project no longer existing. Kept per account on this device only. It holds opaque ids and one scroll offset, never
// message text, drafts, keys or titles. Drafts and attachments stay with their own owners (Composer).
// Pure (no store import), so the store can apply it during sign-in and the screen history can be told about it.

/** A place opened from the drawer, restored as the screen's root. Pushed drill-downs (a provider, a document, a tool,
 *  a sheet) are not restored: their parent is, and the chat stays underneath as before. */
export type ResumePlace =
  | { kind: 'library'; tab?: string }
  | { kind: 'projects' }
  | { kind: 'router'; section: string }
  | { kind: 'settings'; tab: string };
export type ResumeAnchor = { id: string; offset: number };
export type Resume = {
  v: 1;
  /** The conversation on screen (or under the place); null for a new chat. */
  chat: string | null;
  /** A project's workspace that was open instead of a conversation. */
  workspace: string | null;
  place: ResumePlace | null;
  /** The message at the top of the conversation's view and how far below the view's top its top was. */
  anchor: ResumeAnchor | null;
};

const KEY = (uid: string) => `mr.resume.${uid}`;
const ID = /^[\w-]{1,128}$/;
const WORD = /^[a-z][a-z-]{0,31}$/;
const ROUTER_OWNED = new Set(['keys', 'models', 'layouts', 'usage']);
const id = (v: unknown) => (typeof v === 'string' && ID.test(v) ? v : null);

function place(v: unknown): ResumePlace | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  if (p.kind === 'projects') return { kind: 'projects' };
  if (p.kind === 'library') return typeof p.tab === 'string' && WORD.test(p.tab) ? { kind: 'library', tab: p.tab } : { kind: 'library' };
  if (p.kind === 'router' && typeof p.section === 'string' && WORD.test(p.section)) return { kind: 'router', section: p.section };
  // Sections that hold keys or that Router owns open as the Settings list instead (no key field is ever restored).
  if (p.kind === 'settings' && typeof p.tab === 'string') return { kind: 'settings', tab: WORD.test(p.tab) && !ROUTER_OWNED.has(p.tab) ? p.tab : '' };
  return null;
}

/** Reads and checks this account's snapshot: anything malformed reads as none. */
export function readResume(uid: string): Resume | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(uid)) || 'null') as Record<string, unknown> | null;
    if (!raw || raw.v !== 1) return null;
    const a = raw.anchor as Record<string, unknown> | null;
    const anchor = a && id(a.id) && typeof a.offset === 'number' && Number.isFinite(a.offset) ? { id: a.id as string, offset: Math.round(a.offset) } : null;
    return { v: 1, chat: id(raw.chat), workspace: id(raw.workspace), place: place(raw.place), anchor };
  } catch { return null; }
}

export function writeResume(uid: string, resume: Resume) {
  try { localStorage.setItem(KEY(uid), JSON.stringify(resume)); } catch { /* storage full or blocked: nothing is kept */ }
}

export function forgetResume(uid: string | null | undefined) {
  if (!uid) return;
  try { localStorage.removeItem(KEY(uid)); } catch { /* blocked */ }
}

/** What to open, given what this account has now: a chat or project that no longer exists falls back to a new chat
 *  (or no workspace), a missing message to the chat's usual landing, and incognito ids are never restored. */
export function resumeTarget(r: Resume | null, chats: readonly { id: string; messages: readonly { id: string }[] }[], projects: readonly { id: string }[]): Resume | null {
  if (!r) return null;
  const chat = r.chat && !r.chat.startsWith('temporary-') ? chats.find((c) => c.id === r.chat) : undefined;
  const workspace = r.workspace && projects.some((p) => p.id === r.workspace) ? r.workspace : null;
  const anchor = chat && r.anchor && chat.messages.some((m) => m.id === r.anchor!.id) ? r.anchor : null;
  const target: Resume = { v: 1, chat: chat?.id ?? null, workspace, place: r.place, anchor };
  return target.chat || target.workspace || target.place ? target : null;
}

// The screen history (Canvas) records the restored screen as the session's first, a root with no Back, instead of a
// step pushed over a new chat. Told once the store and the Routing Center both show it.
let resuming = false;
let resumed: (() => void) | null = null;
export const resumeInProgress = () => resuming;
export const onResumed = (fn: (() => void) | null) => { resumed = fn; };
export function applyingResume(run: () => void) {
  resuming = true;
  try { run(); } finally { resuming = false; }
  resumed?.();
}
