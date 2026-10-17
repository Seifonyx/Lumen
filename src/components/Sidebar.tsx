import { isTemporaryChat } from '../lib/temporary-chat';
import { Archive, ArchiveRestore, ChevronRight, LayoutGrid, Shapes, Sparkles, Columns2, Download, FolderKanban, MoreHorizontal, PanelLeftClose, Pencil, Pin, PinOff, Plus, Search, Settings2, Trash2, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { dayGroup, modKey } from '../lib/util';
import { useStore } from '../store';
import type { Chat, Project } from '../types';
import ProjectManager from './ProjectManager';
import AllChats from './AllChats';
import Logo from './Logo';
import { useFocusScope } from '../lib/focus-scope';
import { Exit, exitGhost, motionOff, useFlip } from '../lib/motion';
import { useLongPress } from '../lib/long-press';
import ContextMenu from './ContextMenu';
import { installMenuScrub } from '../lib/menu-scrub';
const AskChats = lazy(() => import('./AskChats'));

const EMPTY_PROJECTS: Project[] = [];

function ChatRow({ chat, active }: { chat: Chat; active: boolean }) {
  const projects = useStore((s) => s.settings.projects) || EMPTY_PROJECTS;
  const { selectChat, deleteChat, renameChat, togglePin, moveChatToProject } = useStore.getState();
  const streaming = useStore((s) => s.streamingChatId === chat.id);
  const [menu, setMenu] = useState(false);
  // Side by side needs room: tablets in landscape and computers.
  const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches;
  const [moving, setMoving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(chat.title);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuKeyboard = useRef(false);
  const rowRef = useRef<HTMLLIElement>(null);
  // Phones: press and hold a chat for its options.
  const [held, setHeld] = useState(false);
  useLongPress(rowRef, () => setHeld(true), { enabled: !editing, ignore: 'input, .row-menu' });
  useLayoutEffect(() => {
    const root = menu && menuRef.current?.querySelector<HTMLElement>('.menu:not(.exit-ghost)');
    return root ? installMenuScrub(root) : undefined;
  }, [menu]);
  const remove = () => { if (confirm(`Delete "${chat.title}"?`)) { if (rowRef.current) exitGhost(rowRef.current, 'row'); void deleteChat(chat.id); } };

  useEffect(() => {
    if (!menu) return;
    const root = menuRef.current?.querySelector<HTMLElement>('.menu:not(.exit-ghost)');
    (menuKeyboard.current ? root?.querySelector<HTMLElement>('[role="menuitem"]') : root)?.focus({ preventScroll: true });
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  if (editing) {
    return (
      <li className="chat-row editing">
        <input
          aria-label="Chat name"
          data-local-escape
          autoFocus
          dir="auto"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            void renameChat(chat.id, title);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              e.preventDefault();e.stopPropagation();
              setTitle(chat.title);
              setEditing(false);
            }
          }}
        />
      </li>
    );
  }

  return (
    <li className={`chat-row${active ? ' active' : ''}${menu ? ' menu-open' : ''}`} data-flip={chat.id} ref={rowRef}>
      <button className="chat-open" onClick={() => {
        // Phones: the drawer starts sliding away at once (on the compositor), then the chat renders.
        if (window.matchMedia('(max-width: 899px)').matches && useStore.getState().sidebarOpen) { useStore.getState().setUi({ sidebarOpen: false }); requestAnimationFrame(() => setTimeout(() => selectChat(chat.id), 0)); }
        else selectChat(chat.id);
      }} dir="auto" title={chat.title}>
        {chat.pinned && <Pin size={13} className="pin-mark" />}
        <span className="chat-title">{chat.title}</span>
        {streaming && <span className="dot-pulse" aria-label="Replying" />}
      </button>
      <div className="row-menu" ref={menuRef}>
        <button className="icon-btn sm" aria-label="Chat options" aria-haspopup="menu" aria-expanded={menu} onClick={e => { menuKeyboard.current = e.detail === 0; setMenu(!menu); }} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();menuKeyboard.current=true;setMenu(true)}}}>
          <MoreHorizontal size={16} />
        </button>
        {menu && (<Exit kind="drop">
          <div className="menu" role="menu" aria-label="Chat options" tabIndex={-1} onKeyDown={e=>{
            if(e.key==='Escape'){e.stopPropagation();setMenu(false);menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();return}
            if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
            e.preventDefault();const items=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];const index=items.indexOf(document.activeElement as HTMLButtonElement);
            items[e.key==='Home'?0:e.key==='End'?items.length-1:index<0?(e.key==='ArrowUp'?items.length-1:0):(index+(e.key==='ArrowUp'?-1:1)+items.length)%items.length]?.focus();
          }}>
            <button role="menuitem" onClick={() => { setMenu(false); setTitle(chat.title); setEditing(true); }}>
              <Pencil size={15} /> Rename
            </button>
            <button role="menuitem" onClick={() => { setMenu(false); void togglePin(chat.id); }}>
              {chat.pinned ? <PinOff size={15} /> : <Pin size={15} />} {chat.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button role="menuitem" onClick={() => setMoving(!moving)}><FolderKanban size={15} /> Move to project</button>
            {moving && <div className="chat-move-list">
              <button role="menuitem" onClick={() => { setMenu(false); moveChatToProject(chat.id, null); }}>All chats</button>
              {projects.map((project) => <button key={project.id} role="menuitem" onClick={() => { setMenu(false); moveChatToProject(chat.id, project.id); }}>{project.name}</button>)}
            </div>}
            <button role="menuitem" onClick={() => { setMenu(false); void useStore.getState().setArchived(chat.id, !chat.archived); useStore.getState().toast(chat.archived ? 'Moved back to your chats' : 'Archived · find it in View all chats → Archived'); }}>{chat.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />} {chat.archived ? 'Unarchive' : 'Archive'}</button>
            {wide && !active && <button role="menuitem" onClick={() => { setMenu(false); useStore.getState().setUi({ sideChatId: chat.id }); }}><Columns2 size={15} /> Open side by side</button>}
            <button role="menuitem" onClick={() => { setMenu(false); useStore.getState().setUi({ exportChatId: chat.id, sidebarOpen: false }); }}>
              <Download size={15} /> Share or export
            </button>
            <button role="menuitem" className="danger" onClick={() => { setMenu(false); remove(); }}>
              <Trash2 size={15} /> Delete
            </button>
          </div>
        </Exit>)}
      </div>
      {held && rowRef.current && (
        <ContextMenu anchor={rowRef.current} label="Chat options" onClose={() => setHeld(false)} items={[
          { label: 'Rename', icon: <Pencil size={17} />, onSelect: () => { setTitle(chat.title); setEditing(true); } },
          { label: chat.pinned ? 'Unpin' : 'Pin', icon: chat.pinned ? <PinOff size={17} /> : <Pin size={17} />, onSelect: () => void togglePin(chat.id) },
          { label: 'Move to project', icon: <FolderKanban size={17} />, onSelect: () => { setMoving(true); setMenu(true); } },
          { label: chat.archived ? 'Unarchive' : 'Archive', icon: chat.archived ? <ArchiveRestore size={17} /> : <Archive size={17} />, onSelect: () => { void useStore.getState().setArchived(chat.id, !chat.archived); useStore.getState().toast(chat.archived ? 'Moved back to your chats' : 'Archived · find it in View all chats → Archived'); } },
          ...(wide && !active ? [{ label: 'Open side by side', icon: <Columns2 size={17} />, onSelect: () => useStore.getState().setUi({ sideChatId: chat.id, sidebarOpen: false }) }] : []),
          { label: 'Share or export', icon: <Download size={17} />, onSelect: () => useStore.getState().setUi({ exportChatId: chat.id, sidebarOpen: false }) },
          { label: 'Delete', icon: <Trash2 size={17} />, danger: true, onSelect: remove },
        ]} />
      )}
    </li>
  );
}

export default function Sidebar({ onCollapse }: { onCollapse: () => void }) {
  const user = useStore((st) => st.user);
  const chats = useStore((s) => s.chats);
  const currentId = useStore((s) => s.currentId);
  const projects = useStore((s) => s.settings.projects) || EMPTY_PROJECTS;
  const activeProjectId = useStore((s) => s.activeProjectId);
  const selectedProjectId = projects.some((p) => p.id === activeProjectId) ? activeProjectId : null;
  const open = useStore((s) => s.sidebarOpen);
  const { newChat, setUi, selectProject } = useStore.getState();
  const page = useStore((s) => s.page);
  const [query, setQuery] = useState('');
  const [allChats, setAllChats] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  // Rows glide to their new place when the order changes (pin, new chat, delete); not while searching.
  const listRef = useRef<HTMLElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [projectManager, setProjectManager] = useState(false);
  const [editProjectId, setEditProjectId] = useState<string | undefined>(undefined);
  const [createNewProject, setCreateNewProject] = useState(false);
  const [phone, setPhone] = useState(() => window.matchMedia('(max-width: 899px)').matches);
  const sidebarRef = useRef<HTMLElement>(null);
  useFocusScope(sidebarRef,phone&&open,()=>setUi({sidebarOpen:false}));
  const wasOpen = useRef(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 899px)');
    const change = () => setPhone(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (phone) {
      // Focus the drawer itself so no button shows a focus ring after a tap.
      if (open) sidebarRef.current?.focus({ preventScroll: true });
      else if (wasOpen.current && !useStore.getState().settingsOpen) document.querySelector<HTMLButtonElement>('.menu-btn')?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open, phone]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = chats.filter((c) => !isTemporaryChat(c) && (c.messages.length > 0 || Boolean(c.documents?.length) || c.id === currentId) );
    // Archived chats stay out of the list, but searching still finds them.
    const filtered = q ? visible : visible.filter((c) => !c.archived || c.id === currentId);
    const matches = q
      ? filtered.filter((c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.text.toLowerCase().includes(q)))
      : filtered;
    const out: [string, Chat[]][] = [];
    const pinned = matches.filter((c) => c.pinned && !c.archived);
    if (pinned.length) out.push(['Pinned', pinned]);
    for (const c of matches.filter((c) => !c.pinned && !c.archived)) {
      const g = dayGroup(c.updatedAt);
      const last = out[out.length - 1];
      if (last && last[0] === g) last[1].push(c);
      else out.push([g, [c]]);
    }
    const archived = matches.filter((c) => c.archived);
    if (archived.length) out.push(['Archived', archived]);
    return out;
  }, [chats, query, currentId]);
  useFlip(listRef, groups.map(([label, list]) => `${label}:${list.map((c) => c.id).join(',')}`).join('|'), !query);
  // The bar marking the open chat glides to the chat you pick instead of jumping.
  const indicator = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);
  useLayoutEffect(() => {
    const nav = listRef.current, bar = indicator.current;
    if (!nav || !bar) return;
    const row = nav.querySelector<HTMLElement>('.chat-row.active');
    if (!row) { bar.style.opacity = '0'; placed.current = false; return; }
    const n = nav.getBoundingClientRect(), r = row.getBoundingClientRect();
    const move = () => { bar.style.height = `${r.height - 18}px`; bar.style.transform = `translate(${r.left - n.left}px, ${r.top - n.top + 9}px)`; bar.style.opacity = '1'; };
    if (!placed.current || motionOff()) { bar.style.transition = 'none'; move(); void bar.offsetWidth; bar.style.transition = ''; }
    else move();
    placed.current = true;
  }, [currentId, groups]);


  return (
    <>
    <aside
      ref={sidebarRef}
      className={`sidebar${open ? ' open' : ''}`}
      aria-label="Chats"
      role={phone ? 'dialog' : undefined}
      tabIndex={-1}
      aria-modal={phone && open || undefined}
      aria-hidden={phone && !open || undefined}
      inert={phone && !open}
      onClickCapture={(e) => {
        // Using the sidebar while Settings is open (computers) leaves Settings, except the Settings button itself.
        const target = (e.target as HTMLElement).closest('button, a, [role="button"]');
        if (target && !target.closest('.sidebar-foot, .row-menu, .chat-menu, [role="menu"]') && useStore.getState().settingsOpen) setUi({ settingsOpen: false });
      }}
    >
      <div className="sidebar-head">
        <span className="sidebar-brand"><Logo size={24} />Lumen</span>
        <button className="icon-btn collapse-sidebar" onClick={onCollapse} aria-label="Collapse sidebar" title={`Collapse sidebar (${modKey}⇧S)`}>
          <PanelLeftClose size={18} />
        </button>
        <button className="icon-btn close-sidebar" onClick={() => setUi({ sidebarOpen: false })} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>

      <div className="sidebar-scroll">
      <div className="sidebar-bottom-actions">
        {!phone && <button type="button" className="new-chat sidebar-primary-action" onClick={newChat} title={`New chat (${modKey}⇧O)`}><Plus size={18} strokeWidth={2.2} /><span>New chat</span></button>}
        <label className="search sidebar-search-field">
          <Search size={16} />
          <input ref={searchInput} id="chat-search" data-local-escape type="search" aria-label="Search chats" placeholder="Search chats" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.stopPropagation(); setQuery(''); } }} dir="auto" />
        </label>
        {query.trim().length > 1 && (
          <button type="button" className="ask-chats-btn" onClick={() => setAsking(query)} title="Find what you talked about, even with different words, and get an answer from it">
            <Sparkles size={15} /> <span>Ask your chats: “<span dir="auto">{query.trim().slice(0, 40)}</span>”</span>
          </button>
        )}
        <button className={`library-button${page === 'collection' ? ' active' : ''}`} aria-current={page === 'collection' ? 'page' : undefined} onClick={() => useStore.getState().setUi({ page: 'collection', pageArg: 'all' })} title="Photos, files and documents from all your chats"><LayoutGrid size={18} /><span>Library</span></button>
        <button className={`library-button${page === 'tools' || page === 'assistants' || page === 'study' ? ' active' : ''}`} aria-current={page === 'tools' ? 'page' : undefined} onClick={() => useStore.getState().setUi({ page: 'tools' })} title={`Research, create, analyze, study, assistants and connected apps (${modKey}⇧L)`}><Shapes size={18} /><span>Tools</span></button>
      </div>

      <div className="sidebar-navigation">
      <div className="sidebar-section-heading">
        <h2 className="sidebar-section-label"><button type="button" className={`sidebar-section-link${page === 'projects' ? ' active' : ''}`} onClick={() => useStore.getState().setUi({ page: 'projects' })} title="All projects">Projects <ChevronRight size={14} aria-hidden="true" /></button></h2>
        <button type="button" className="sidebar-chip" onClick={() => { setEditProjectId(undefined); setCreateNewProject(true); setProjectManager(true); }} title="Create a new project" aria-label="New project"><Plus size={13} strokeWidth={2.2} /><span className="chip-text"> New project</span></button>
      </div>

      <div className="sidebar-projects-list">
        {(
          // The few you used last; all of them are on the Projects page.
          [...projects].sort((a, b) => Math.max(b.updatedAt, ...chats.filter((c) => c.projectId === b.id).map((c) => c.updatedAt)) - Math.max(a.updatedAt, ...chats.filter((c) => c.projectId === a.id).map((c) => c.updatedAt))).filter((p, i) => i < 4 || p.id === selectedProjectId).map((project) => {
            const isSelected = selectedProjectId === project.id;
            const count = chats.filter((c) => c.projectId === project.id).length;
            return (
              <div key={project.id} className={`sidebar-project-item-wrap${isSelected ? ' active' : ''}`}>
                <button
                  type="button"
                  className={`sidebar-project-item${isSelected ? ' active' : ''}`}
                  onClick={() => selectProject(project.id)}
                  title={project.name}
                  aria-current={isSelected ? 'page' : undefined}
                >
                  <span className={`sidebar-project-dot color-${project.color || 'indigo'}`} aria-hidden="true" />
                  <span className="sidebar-project-name">{project.name}</span>
                  {count > 0 && <span className="sidebar-project-badge" aria-label={`${count} chats`}>{count}</span>}
                </button>
                <button
                  type="button"
                  className="icon-btn xs sidebar-project-action"
                  title="Edit project"
                  aria-label={`Edit ${project.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditProjectId(project.id);
                    setCreateNewProject(false);
                    setProjectManager(true);
                  }}
                >
                  <Pencil size={13} />
                </button>
              </div>
            );
          })
        )}
        {projects.length > 4 && <button type="button" className="view-all-chats" onClick={() => useStore.getState().setUi({ page: 'projects' })}>All projects ({projects.length}) <ChevronRight size={14} aria-hidden="true" /></button>}
      </div>

      <div className="sidebar-section-heading history-heading">
        <h2 className="sidebar-section-label history-label">{query ? 'Search results' : 'Recents'}</h2>
      </div>
      <nav className="chat-list has-indicator" aria-label="Chat history" ref={listRef}>
        {groups.length === 0 && <p className="muted small empty-list">{query ? 'No chats match.' : 'Your chats will appear here.'}</p>}
        {groups.map(([label, list]) => (
          <section key={label}>
            <h3 className="group-label">{label}</h3>
            <ul>
              {list.map((c) => (
                <ChatRow key={c.id} chat={c} active={c.id === currentId} />
              ))}
            </ul>
          </section>
        ))}
        {/* (Last, so it doesn't change which section counts as the first.) */}
        <span className="active-indicator" ref={indicator} aria-hidden="true" />
      </nav>
      {groups.length > 0 && <button type="button" className="view-all-chats" onClick={() => setAllChats(true)}>View all chats <ChevronRight size={14} aria-hidden="true" /></button>}
      </div>
      </div>
      <div className="sidebar-footer">
        {/* On phones New chat sits at the inline end of the footer; it comes first in the DOM so the account button stays last. */}
        {phone && <button className="sidebar-chip new-chat floating" onClick={newChat}><Plus size={16} strokeWidth={2.2} /> New chat</button>}
        <button className="sidebar-foot" onClick={() => setUi({ settingsOpen: true, settingsTab: '', sidebarOpen: false })} aria-label="Settings" title={`Settings (${modKey},)`}>
          {user?.photo ? <img className="avatar" src={user.photo} alt="" referrerPolicy="no-referrer" /> : <span className="avatar">{(user?.name || user?.email || '?').slice(0, 1).toUpperCase()}</span>}
          <span className="account-text">
            <span className="account-name">{user?.name || user?.email?.split('@')[0] || 'Account'}</span>
            <span className="account-sub">Settings &amp; keys</span>
          </span>
          <Settings2 size={16} className="account-gear" aria-hidden="true" />
        </button>
      </div>
    </aside>
    {asking !== null && <Suspense fallback={null}><AskChats initial={asking} onClose={() => setAsking(null)} /></Suspense>}
    {allChats && <AllChats onClose={() => setAllChats(false)} />}
    {projectManager && (
      <ProjectManager
        initialProjectId={editProjectId}
        createNewImmediately={createNewProject}
        onClose={() => {
          setProjectManager(false);
          setEditProjectId(undefined);
          setCreateNewProject(false);
        }}
      />
    )}
    </>
  );
}
