// CP03 Canvas navigation (approved Canvas design, Gate 1). Reached only when CANVAS_SHELL is on
// (src/lib/canvas-presentation.ts); the ordinary build folds it away.
// One tree: projects are folders of their conversations; loose conversations are grouped by day. It is the same
// sidebar element as Sidebar (one `sidebarOpen`, one collapse state, the same focus scope and drawer gesture
// owner) and reuses its ChatRow (rename, pin, move, archive, side by side, share/export, delete, long press),
// search semantics, AllChats, AskChats and ProjectManager. Folder disclosure is presentation only.
import { BookOpen, ChevronRight, LayoutGrid, MessageSquarePlus, MessageSquareText, PanelLeftClose, Plus, Search, Settings2, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { Suspense, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isTemporaryChat } from '../lib/temporary-chat';
import { isMac, modKey } from '../lib/util';
import { useFocusScope } from '../lib/focus-scope';
import { closeRoutingCenter, openRoutingCenter, routingCenterOpen, useRoutingCenter } from '../lib/routing-center';
import { useStore } from '../store';
import type { Chat, Project } from '../types';
import AllChats from './AllChats';
import ProjectManager from './ProjectManager';
import { AskChats, ChatRow, type SidebarProps } from './Sidebar';
import { BrandWordmark, loadTreeKeys as loadKeys } from '../lib/canvas-presentation';

const EMPTY_PROJECTS: Project[] = [];
const LIMIT = 5;
const PHONE = '(max-width: 899px)';
// Phase 2 slice 2: the tree's keyboard. Every row's main control is one stop for the arrow keys (row menus, the
// section "+" and the ⌘K hint stay on Tab). Rows inside a closed folder are inert, so they are never reached.
const ROW = '.cv-dest button, .cv-section-toggle:not(:disabled), .cv-project-row, .cv-brief, .chat-open, .cv-more, .cv-new-here, .cv-all, .cv-empty, .cv-ask';
const shown = (el: Element | null | undefined): el is HTMLElement => el instanceof HTMLElement && el.isConnected && el.getClientRects().length > 0 && !el.closest('[inert], [hidden]');
/** The buttons that open the drawer on phones, by the bar that is showing (chat, a hub page, the Routing Center). */
const DRAWER_OPENERS = '.menu-btn, .hub-nav[aria-label="Open sidebar"], .rc-menu';
/** Scrolls only the tree (never the page) so `row` is in view. */
function reveal(row: Element | null | undefined) {
  const tree = row?.closest<HTMLElement>('.cv-tree');
  if (!row || !tree) return;
  const r = row.getBoundingClientRect(), t = tree.getBoundingClientRect();
  if (r.top < t.top) tree.scrollTop -= t.top - r.top + 8;
  else if (r.bottom > t.bottom) tree.scrollTop += r.bottom - t.bottom + 8;
}
// The arrow keys load with the tree's first focus (Tab, a click or a tap into it), before any key can reach them.
// (The loader comes through the Canvas switch, so the ordinary build has no chunk for it.)
let treeKeys: typeof import('../lib/tree-keys').treeKeys | null = null;
const loadTreeKeys = () => { if (!treeKeys) void loadKeys?.().then((m) => { treeKeys = m.treeKeys; }); };

type Open = { projects: boolean; conversations: boolean; folders: Record<string, boolean> };
const OPEN: Open = { projects: true, conversations: true, folders: {} };

/** One clean list, no headings: pinned first (marked by their pin), then newest first; archived chats (shown only
 *  while searching, as in Sidebar) last. */
const newestFirst = (list: Chat[]) => [...list].sort((a, b) => Number(Boolean(a.archived)) - Number(Boolean(b.archived))
  || Number(Boolean(b.pinned && !b.archived)) - Number(Boolean(a.pinned && !a.archived)) || b.updatedAt - a.updatedAt);

/** A disclosure region whose height eases open and shut; closed content is inert (no focus, hidden from AT). */
function Fold({ id, open, children }: { id: string; open: boolean; children: ReactNode }) {
  return <div id={id} className="cv-fold" data-open={open || undefined} inert={!open}><div className="cv-fold-inner">{children}</div></div>;
}

export default function SidebarCanvas({ onCollapse }: SidebarProps) {
  const user = useStore((s) => s.user);
  const chats = useStore((s) => s.chats);
  const currentId = useStore((s) => s.currentId);
  const projects = useStore((s) => s.settings.projects) || EMPTY_PROJECTS;
  const activeProjectId = useStore((s) => s.activeProjectId);
  const workspaceOpen = useStore((s) => s.projectWorkspaceOpen);
  const open = useStore((s) => s.sidebarOpen);
  const page = useStore((s) => s.page);
  const routing = useRoutingCenter().open;
  const { newChat, setUi, selectProject } = useStore.getState();
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches);
  const [query, setQuery] = useState('');
  const [disclosure, setDisclosure] = useState<Open>(OPEN);
  const [more, setMore] = useState<Record<string, boolean>>({});
  const [allChats, setAllChats] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const [manager, setManager] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);
  const opener = useRef<{ el: HTMLElement | null; page: unknown; routing: boolean }>({ el: null, page: null, routing: false });
  const ids = useId();

  // Same drawer ownership as Sidebar: a modal dialog on phones, part of the page on computers.
  useFocusScope(sidebarRef, phone && open, () => setUi({ sidebarOpen: false }));
  useEffect(() => {
    const media = window.matchMedia(PHONE);
    const change = () => setPhone(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (phone) {
      if (open) {
        // Remember what opened the drawer, and where we were, so closing can hand focus back to it.
        const active = document.activeElement;
        opener.current = { el: active instanceof HTMLElement && !sidebarRef.current?.contains(active) ? active : null, page: useStore.getState().page, routing: routingCenterOpen() };
        sidebarRef.current?.focus({ preventScroll: true });
        reveal(sidebarRef.current?.querySelector('.chat-row.active'));
      } else if (wasOpen.current && !useStore.getState().settingsOpen) {
        // Closing to go somewhere else (a page, the Routing Center) leaves focus to that destination.
        const was = opener.current, s = useStore.getState();
        if (s.page === was.page && routingCenterOpen() === was.routing) {
          const target = shown(was.el) && s.page === was.page ? was.el : [...document.querySelectorAll<HTMLElement>(DRAWER_OPENERS)].find(shown);
          target?.focus({ preventScroll: true });
        }
      }
    }
    wasOpen.current = open;
  }, [open, phone]);
  // Computers: the open chat stays in view in the tree when it changes from elsewhere (palette, a page, a new chat).
  useEffect(() => { if (!phone) requestAnimationFrame(() => reveal(sidebarRef.current?.querySelector('.chat-row.active'))); }, [currentId, phone]);
  // ChatRow is shared with the ordinary sidebar (one seam there), so the tree adds its state as attributes: the open
  // chat is the current page, and a pinned chat is described as pinned (its pin icon is decorative).
  useLayoutEffect(() => {
    sidebarRef.current?.querySelectorAll('.chat-row').forEach((row) => {
      const button = row.querySelector('.chat-open');
      if (!button) return;
      button.toggleAttribute('aria-current', false);
      if (row.classList.contains('active')) button.setAttribute('aria-current', 'page');
      if (row.querySelector('.pin-mark')) button.setAttribute('aria-describedby', `${ids}-pinned`); else button.removeAttribute('aria-describedby');
    });
  });
  // Another account starts from its own (default) disclosure, never the previous one's.
  useEffect(() => { setDisclosure(OPEN); setMore({}); setQuery(''); }, [user?.uid]);

  const q = query.trim().toLowerCase();
  // Sidebar's semantics: saved chats with content (or the open one); searching matches titles and messages and
  // also finds archived chats.
  const matches = useMemo(() => {
    const visible = chats.filter((c) => !isTemporaryChat(c) && (c.messages.length > 0 || Boolean(c.documents?.length) || c.id === currentId));
    const listed = q ? visible : visible.filter((c) => !c.archived || c.id === currentId);
    return q ? listed.filter((c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.text.toLowerCase().includes(q))) : listed;
  }, [chats, q, currentId]);
  const recency = (p: Project) => Math.max(p.updatedAt, ...chats.filter((c) => c.projectId === p.id).map((c) => c.updatedAt));
  const ordered = useMemo(() => [...projects].sort((a, b) => recency(b) - recency(a)), [projects, chats]); // eslint-disable-line react-hooks/exhaustive-deps
  const known = new Set(projects.map((p) => p.id));
  const loose = newestFirst(matches.filter((c) => !c.projectId || !known.has(c.projectId)));
  const current = chats.find((c) => c.id === currentId);
  const hereProject = current?.projectId && known.has(current.projectId) ? current.projectId : activeProjectId;
  const scope = projects.find((p) => p.id === activeProjectId);

  const sectionOpen = (s: 'projects' | 'conversations') => Boolean(q) || disclosure[s];
  const folderOpen = (p: Project) => Boolean(q) || (disclosure.folders[p.id] ?? p.id === hereProject);
  const toPage = (next: 'collection' | 'tools' | 'projects', pageArg?: string) => setUi({ page: next, ...(pageArg ? { pageArg } : {}), sidebarOpen: false });
  const here = <span className="cv-here" title="Contains the open chat"><span className="sr-only">, contains the open chat</span></span>;
  const section = (s: 'projects' | 'conversations', label: string, contains: boolean, extra?: ReactNode) => (
    <div className="cv-section">
      <h2 className="cv-section-h">
        <button type="button" className="cv-section-toggle" aria-expanded={sectionOpen(s)} aria-controls={`${ids}-${s}`} disabled={Boolean(q)} onClick={() => setDisclosure({ ...disclosure, [s]: !disclosure[s] })}>
          <span className="cv-label">{label}</span><ChevronRight size={13} className="cv-chev" aria-hidden="true" />{!sectionOpen(s) && contains && here}
        </button>
      </h2>
      {extra}
    </div>
  );

  return (
    <>
      <aside
        ref={sidebarRef}
        className={`sidebar cv-nav${open ? ' open' : ''}`}
        aria-label="Chats"
        role={phone ? 'dialog' : undefined}
        tabIndex={-1}
        aria-modal={(phone && open) || undefined}
        aria-hidden={(phone && !open) || undefined}
        inert={phone && !open}
        onClickCapture={(e) => {
          // As in Sidebar: using the sidebar while Settings is open (computers) leaves Settings.
          const target = (e.target as HTMLElement).closest('button, a, [role="button"]');
          if (target && !target.closest('.cv-account, .row-menu, [role="menu"]') && useStore.getState().settingsOpen) setUi({ settingsOpen: false });
          // Going anywhere else from the tree leaves the Routing Center (the head's own buttons and row menus excepted).
          if (target && !target.closest('[data-routing-center], .cv-head, .cv-section-h, .cv-project-row, .row-menu, [role="menu"]')) closeRoutingCenter();
        }}
      >
        <div className="cv-head">
          <span className="cv-brand">{BrandWordmark ? <BrandWordmark height={phone ? 24 : 20} /> : <span className="cv-wordmark">Lumen</span>}</span>
          {phone
            ? <button type="button" className="cv-head-btn" aria-label="Close menu" onClick={() => setUi({ sidebarOpen: false })}><X size={18} /></button>
            : <button type="button" className="cv-head-btn collapse-sidebar" aria-label="Collapse sidebar" title={`Collapse sidebar (${modKey}⇧S)`} onClick={onCollapse}><PanelLeftClose size={17} /></button>}
        </div>
        {/* Always in the drawer too: one tap to search, no extra step (phones don't focus it, so no keyboard). */}
        <label className="search cv-search">
          <Search size={16} />
          <input ref={searchInput} id="chat-search" data-local-escape type="search" aria-label="Search chats" placeholder="Search chats" value={query} dir="auto"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && query) { e.stopPropagation(); setQuery(''); }
              // Down moves into the tree (the first result while searching); Return opens the first result.
              else if (e.key === 'ArrowDown') { const first = [...(sidebarRef.current?.querySelectorAll<HTMLElement>(`.cv-tree :is(${ROW})`) || [])].find(shown); if (first) { e.preventDefault(); first.focus(); reveal(first); } }
              else if (e.key === 'Enter' && q && !e.nativeEvent.isComposing) { const first = sidebarRef.current?.querySelector<HTMLElement>('.cv-tree .chat-open'); if (first) { e.preventDefault(); first.click(); } }
            }} />
          {/* iPhone has no built-in clear control in search fields: one tap empties it and keeps the field. */}
          {query && <button type="button" className="cv-search-clear" aria-label="Clear search" onClick={() => { setQuery(''); searchInput.current?.focus({ preventScroll: true }); }}><X size={15} /></button>}
          {/* Desktop: the command palette, one shortcut away (the same key press the app already listens for). */}
          {!phone && !query && <button type="button" className="cv-kbd" title="Search and jump to anything" aria-label={`Search and jump to anything (${modKey}K)`}
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: isMac, ctrlKey: !isMac, bubbles: true }))}><kbd>{modKey}K</kbd></button>}
        </label>
        <span id={`${ids}-pinned`} hidden>Pinned</span>
        {/* Screen readers hear how many conversations a search finds as it narrows. */}
        <p className="sr-only" role="status">{q ? (matches.length ? `${matches.length} ${matches.length === 1 ? 'conversation' : 'conversations'} found` : 'No conversations match') : ''}</p>
        {q.length > 1 && (
          <button type="button" className="cv-ask" onClick={() => setAsking(query)} title="Find what you talked about, even with different words, and get an answer from it">
            <Sparkles size={15} /><span>Ask your chats: “<span dir="auto">{query.trim().slice(0, 40)}</span>”</span>
          </button>
        )}

        <div className="cv-tree" onFocus={loadTreeKeys} onKeyDown={(e) => treeKeys?.(e.nativeEvent, e.currentTarget, ROW, searchInput.current, reveal)}>
          {!q && (
            <ul className="cv-dest" aria-label="Places">
              {!phone && <li><button type="button" className="cv-dest-new" aria-label="New chat" onClick={newChat} title={`New chat (${modKey}⇧O)`}><MessageSquarePlus size={18} /><span>New chat</span><kbd>{modKey}⇧O</kbd></button></li>}
              <li><button type="button" aria-current={page === 'collection' ? 'page' : undefined} onClick={() => toPage('collection', 'all')} title="Photos, files and documents from all your chats"><BookOpen size={18} /><span>Library</span></button></li>
              <li><button type="button" aria-current={page === 'tools' || page === 'assistants' || page === 'study' ? 'page' : undefined} onClick={() => toPage('tools')} title={`Research, create, analyze, study, assistants and connected apps (${modKey}⇧L)`}><LayoutGrid size={18} /><span>Tools</span></button></li>
              <li><button type="button" data-routing-center aria-current={routing && !page ? 'page' : undefined} onClick={() => { setUi({ page: null, settingsOpen: false, sidebarOpen: false }); openRoutingCenter(); }}><SlidersHorizontal size={18} /><span>Models &amp; routing</span></button></li>
            </ul>
          )}

          {section('projects', 'Projects', Boolean(hereProject), <button type="button" className="cv-section-add" aria-label="New project" title="New project" onClick={() => setManager(true)}><Plus size={15} /></button>)}
          <Fold id={`${ids}-projects`} open={sectionOpen('projects')}>
            {ordered.map((p) => {
              const list = matches.filter((c) => c.projectId === p.id).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt);
              if (q && !list.length) return null;
              const isOpen = folderOpen(p), contains = hereProject === p.id;
              const shown = more[p.id] || q ? list : list.slice(0, LIMIT);
              return (
                <div key={p.id} className="cv-project">
                  <button type="button" className={`cv-project-row${contains ? ' has-current' : ''}`} aria-expanded={isOpen} aria-controls={`${ids}-p-${p.id}`}
                    onClick={() => setDisclosure({ ...disclosure, folders: { ...disclosure.folders, [p.id]: !isOpen } })}>
                    <ChevronRight size={14} className="cv-chev" aria-hidden="true" />
                    <span className="cv-mono" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
                    <span className="cv-name">{p.name}</span>
                    {!isOpen && contains ? here : <span className="cv-count" aria-label={`${list.length} chats`}>{list.length}</span>}
                  </button>
                  <Fold id={`${ids}-p-${p.id}`} open={isOpen}>
                    <ul className="cv-chats" aria-label={p.name}>
                      <li><button type="button" className={`cv-brief${activeProjectId === p.id ? ' active' : ''}${activeProjectId === p.id && workspaceOpen ? ' open' : ''}`} aria-current={activeProjectId === p.id && workspaceOpen ? 'page' : undefined} onClick={() => { setUi({ page: null, settingsOpen: false }); selectProject(p.id); }}>
                        <span className="cv-brief-text">{p.description || 'Project overview'}</span>
                        <span className="cv-brief-meta">{p.instructions?.trim() ? 'Instructions' : 'No instructions'} · {p.files?.length || 0} {p.files?.length === 1 ? 'file' : 'files'}<ChevronRight size={12} aria-hidden="true" /></span>
                      </button></li>
                      {/* Inside the folder, so it reads as part of this project; the label names it too. */}
                      {!q && <li><button type="button" className="cv-new-here" onClick={() => { selectProject(p.id); newChat(); }}><span className="cv-new-here-icon" aria-hidden="true"><Plus size={13} /></span><span className="cv-new-here-label">New chat in {p.name}</span></button></li>}
                      {shown.map((c) => <ChatRow key={c.id} chat={c} active={c.id === currentId} />)}
                      {list.length > shown.length && <li><button type="button" className="cv-more" onClick={() => setMore({ ...more, [p.id]: true })}>Show {list.length - shown.length} more</button></li>}
                    </ul>
                  </Fold>
                </div>
              );
            })}
            {!projects.length && !q && <button type="button" className="cv-empty" onClick={() => setManager(true)}>Group related chats, files and instructions in a project</button>}
            {projects.length > 0 && !q && <button type="button" className="cv-more" onClick={() => toPage('projects')}>All projects<ChevronRight size={12} aria-hidden="true" /></button>}
          </Fold>

          {section('conversations', q ? 'Search results' : 'Conversations', Boolean(current && !hereProject && !isTemporaryChat(current)))}
          <Fold id={`${ids}-conversations`} open={sectionOpen('conversations')}>
            {loose.some((c) => !c.archived) && <ul className="cv-chats cv-loose" aria-label={q ? 'Search results' : 'Conversations'}>{loose.filter((c) => !c.archived).map((c) => <ChatRow key={c.id} chat={c} active={c.id === currentId} />)}</ul>}
            {/* Search also finds archived chats; they are marked as such, after the rest. */}
            {loose.some((c) => c.archived) && <>
              <p className="cv-archived-label" id={`${ids}-archived`}>Archived</p>
              <ul className="cv-chats cv-loose cv-archived" aria-labelledby={`${ids}-archived`}>{loose.filter((c) => c.archived).map((c) => <ChatRow key={c.id} chat={c} active={c.id === currentId} />)}</ul>
            </>}
            {!loose.length && <p className="cv-none">{q ? 'No loose conversations match.' : 'Your chats will appear here.'}</p>}
            {!q && <button type="button" className="cv-all" onClick={() => setAllChats(true)}><MessageSquareText size={15} />All chats<ChevronRight size={13} aria-hidden="true" /></button>}
          </Fold>
        </div>

        <div className="cv-foot">
          {/* New chat starts in the active project when there is one (the store's rule, unchanged): the pill says so. */}
          {phone && <button type="button" className="cv-new-pill" onClick={newChat} aria-label={scope ? `New chat in ${scope.name}` : 'New chat'}>
            <MessageSquarePlus size={18} aria-hidden="true" />
            <span className="cv-new-text"><span>New chat</span>{scope && <span className="cv-new-scope">in {scope.name}</span>}</span>
          </button>}
          <button type="button" className="cv-account" aria-label="Settings" title={`Settings (${modKey},)`} onClick={() => setUi({ settingsOpen: true, settingsTab: '', sidebarOpen: false })}>
            {user?.photo ? <img className="cv-avatar" src={user.photo} alt="" referrerPolicy="no-referrer" /> : <span className="cv-avatar" aria-hidden="true">{(user?.name || user?.email || '?').slice(0, 1).toUpperCase()}</span>}
            {!phone && <span className="cv-account-text"><span className="cv-account-name">{user?.name || user?.email?.split('@')[0] || 'Account'}</span><span className="cv-account-sub">Settings &amp; keys</span></span>}
            {!phone && <Settings2 size={16} className="cv-account-gear" aria-hidden="true" />}
          </button>
        </div>
      </aside>
      {asking !== null && <Suspense fallback={null}><AskChats initial={asking} onClose={() => setAsking(null)} /></Suspense>}
      {allChats && <AllChats onClose={() => setAllChats(false)} />}
      {manager && <ProjectManager createNewImmediately onClose={() => setManager(false)} />}
    </>
  );
}
