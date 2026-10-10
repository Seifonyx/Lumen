import { Download, FolderKanban, MessageSquare, MoreHorizontal, PanelLeftClose, Pencil, Pin, PinOff, Plus, Search, Settings, SquarePen, Tag, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { dayGroup, modKey, modelShortName, safeFileName, saveBlob } from '../lib/util';
import { useStore } from '../store';
import type { Chat, Project } from '../types';
import ProjectManager from './ProjectManager';

const EMPTY_PROJECTS: Project[] = [];

function chatToMarkdown(chat: Chat): string {
  const lines = [`# ${chat.title}`, ''];
  for (const m of chat.messages) {
    lines.push(m.role === 'user' ? '## You' : `## Assistant${m.model ? ` (${modelShortName(m.model)})` : ''}`);
    if (m.files?.length) lines.push(`_Attachments: ${m.files.map((f) => f.name).join(', ')}_`);
    lines.push(m.text || m.error || '', '');
  }
  return lines.join('\n');
}

function ChatRow({ chat, active }: { chat: Chat; active: boolean }) {
  const projects = useStore((s) => s.settings.projects) || EMPTY_PROJECTS;
  const { selectChat, deleteChat, renameChat, togglePin, moveChatToProject, setChatTags } = useStore.getState();
  const streaming = useStore((s) => s.streamingChatId === chat.id);
  const [menu, setMenu] = useState(false);
  const [moving, setMoving] = useState(false);
  const [tagging, setTagging] = useState(false);
  const [tags, setTags] = useState((chat.tags || []).join(', '));
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(chat.title);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
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
              setTitle(chat.title);
              setEditing(false);
            }
          }}
        />
      </li>
    );
  }

  return (
    <li className={`chat-row${active ? ' active' : ''}`}>
      <button className="chat-open" onClick={() => selectChat(chat.id)} dir="auto" title={chat.title}>
        {chat.pinned && <Pin size={13} className="pin-mark" />}
        <span className="chat-title">{chat.title}</span>
        {!!chat.tags?.length && <span className="chat-tag-count" title={chat.tags.join(', ')}>{chat.tags.length}</span>}
        {streaming && <span className="dot-pulse" aria-label="Replying" />}
      </button>
      <div className="row-menu" ref={menuRef}>
        <button className="icon-btn sm" aria-label="Chat options" onClick={() => setMenu(!menu)}>
          <MoreHorizontal size={16} />
        </button>
        {menu && (
          <div className="menu" role="menu">
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
            <button role="menuitem" onClick={() => setTagging(!tagging)}><Tag size={15} /> Edit tags</button>
            {tagging && <div className="chat-tag-editor"><input autoFocus value={tags} maxLength={140} onChange={(e) => setTags(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setMenu(false); setChatTags(chat.id, tags.split(',')); } }} placeholder="tag1, tag2" aria-label="Chat tags" /><button onClick={() => { setMenu(false); setChatTags(chat.id, tags.split(',')); }}>Save</button><small>Up to 5 tags; search finds them.</small></div>}
            <button role="menuitem" onClick={() => { setMenu(false); void saveBlob(new Blob([chatToMarkdown(chat)], { type: 'text/markdown' }), `${safeFileName(chat.title, 'chat')}.md`); }}>
              <Download size={15} /> Export
            </button>
            <button role="menuitem" className="danger" onClick={() => { setMenu(false); if (confirm(`Delete "${chat.title}"?`)) void deleteChat(chat.id); }}>
              <Trash2 size={15} /> Delete
            </button>
          </div>
        )}
      </div>
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
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (searchOpen) searchInput.current?.focus({ preventScroll: true }); }, [searchOpen]);
  const [projectManager, setProjectManager] = useState(false);
  const [phone, setPhone] = useState(() => window.matchMedia('(max-width: 899px)').matches);
  const sidebarRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 899px)');
    const change = () => setPhone(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (phone) {
      if (open) sidebarRef.current?.querySelector<HTMLButtonElement>('.close-sidebar')?.focus({ preventScroll: true });
      else if (wasOpen.current && !useStore.getState().settingsOpen) document.querySelector<HTMLButtonElement>('.menu-btn')?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open, phone]);
  useEffect(() => {
    if (!phone || !open) return;
    const main = document.querySelector<HTMLElement>('.main');
    const previouslyInert = main?.inert;
    if (main) main.inert = true;
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || document.querySelector('.modal-backdrop, .sheet-backdrop')) return;
      const items = [...(sidebarRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, a[href]') || [])].filter(el => el.getClientRects().length > 0);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => {
      if (main) main.inert = previouslyInert || false;
      document.removeEventListener('keydown', trap);
    };
  }, [open, phone]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = chats.filter((c) => (c.messages.length > 0 || c.id === currentId) && (!selectedProjectId || c.projectId === selectedProjectId));
    const matches = q
      ? visible.filter((c) => c.title.toLowerCase().includes(q) || c.tags?.some((t) => t.toLowerCase().includes(q)) || c.messages.some((m) => m.text.toLowerCase().includes(q)))
      : visible;
    const out: [string, Chat[]][] = [];
    const pinned = matches.filter((c) => c.pinned);
    if (pinned.length) out.push(['Pinned', pinned]);
    for (const c of matches.filter((c) => !c.pinned)) {
      const g = dayGroup(c.updatedAt);
      const last = out[out.length - 1];
      if (last && last[0] === g) last[1].push(c);
      else out.push([g, [c]]);
    }
    return out;
  }, [chats, query, currentId, selectedProjectId]);

  return (
    <>
    <aside
      ref={sidebarRef}
      className={`sidebar${open ? ' open' : ''}`}
      aria-label="Chats"
      role={phone ? 'dialog' : undefined}
      aria-modal={phone && open || undefined}
      aria-hidden={phone && !open || undefined}
      inert={phone && !open}
    >
      <div className="sidebar-head">
        <button className="icon-btn collapse-sidebar" onClick={onCollapse} aria-label="Collapse sidebar" title="Collapse sidebar">
          <PanelLeftClose size={18} />
        </button>
        <button className="icon-btn close-sidebar" onClick={() => setUi({ sidebarOpen: false })} aria-label="Close menu">
          <X size={18} />
        </button>
        <button ref={searchButton} className={`icon-btn sidebar-search-button${searchOpen ? ' active' : ''}`} aria-label="Search chats" title="Search chats" aria-expanded={searchOpen} aria-controls="chat-search" onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setQuery(''); }}><Search size={19} /></button>
      </div>
      {searchOpen && <label className="search sidebar-search-field">
        <Search size={16} />
        <input ref={searchInput} id="chat-search" type="search" aria-label="Search chats" placeholder="Search chats" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setSearchOpen(false); setQuery(''); searchButton.current?.focus(); } }} dir="auto" />
        <button className="icon-btn sm" aria-label="Close search" onClick={() => { setSearchOpen(false); setQuery(''); searchButton.current?.focus(); }}><X size={15} /></button>
      </label>}
      <div className="sidebar-section-heading"><h2 className="sidebar-section-label"><FolderKanban size={15} aria-hidden="true" />Projects</h2><button className="icon-btn sm" onClick={() => setProjectManager(true)} aria-label="Manage projects" title="Manage projects"><Plus size={16} /></button></div>
      <div className="project-switcher">
        <FolderKanban size={16} />
        <select aria-label="Choose project" value={selectedProjectId || ''} onChange={(e) => selectProject(e.target.value || null)}>
          <option value="">All chats</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      </div>
      <h2 className="sidebar-section-label history-label"><MessageSquare size={15} aria-hidden="true" />{query ? 'Search results' : 'Chats'}</h2>
      <nav className="chat-list" aria-label="Chat history">
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
      </nav>
      <div className="sidebar-bottom-actions">
        <button className="btn new-chat" onClick={newChat} title={`New chat (${modKey}⇧O)`}>
          <SquarePen size={18} /> New chat
        </button>
      </div>
      <button className="sidebar-foot" onClick={() => setUi({ settingsOpen: true, settingsTab: '', sidebarOpen: false })} aria-label="Settings">
        {user?.photo ? <img className="avatar" src={user.photo} alt="" referrerPolicy="no-referrer" /> : <span className="avatar">{(user?.name || user?.email || '?').slice(0, 1).toUpperCase()}</span>}
        <span className="account">
          <span className="account-name">{user?.name || user?.email?.split('@')[0] || 'Account'}</span>
          <span className="account-mail">Settings & preferences</span>
        </span>
        <Settings size={16} />
      </button>
    </aside>
    {projectManager && <ProjectManager onClose={() => setProjectManager(false)} />}
    </>
  );
}
