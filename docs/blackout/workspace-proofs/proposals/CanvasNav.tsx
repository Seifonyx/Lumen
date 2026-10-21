// Canvas navigation (opt-in preview only). One tree: projects are folders of conversations. Sidebar refinement:
// a calm header (mark, search, close/collapse), destination rows, collapsible Projects / folders / Conversations,
// per-chat actions reusing the production store actions, ContextMenu and long press, and an account footer.
import { lazy, Suspense, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Archive, ArchiveRestore, BookOpen, ChevronRight, Columns2, Download, FolderInput, LayoutGrid, ListTree, MoreHorizontal, PanelLeftClose, Pencil, Pin, PinOff, Plus, Search, Settings2, SlidersHorizontal, Sparkles, SquarePen, Trash2, X } from 'lucide-react';
import { useStore } from '../../../../src/store';
import type { Chat, Project } from '../../../../src/types';
import AllChats from '../../../../src/components/AllChats';
import ContextMenu, { type ContextItem } from '../../../../src/components/ContextMenu';
import Logo from '../../../../src/components/Logo';
import { useLongPress } from '../../../../src/lib/long-press';
import { modKey } from '../../../../src/lib/util';
const AskChats = lazy(() => import('../../../../src/components/AskChats'));

const NO_PROJECTS: Project[] = [];
const LIMIT = 5;
const DAY = 86400000;
const sorted = (list: Chat[]) => list.filter((c) => !c.archived && (c.messages.length || c.documents?.length)).toSorted((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt);
function groupOf(c: Chat) { if (c.pinned) return 'Pinned'; const d = (Date.now() - c.updatedAt) / DAY; return d < 1 ? 'Today' : d < 2 ? 'Yesterday' : d < 7 ? 'Previous 7 days' : d < 30 ? 'Previous 30 days' : 'Older'; }
const go = {
  chat: (id: string) => useStore.getState().selectChat(id),
  overview: (id: string) => useStore.getState().selectProject(id),
  newIn: (id: string | null) => { const s = useStore.getState(); s.selectProject(id); s.newChat(); },
  page: (page: 'collection' | 'tools' | 'projects') => useStore.getState().setUi({ page }),
  settings: (tab: string) => useStore.getState().setUi({ settingsOpen: true, settingsTab: tab }),
};

/** Which sections are open, remembered per signed-in account on this device only (never shared across accounts). */
type Prefs = { projects: boolean; conversations: boolean; folders: Record<string, boolean> };
const DEFAULTS: Prefs = { projects: true, conversations: true, folders: {} };
function usePrefs(uid: string | undefined) {
  const key = uid ? `lumen.blackout.canvasNav.${uid}` : '';
  const read = (): Prefs => { try { return { ...DEFAULTS, ...(key ? JSON.parse(localStorage.getItem(key) || '{}') : {}) }; } catch { return DEFAULTS; } };
  const [prefs, setPrefs] = useState<Prefs>(read);
  // A different account starts from its own state, not the previous one's.
  useEffect(() => { setPrefs(read()); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const update = (next: Prefs) => { setPrefs(next); try { if (key) localStorage.setItem(key, JSON.stringify(next)); } catch { /* private mode: this session only */ } };
  return [prefs, update] as const;
}

/** A disclosure region whose height eases open and shut; closed content is inert (no focus, hidden from AT). */
function Fold({ id, open, children }: { id: string; open: boolean; children: ReactNode }) {
  return <div id={id} className="pc-fold" data-open={open || undefined} inert={!open}><div className="pc-fold-inner">{children}</div></div>;
}

/** One conversation row: open it, or (contextually) rename, pin, move, archive, side by side, share/export, delete.
 *  Computers: a ⋯ button that appears on hover/focus/active, or right-click. Phones: press and hold. */
function Row({ chat, current, onPick }: { chat: Chat; current: boolean; onPick: (fn: () => void) => () => void }) {
  const projects = useStore((s) => s.settings.projects) || NO_PROJECTS;
  const streaming = useStore((s) => s.streamingChatId === chat.id);
  const { renameChat, togglePin, moveChatToProject, deleteChat } = useStore.getState();
  const rowRef = useRef<HTMLLIElement>(null), moreRef = useRef<HTMLButtonElement>(null), menuRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<null | { keyboard: boolean }>(null);
  const [moving, setMoving] = useState(false);
  const [held, setHeld] = useState<null | 'actions' | 'move'>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(chat.title);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const wide = typeof window !== 'undefined' && matchMedia('(min-width: 900px)').matches;
  useLongPress(rowRef, () => setHeld('actions'), { enabled: !editing, ignore: 'input, .pc-row-more' });
  const remove = () => { if (confirm(`Delete "${chat.title}"?`)) void deleteChat(chat.id); };
  const archive = () => { void useStore.getState().setArchived(chat.id, !chat.archived); useStore.getState().toast(chat.archived ? 'Moved back to your chats' : 'Archived · find it in All chats → Archived'); };
  const actions: (ContextItem & { id: string })[] = [
    { id: 'rename', label: 'Rename', icon: <Pencil size={16} />, onSelect: () => { setTitle(chat.title); setEditing(true); } },
    { id: 'pin', label: chat.pinned ? 'Unpin' : 'Pin', icon: chat.pinned ? <PinOff size={16} /> : <Pin size={16} />, onSelect: () => void togglePin(chat.id) },
    { id: 'move', label: 'Move to project', icon: <FolderInput size={16} />, onSelect: () => setHeld('move') },
    { id: 'archive', label: chat.archived ? 'Unarchive' : 'Archive', icon: chat.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />, onSelect: archive },
    ...(wide && !current ? [{ id: 'side', label: 'Open side by side', icon: <Columns2 size={16} />, onSelect: () => useStore.getState().setUi({ sideChatId: chat.id }) }] : []),
    { id: 'share', label: 'Share or export', icon: <Download size={16} />, onSelect: () => useStore.getState().setUi({ exportChatId: chat.id }) },
    { id: 'delete', label: 'Delete', icon: <Trash2 size={16} />, danger: true, onSelect: remove },
  ];
  const destinations: ContextItem[] = [
    { label: 'No project', icon: <ListTree size={16} />, onSelect: () => moveChatToProject(chat.id, null) },
    ...projects.filter((p) => p.id !== chat.projectId).map((p) => ({ label: p.name, icon: <span className="px-mono pc-menu-mono" aria-hidden="true">{p.name.slice(0, 1)}</span>, onSelect: () => moveChatToProject(chat.id, p.id) })),
  ];
  const openMenu = (keyboard: boolean, point?: { x: number; y: number }) => {
    const b = moreRef.current?.getBoundingClientRect();
    setAt(point ? { top: point.y, left: point.x } : b ? { top: b.bottom + 4, left: b.right } : null);
    setMoving(false); setMenu({ keyboard });
  };
  const closeMenu = (refocus = false) => { setMenu(null); setMoving(false); if (refocus) moreRef.current?.focus(); };
  // Keep the dropdown on screen (it lives in a portal, so the scrolling tree can't clip it).
  useLayoutEffect(() => {
    const el = menuRef.current; if (!menu || !el || !at) return;
    const r = el.getBoundingClientRect(), vh = innerHeight, vw = innerWidth;
    el.style.left = `${Math.max(8, Math.min(at.left - r.width, vw - r.width - 8))}px`;
    el.style.top = `${at.top + r.height > vh - 8 ? Math.max(8, at.top - r.height - 36) : at.top}px`;
    (menu.keyboard ? el.querySelector<HTMLElement>('[role="menuitem"]') : el)?.focus({ preventScroll: true });
  }, [menu, at, moving]);
  useEffect(() => {
    if (!menu) return;
    const away = (e: Event) => { const t = e.target as Node; if (!menuRef.current?.contains(t) && !moreRef.current?.contains(t)) closeMenu(); };
    const scroll = () => closeMenu();
    document.addEventListener('pointerdown', away, true);
    window.addEventListener('resize', scroll);
    return () => { document.removeEventListener('pointerdown', away, true); window.removeEventListener('resize', scroll); };
  }, [menu]); // eslint-disable-line react-hooks/exhaustive-deps

  if (editing) return <li className="pc-row editing"><input aria-label="Chat name" data-local-escape autoFocus dir="auto" value={title} onChange={(e) => setTitle(e.target.value)}
    onBlur={() => { if (title.trim() && title !== chat.title) void renameChat(chat.id, title.trim()); setEditing(false); }}
    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setTitle(chat.title); setEditing(false); } }} /></li>;

  return <li ref={rowRef} className={`pc-row${current ? ' current' : ''}${menu ? ' menu-open' : ''}`} onContextMenu={(e) => { if (matchMedia('(pointer: fine)').matches) { e.preventDefault(); openMenu(false, { x: e.clientX + 180, y: e.clientY }); } }}>
    <button type="button" className="pc-open" dir="auto" title={chat.title} aria-current={current ? 'page' : undefined} onClick={onPick(() => go.chat(chat.id))}>
      {chat.pinned && <Pin size={12} className="pc-pin" aria-hidden="true" />}<span className="pc-row-title">{chat.title}</span>{streaming && <span className="dot-pulse" aria-label="Replying" />}
    </button>
    <button ref={moreRef} type="button" className="pc-row-more" aria-label={`Options for ${chat.title}`} aria-haspopup="menu" aria-expanded={Boolean(menu)}
      onClick={(e) => (menu ? closeMenu() : openMenu(e.detail === 0))} onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); openMenu(true); } }}><MoreHorizontal size={16} /></button>
    {menu && at && createPortal(<div ref={menuRef} className="menu pc-menu" role="menu" aria-label={`Options for ${chat.title}`} tabIndex={-1} style={{ position: 'fixed', top: at.top, left: at.left }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); closeMenu(true); return; }
        if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault(); const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]; const i = items.indexOf(document.activeElement as HTMLButtonElement);
        items[e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : i < 0 ? (e.key === 'ArrowUp' ? items.length - 1 : 0) : (i + (e.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length]?.focus();
      }}>
      {actions.map((a) => a.id === 'move'
        ? <div key={a.id} className="pc-menu-group"><button type="button" role="menuitem" aria-expanded={moving} onClick={() => setMoving(!moving)}>{a.icon}{a.label}<ChevronRight size={14} className="pc-menu-chev" aria-hidden="true" /></button>
          {moving && <div className="chat-move-list" role="group" aria-label="Move to">{destinations.map((d) => <button key={d.label} type="button" role="menuitem" onClick={() => { closeMenu(true); d.onSelect(); }}>{d.icon}{d.label}</button>)}</div>}</div>
        : <button key={a.id} type="button" role="menuitem" className={a.danger ? 'danger' : undefined} onClick={() => { closeMenu(a.id !== 'rename'); a.onSelect(); }}>{a.icon}{a.label}</button>)}
    </div>, document.body)}
    {held && rowRef.current && <ContextMenu anchor={rowRef.current} label={held === 'move' ? 'Move to project' : 'Chat options'} wrap="pc-ctx" onClose={() => setHeld(null)}
      items={held === 'move' ? destinations : actions.map(({ id: _id, ...a }) => a)} />}
  </li>;
}

export default function CanvasNav({ chat, phone, onClose, onCollapse }: { chat?: Chat | null; phone: boolean; onClose: () => void; onCollapse: () => void }) {
  const chats = useStore((s) => s.chats), projects = useStore((s) => s.settings.projects) || NO_PROJECTS;
  const user = useStore((s) => s.user), page = useStore((s) => s.page);
  const [prefs, setPrefs] = usePrefs(user?.uid);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(!phone);
  const [more, setMore] = useState<Record<string, boolean>>({});
  const [allChats, setAllChats] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const ids = useId();
  const q = query.trim().toLowerCase(), match = (c: Chat) => !q || c.title.toLowerCase().includes(q);
  // Searching shows every match, whatever is folded; folders otherwise follow your choice, else open the one you're in.
  const folderOpen = (p: Project) => Boolean(q) || (prefs.folders[p.id] ?? p.id === chat?.projectId);
  const sectionOpen = (s: 'projects' | 'conversations') => Boolean(q) || prefs[s];
  const pick = (fn: () => void) => () => { fn(); if (phone) onClose(); };
  const unfiled = sorted(chats.filter((c) => !c.projectId)).filter(match);
  const groups = unfiled.reduce<[string, Chat[]][]>((acc, c) => { const g = groupOf(c); const last = acc.at(-1); if (last && last[0] === g) last[1].push(c); else acc.push([g, [c]]); return acc; }, []);
  const inProjects = Boolean(chat?.projectId && projects.some((p) => p.id === chat.projectId));
  const inConversations = Boolean(chat && !chat.projectId && unfiled.some((c) => c.id === chat.id));
  useEffect(() => { if (searching && phone) searchRef.current?.focus({ preventScroll: true }); }, [searching, phone]);
  const here = <span className="pc-here" title="Contains the open chat"><span className="sr-only">, contains the open chat</span></span>;
  const section = (s: 'projects' | 'conversations', label: string, contains: boolean, extra?: ReactNode) => <div className="pc-section">
    <h2 className="pc-section-h"><button type="button" className="pc-section-toggle" data-pc-section={s} aria-expanded={sectionOpen(s)} aria-controls={`${ids}-${s}`} disabled={Boolean(q)}
      onClick={() => setPrefs({ ...prefs, [s]: !prefs[s] })}><span className="px-label">{label}</span><ChevronRight size={13} className="pc-chev" aria-hidden="true" />{!sectionOpen(s) && contains && here}</button></h2>{extra}</div>;

  return <nav className="pc-nav" aria-label="Conversations and projects">
    <div className="pc-nav-head">
      <span className="pc-brand"><Logo size={phone ? 26 : 22} /><span className="px-wordmark">Lumen</span></span>
      {phone && <button type="button" className="pc-head-btn" aria-label="Search conversations" aria-expanded={searching} onClick={() => { setSearching(!searching); if (searching) setQuery(''); }}><Search size={18} /></button>}
      {phone ? <button type="button" className="pc-head-btn pc-nav-close" data-proposal-nav-close aria-label="Close navigation" onClick={onClose}><X size={18} /></button>
        : <button type="button" className="pc-head-btn" data-pc-collapse aria-label="Collapse sidebar" title={`Collapse sidebar (${modKey}⇧S)`} onClick={onCollapse}><PanelLeftClose size={17} /></button>}
    </div>
    {searching && <label className="px-search pc-search"><Search size={16} /><input ref={searchRef} type="search" aria-label="Search conversations" placeholder="Search" value={query} data-local-escape
      onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape' && (query || phone)) { e.stopPropagation(); setQuery(''); if (phone) setSearching(false); } }} /></label>}
    {q && <button type="button" className="pc-ask" onClick={() => setAsking(query)} title="Find what you talked about, even with different words"><Sparkles size={15} /><span>Ask your chats: “{query.trim().slice(0, 32)}”</span></button>}
    <div className="pc-tree">
      {!q && <ul className="pc-dest" aria-label="Places">
        {!phone && <li><button type="button" onClick={() => go.newIn(null)}><SquarePen size={18} /><span>New chat</span><kbd>{modKey}⇧O</kbd></button></li>}
        <li><button type="button" aria-current={page === 'collection' ? 'page' : undefined} onClick={pick(() => go.page('collection'))}><BookOpen size={18} /><span>Library</span></button></li>
        <li><button type="button" aria-current={page === 'tools' ? 'page' : undefined} onClick={pick(() => go.page('tools'))}><LayoutGrid size={18} /><span>Tools</span></button></li>
        <li><button type="button" onClick={pick(() => go.settings('models'))}><SlidersHorizontal size={18} /><span>Models &amp; routing</span></button></li>
      </ul>}
      {section('projects', 'Projects', inProjects, <button type="button" className="pc-section-add" aria-label="New project" title="New project" onClick={pick(() => go.page('projects'))}><Plus size={15} /></button>)}
      <Fold id={`${ids}-projects`} open={sectionOpen('projects')}>
        {projects.map((p) => { const list = sorted(chats.filter((c) => c.projectId === p.id)).filter(match); if (q && !list.length) return null; const open = folderOpen(p); const shown = more[p.id] || q ? list : list.slice(0, LIMIT); const contains = chat?.projectId === p.id; return <div key={p.id} className="pc-project">
          <button type="button" className={`pc-project-row${contains ? ' has-current' : ''}`} data-proposal-space={p.id} aria-expanded={open} aria-controls={`${ids}-p-${p.id}`} onClick={() => setPrefs({ ...prefs, folders: { ...prefs.folders, [p.id]: !open } })}>
            <ChevronRight size={14} className="pc-chev" aria-hidden="true" /><span className="px-mono" aria-hidden="true">{p.name.slice(0, 1)}</span><span className="pc-name">{p.name}</span>{!open && contains ? here : <span className="pc-count" aria-label={`${list.length} chats`}>{list.length}</span>}</button>
          <Fold id={`${ids}-p-${p.id}`} open={open}><ul>
            <li><button type="button" className="pc-brief" onClick={pick(() => go.overview(p.id))}><span className="pc-brief-text">{p.description || 'Project overview'}</span><span className="pc-brief-meta">{p.instructions?.trim() ? 'Instructions' : 'No instructions'} · {p.files?.length || 0} files<ChevronRight size={12} aria-hidden="true" /></span></button></li>
            {shown.map((c) => <Row key={c.id} chat={c} current={c.id === chat?.id} onPick={pick} />)}
            {list.length > shown.length && <li><button type="button" className="pc-more" onClick={() => setMore({ ...more, [p.id]: true })}>Show {list.length - shown.length} more</button></li>}
            <li><button type="button" className="pc-new-here" onClick={pick(() => go.newIn(p.id))}><Plus size={14} />New chat in {p.name}</button></li>
          </ul></Fold>
        </div>; })}
        {!projects.length && !q && <button type="button" className="pc-empty" onClick={pick(() => go.page('projects'))}>Group related chats, files and instructions in a project</button>}
      </Fold>
      {section('conversations', 'Conversations', inConversations)}
      <Fold id={`${ids}-conversations`} open={sectionOpen('conversations')}>
        {groups.map(([g, list]) => <div key={g} className="pc-group"><h3>{g}</h3><ul className="pc-chats">{list.map((c) => <Row key={c.id} chat={c} current={c.id === chat?.id} onPick={pick} />)}</ul></div>)}
        {q && !groups.length && <p className="pc-none">No loose conversations match.</p>}
        {!q && <button type="button" className="pc-all" onClick={() => setAllChats(true)}><ListTree size={15} />All chats<ChevronRight size={13} aria-hidden="true" /></button>}
      </Fold>
    </div>
    <div className="pc-foot">
      {phone && <button type="button" className="pc-new-pill" onClick={pick(() => go.newIn(null))}><SquarePen size={18} />New chat</button>}
      <button type="button" className="pc-account" aria-label="Account and settings" title={`Settings (${modKey},)`} onClick={pick(() => go.settings(''))}>
        {user?.photo ? <img className="pc-avatar" src={user.photo} alt="" referrerPolicy="no-referrer" /> : <span className="pc-avatar" aria-hidden="true">{(user?.name || user?.email || '?').slice(0, 1).toUpperCase()}</span>}
        {!phone && <span className="pc-account-text"><span className="pc-account-name">{user?.name || user?.email?.split('@')[0] || 'Account'}</span><span className="pc-account-sub">Settings &amp; keys</span></span>}
        {!phone && <Settings2 size={16} className="pc-account-gear" aria-hidden="true" />}
      </button>
    </div>
    {allChats && <AllChats onClose={() => setAllChats(false)} />}
    {asking !== null && <Suspense fallback={null}><AskChats initial={asking} onClose={() => setAsking(null)} /></Suspense>}
  </nav>;
}
