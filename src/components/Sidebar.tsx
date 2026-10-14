import { isTemporaryChat } from '../lib/temporary-chat';
import { FileText, BookOpen, Download, FolderKanban, MoreHorizontal, PanelLeftClose, Pencil, Pin, PinOff, Plus, Search, Settings, Tag, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { dayGroup, modKey } from '../lib/util';
import { useStore } from '../store';
import type { Chat, Project } from '../types';
import ProjectManager from './ProjectManager';
import Logo from './Logo';
import Modal from './Modal';
import { useFocusScope } from '../lib/focus-scope';

const EMPTY_PROJECTS: Project[] = [];

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
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
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
    <li className={`chat-row${active ? ' active' : ''}`}>
      <button className="chat-open" onClick={() => selectChat(chat.id)} dir="auto" title={chat.title}>
        {chat.pinned && <Pin size={13} className="pin-mark" />}
        <span className="chat-title">{chat.title}</span>
        {!!chat.tags?.length && <span className="chat-tag-count" title={chat.tags.join(', ')}>{chat.tags.length}</span>}
        {streaming && <span className="dot-pulse" aria-label="Replying" />}
      </button>
      <div className="row-menu" ref={menuRef}>
        <button className="icon-btn sm" aria-label="Chat options" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setMenu(true)}}}>
          <MoreHorizontal size={16} />
        </button>
        {menu && (
          <div className="menu" role="menu" aria-label="Chat options" onKeyDown={e=>{
            if(e.key==='Escape'){e.stopPropagation();setMenu(false);menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();return}
            if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
            e.preventDefault();const items=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];const index=items.indexOf(document.activeElement as HTMLButtonElement);
            items[e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowUp'?-1:1)+items.length)%items.length]?.focus();
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
            <button role="menuitem" onClick={() => {setMenu(false);setTagging(true)}}><Tag size={15} /> Edit tags</button>
            <button role="menuitem" onClick={() => { setMenu(false); useStore.getState().setUi({ exportChatId: chat.id, sidebarOpen: false }); }}>
              <Download size={15} /> Export
            </button>
            <button role="menuitem" className="danger" onClick={() => { setMenu(false); if (confirm(`Delete "${chat.title}"?`)) void deleteChat(chat.id); }}>
              <Trash2 size={15} /> Delete
            </button>
          </div>
        )}
      </div>
      {tagging && <Modal title="Chat tags" onClose={()=>setTagging(false)}><div className="chat-tag-editor">
        <input autoFocus value={tags} maxLength={140} onChange={e=>setTags(e.target.value)} onKeyDown={e=>{
          if(e.key==='Enter'){e.preventDefault();setTagging(false);setChatTags(chat.id,tags.split(','));}
        }} placeholder="tag1, tag2" aria-label="Chat tags"/>
        <button onClick={()=>{setTagging(false);setChatTags(chat.id,tags.split(','));}}>Save</button><small>Up to 5 tags; search finds them.</small>
      </div></Modal>}
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
  const [artifacts,setArtifacts]=useState(false);
  const library=(section:string)=>{setUi({sidebarOpen:false});window.dispatchEvent(new CustomEvent('mr:library',{detail:section}));};
  const [query, setQuery] = useState('');
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
      if (open) sidebarRef.current?.querySelector<HTMLButtonElement>('.close-sidebar')?.focus({ preventScroll: true });
      else if (wasOpen.current && !useStore.getState().settingsOpen) document.querySelector<HTMLButtonElement>('.menu-btn')?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open, phone]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = chats.filter((c) => !isTemporaryChat(c) && (c.messages.length > 0 || Boolean(c.documents?.length) || c.id === currentId) );
    const filtered=visible;
    const matches = q
      ? filtered.filter((c) => c.title.toLowerCase().includes(q) || c.tags?.some((t) => t.toLowerCase().includes(q)) || c.messages.some((m) => m.text.toLowerCase().includes(q)))
      : filtered;
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
  }, [chats, query, currentId]);


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
    >
      <div className="sidebar-head">
        <span className="sidebar-brand"><Logo size={24} />Model Router</span>
        <button className="icon-btn collapse-sidebar" onClick={onCollapse} aria-label="Collapse sidebar" title="Collapse sidebar">
          <PanelLeftClose size={18} />
        </button>
        <button className="icon-btn close-sidebar" onClick={() => setUi({ sidebarOpen: false })} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>

      <div className="sidebar-scroll">
      <div className="sidebar-bottom-actions">
        <button className="btn new-chat" onClick={newChat} title={`New chat (${modKey}⇧O)`}>
          <Plus size={18} /> <span>New chat</span>
          {!phone && <span className="kbd">{modKey}⇧O</span>}
        </button>
        <label className="search sidebar-search-field">
          <Search size={16} />
          <input ref={searchInput} id="chat-search" data-local-escape type="search" aria-label="Search chats" placeholder="Search chats" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.stopPropagation(); setQuery(''); } }} dir="auto" />
        </label>
        <button className="library-button" onClick={() => library('assistants')} title="Assistants, prompts, knowledge, tools and scheduled tasks"><BookOpen size={18} /><span>Library</span></button>
        <button className="library-button" onClick={() => setArtifacts(true)}><FileText size={18} /><span>Documents</span></button>
      </div>

      <div className="sidebar-navigation">
      <div className="sidebar-section-heading">
        <h2 className="sidebar-section-label">Projects</h2>
        {projects.length > 0 && (
          <button
            className="icon-btn sm"
            onClick={() => { setEditProjectId(undefined); setCreateNewProject(true); setProjectManager(true); }}
            aria-label="New project"
            title="Create a new project"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      <div className="sidebar-projects-list">
        {projects.length === 0 ? (
          <button
            type="button"
            className="sidebar-empty-project-btn"
            onClick={() => { setEditProjectId(undefined); setCreateNewProject(true); setProjectManager(true); }}
          >
            <Plus size={14} /> New project
          </button>
        ) : (
          projects.map((project) => {
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
      </div>

      <h2 className="sidebar-section-label history-label">{query ? 'Search results' : 'Recents'}</h2>
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
      </div>
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
    {artifacts&&<Modal title="Documents" onClose={()=>setArtifacts(false)}><div className="artifact-list">{chats.filter(c=>!isTemporaryChat(c)).flatMap(c=>(c.documents||[]).map(doc=><button className="btn" key={`${c.id}-${doc.id}`} onClick={()=>{useStore.getState().selectChat(c.id);setUi({canvasOpen:true,canvasDocumentId:doc.id});setArtifacts(false);}}><FileText size={18}/><span>{doc.name}<small>{c.title}</small></span></button>))}{!chats.some(c=>!isTemporaryChat(c)&&c.documents?.length)&&<p className="muted">Documents created in canvas will appear here.</p>}</div></Modal>}
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
