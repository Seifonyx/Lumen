// CP03 Canvas navigation (approved Canvas design, Gate 1). Reached only when CANVAS_SHELL is on
// (src/lib/canvas-presentation.ts); the ordinary build folds it away.
// One tree: projects are folders of their conversations; loose conversations are grouped by day. It is the same
// sidebar element as Sidebar (one `sidebarOpen`, one collapse state, the same focus scope and drawer gesture
// owner) and reuses its ChatRow (rename, pin, move, archive, side by side, share/export, delete, long press),
// search semantics, AllChats, AskChats and ProjectManager. Folder disclosure is presentation only.
import { BookOpen, ChevronRight, LayoutGrid, MessageSquarePlus, MessageSquareText, PanelLeftClose, Plus, Search, Settings2, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { Suspense, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { isTemporaryChat } from '../lib/temporary-chat';
import { modKey } from '../lib/util';
import { useFocusScope } from '../lib/focus-scope';
import { closeRoutingCenter, openRoutingCenter, useRoutingCenter } from '../lib/routing-center';
import { useStore } from '../store';
import type { Chat, Project } from '../types';
import AllChats from './AllChats';
import Logo from './Logo';
import ProjectManager from './ProjectManager';
import { AskChats, ChatRow, type SidebarProps } from './Sidebar';

const EMPTY_PROJECTS: Project[] = [];
const LIMIT = 5;
const PHONE = '(max-width: 899px)';
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
  const open = useStore((s) => s.sidebarOpen);
  const page = useStore((s) => s.page);
  const routing = useRoutingCenter().open;
  const { newChat, setUi, selectProject } = useStore.getState();
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [disclosure, setDisclosure] = useState<Open>(OPEN);
  const [more, setMore] = useState<Record<string, boolean>>({});
  const [allChats, setAllChats] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const [manager, setManager] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);
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
      if (open) sidebarRef.current?.focus({ preventScroll: true });
      else if (wasOpen.current && !useStore.getState().settingsOpen) document.querySelector<HTMLButtonElement>('.menu-btn')?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open, phone]);
  // Another account starts from its own (default) disclosure, never the previous one's.
  useEffect(() => { setDisclosure(OPEN); setMore({}); setQuery(''); }, [user?.uid]);
  useEffect(() => { if (searching && phone) searchInput.current?.focus({ preventScroll: true }); }, [searching, phone]);

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
          <span className="cv-brand"><Logo size={phone ? 26 : 22} /><span className="cv-wordmark">Lumen</span></span>
          {phone && <button type="button" className="cv-head-btn" aria-label="Search chats" aria-expanded={searching} onClick={() => { if (searching) setQuery(''); setSearching(!searching); }}><Search size={18} /></button>}
          {phone
            ? <button type="button" className="cv-head-btn" aria-label="Close menu" onClick={() => setUi({ sidebarOpen: false })}><X size={18} /></button>
            : <button type="button" className="cv-head-btn collapse-sidebar" aria-label="Collapse sidebar" title={`Collapse sidebar (${modKey}⇧S)`} onClick={onCollapse}><PanelLeftClose size={17} /></button>}
        </div>
        {(searching || !phone) && (
          <label className="search cv-search">
            <Search size={16} />
            <input ref={searchInput} id="chat-search" data-local-escape type="search" aria-label="Search chats" placeholder="Search chats" value={query} dir="auto"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape' && (query || phone)) { e.stopPropagation(); setQuery(''); if (phone) setSearching(false); } }} />
          </label>
        )}
        {q.length > 1 && (
          <button type="button" className="cv-ask" onClick={() => setAsking(query)} title="Find what you talked about, even with different words, and get an answer from it">
            <Sparkles size={15} /><span>Ask your chats: “<span dir="auto">{query.trim().slice(0, 40)}</span>”</span>
          </button>
        )}

        <div className="cv-tree">
          {!q && (
            <ul className="cv-dest" aria-label="Places">
              {!phone && <li><button type="button" onClick={newChat} title={`New chat (${modKey}⇧O)`}><MessageSquarePlus size={18} /><span>New chat</span><kbd>{modKey}⇧O</kbd></button></li>}
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
                    <ul className="cv-chats">
                      <li><button type="button" className={`cv-brief${activeProjectId === p.id ? ' active' : ''}`} onClick={() => { setUi({ page: null, settingsOpen: false }); selectProject(p.id); }}>
                        <span className="cv-brief-text">{p.description || 'Project overview'}</span>
                        <span className="cv-brief-meta">{p.instructions?.trim() ? 'Instructions' : 'No instructions'} · {p.files?.length || 0} {p.files?.length === 1 ? 'file' : 'files'}<ChevronRight size={12} aria-hidden="true" /></span>
                      </button></li>
                      {shown.map((c) => <ChatRow key={c.id} chat={c} active={c.id === currentId} />)}
                      {list.length > shown.length && <li><button type="button" className="cv-more" onClick={() => setMore({ ...more, [p.id]: true })}>Show {list.length - shown.length} more</button></li>}
                      {!q && <li><button type="button" className="cv-new-here" onClick={() => { selectProject(p.id); newChat(); }}><Plus size={14} />New chat in {p.name}</button></li>}
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
            {loose.some((c) => !c.archived) && <ul className="cv-chats cv-loose">{loose.filter((c) => !c.archived).map((c) => <ChatRow key={c.id} chat={c} active={c.id === currentId} />)}</ul>}
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
          {phone && <button type="button" className="cv-new-pill" onClick={newChat}><MessageSquarePlus size={18} />New chat</button>}
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
