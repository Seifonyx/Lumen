// Canvas Projects (approved quality phase, 2026-11-03): All projects as one name-first list, and a project's workspace
// with its chats as the main content and its context (instructions, files, memory, model) beside them. Loaded lazily
// and only by the Canvas presentation; the ordinary build keeps ProjectsPage/ProjectWorkspace. Everything reads and
// writes through the store's existing project, chat and memory actions; nothing new is stored.
import './canvas-projects.css';
import { ArrowUp, ChevronDown, Eye, FileCode, FileSpreadsheet, FileText, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { modelLabel, useStore } from '../store';
import type { Attachment, Project } from '../types';
import { readAttachment } from '../lib/files/read';
import { formatBytes } from '../lib/util';
import { chatPreview } from '../lib/chat-preview';
import { relTime } from '../lib/relative-time';
import { usePhoneLayout } from '../lib/phone-layout';
import { useScreenMemory } from '../lib/screen-memory';
import { useBackLayer } from '../lib/back-stack';
import { navigateScreen, screenBack } from '../lib/screen-history';
import HubPage, { HubEmpty } from './HubPage';
import Modal from './Modal';
import ProjectManager from './ProjectManager';
import ProjectMemory from './ProjectMemory';
import ScreenActions from './ScreenActions';

const NO_PROJECTS: Project[] = [];
const MAX_FILES = 5;
const FILE_TYPES = '.pdf,.docx,.xlsx,.xlsm,.pptx,.txt,.md,.csv,.tsv,.json,.html,.xml,.js,.ts,.py,.css,.sql,.log,.yaml,.yml,.srt,.tex';
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const initial = (name: string) => (name.trim()[0] || '·').toUpperCase();
const fileIcon = (name: string) => (/\.(xlsx|xlsm|csv|tsv)$/i.test(name) ? FileSpreadsheet : /\.(js|ts|tsx|jsx|py|html|css|json|sql|ya?ml)$/i.test(name) ? FileCode : FileText);
const confirmDelete = (p: Project) => confirm(`Delete the project “${p.name}”? Its chats stay, outside any project.`);
type Sort = 'recent' | 'name';

/** All projects: name first, then how many chats and when it was last active. */
export function ProjectList({ onClose }: { onClose: () => void }) {
  const projects = useStore((s) => s.settings.projects) || NO_PROJECTS;
  const chats = useStore((s) => s.chats);
  const [query, setQuery] = useScreenMemory('projects-query', '');
  const [sort, setSort] = useScreenMemory<Sort>('projects-sort', 'recent');
  const [editing, setEditing] = useScreenMemory<{ id?: string; create?: boolean } | null>('projects-editor', null);
  useBackLayer(Boolean(editing), () => setEditing(null), () => setEditing(editing), 'project-editor');
  const phone = usePhoneLayout();
  const [glassPhone] = useState(() => document.documentElement.classList.contains('glass') && window.matchMedia('(max-width: 899px)').matches);
  const search = useRef<HTMLInputElement>(null);
  const stats = useMemo(() => {
    const out = new Map<string, { chats: number; last: number }>();
    for (const c of chats) if (c.projectId) { const s = out.get(c.projectId) || { chats: 0, last: 0 }; s.chats++; s.last = Math.max(s.last, c.updatedAt); out.set(c.projectId, s); }
    return out;
  }, [chats]);
  const last = (p: Project) => Math.max(p.updatedAt, stats.get(p.id)?.last || 0);
  const q = query.trim().toLowerCase();
  const shown = projects.filter((p) => !q || `${p.name} ${p.description || ''} ${p.instructions}`.toLowerCase().includes(q))
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : last(b) - last(a)));
  const open = (id: string) => navigateScreen(() => { useStore.getState().setUi({ page: null }); useStore.getState().selectProject(id); });
  const create = () => setEditing({ create: true });
  const clear = () => { setQuery(''); search.current?.focus(); };
  const any = projects.length > 0;

  return (
    <HubPage label="Projects" title="Projects" large onClose={onClose} compact={glassPhone} create={any ? { label: 'New project', run: create } : undefined}
      actions={!glassPhone && any && <button type="button" className="btn primary" onClick={create}><Plus size={16} /> New project</button>}
      toolbar={any && (
        <>
          <label className="hub-search"><Search size={16} /><input ref={search} type="search" aria-label="Search projects" placeholder="Search projects" value={query} onChange={(e) => setQuery(e.target.value)} dir="auto" />{query && <button type="button" aria-label="Clear project search" onClick={clear}><X size={16} /></button>}</label>
          <label className="projects-sort"><span className="sr-only">Sort projects</span><select aria-label="Sort projects" value={sort} onChange={(e) => setSort(e.target.value as Sort)}><option value="recent">Recently active</option><option value="name">Name</option></select></label>
        </>
      )}>
      <p className="sr-only" role="status">{any ? (q ? `${shown.length} of ${plural(projects.length, 'project')}` : plural(projects.length, 'project')) : ''}</p>
      {!any ? (
        <HubEmpty icon={<Plus size={24} />} title="No projects yet" action={<button type="button" className="btn primary" onClick={create}><Plus size={16} /> New project</button>} />
      ) : shown.length === 0 ? (
        <div className="pl-none"><p>No projects match “{query}”.</p><button type="button" className="btn" onClick={clear}>Clear search</button></div>
      ) : (
        <div className="pl">
          {!phone && <div className="pl-head" aria-hidden="true"><span>Name</span><span>Chats</span><span>Active</span></div>}
          <ul className="pl-list" aria-label="Projects">
            {shown.map((p) => {
              const n = stats.get(p.id)?.chats || 0;
              const sub = phone ? [plural(n, 'chat'), p.description].filter(Boolean).join(' · ') : p.description;
              return (
                <li key={p.id} className="pl-row">
                  <button type="button" className="pl-open" onClick={() => open(p.id)} aria-label={`Open ${p.name}`} aria-describedby={`pl-${p.id}-sub pl-${p.id}-when`}>
                    <span className="pl-mark" aria-hidden="true">{initial(p.name)}</span>
                    <span className="pl-text"><span className="pl-name" dir="auto">{p.name}</span>{sub && <span className="pl-sub" id={`pl-${p.id}-sub`} dir="auto">{phone ? sub : [p.description, <span key="n" className="sr-only">{` · ${plural(n, 'chat')}`}</span>]}</span>}</span>
                    {!phone && <span className="pl-count" aria-hidden="true">{n}</span>}
                    <span className="pl-when" id={`pl-${p.id}-when`}><span className="sr-only">Active </span>{relTime(last(p))}</span>
                  </button>
                  <ScreenActions label={`More for ${p.name}`} actions={[
                    { label: 'Edit project', run: () => setEditing({ id: p.id }) },
                    { label: 'Delete project…', destructive: true, run: () => { if (confirmDelete(p)) void useStore.getState().deleteProject(p.id); } },
                  ]} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {editing && <ProjectManager initialProjectId={editing.id} createNewImmediately={editing.create} onClose={() => screenBack(() => setEditing(null))} />}
    </HubPage>
  );
}

/** A project's workspace: start a chat, its chats, and the context every chat in it gets. */
export function ProjectWorkspace({ project, onOpenSettings }: { project: Project; onOpenSettings?: () => void }) {
  const chats = useStore((s) => s.chats);
  const allMemories = useStore((s) => s.memories);
  const catalog = useStore((s) => s.catalog);
  const memories = useMemo(() => allMemories.filter((m) => m.projectId === project.id), [allMemories, project.id]);
  const { saveProject, selectChat, newChat, deleteChat, renameChat, moveChatToProject, send, toast } = useStore.getState();
  const phone = usePhoneLayout();
  // The unsent text survives leaving and coming back to the project, like the chat composer's draft.
  const [draft, setDraft] = useScreenMemory(`project-draft:${project.id}`, '');
  const [contextOpen, setContextOpen] = useScreenMemory(`project-context:${project.id}`, false);
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<{ name: string; text: string } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const files = project.files || [];
  const instructions = project.instructions?.trim() || '';

  const saveFiles = (next: Attachment[]) => saveProject({ ...project, files: next, updatedAt: Date.now() });
  const addFiles = async (incoming: File[]) => {
    if (!incoming.length) return;
    const room = Math.max(0, MAX_FILES - files.length);
    if (!room) return toast(`A project keeps up to ${MAX_FILES} files.`, 'error');
    setUploading(true);
    const added: Attachment[] = [];
    for (const file of incoming.slice(0, room)) {
      try {
        const a = await readAttachment(file, { textOnly: true });
        if (!a.text) throw new Error(`${file.name}: couldn't read any text from it.`);
        added.push({ ...a, text: a.text.slice(0, 20000) });
      } catch (e) {
        toast((e as Error).message, 'error');
      }
    }
    if (added.length) saveFiles([...files, ...added]);
    if (incoming.length > room) toast(`A project keeps up to ${MAX_FILES} files.`, 'error');
    setUploading(false);
  };
  const start = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    newChat();
    void send(text, []);
  };
  const rename = (id: string) => { if (newTitle.trim()) void renameChat(id, newTitle.trim()); setRenaming(null); };

  const projectChats = chats.filter((c) => c.projectId === project.id).sort((a, b) => b.updatedAt - a.updatedAt);
  const q = query.trim().toLowerCase();
  const shown = q ? projectChats.filter((c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.text.toLowerCase().includes(q))) : projectChats;
  const model = project.defaultModel ? modelLabel(catalog, project.defaultModel) : '';
  const summary = [instructions ? 'Instructions' : '', files.length ? plural(files.length, 'file') : '', memories.length ? plural(memories.length, 'memory', 'memories') : '', model].filter(Boolean).join(' · ') || 'No context yet';

  return (
    <div className="project-page claude-project-view pw">
      <div className="pw-layout">
        <header className="pw-head">
          <div className="pw-head-text">
            <h1 className={`pw-title claude-project-title${phone ? ' sr-only' : ''}`} aria-hidden={phone || undefined}>{project.name}</h1>
            {project.description && <p className="pw-desc" dir="auto">{project.description}</p>}
          </div>
          {!phone && <button type="button" className="btn pw-edit" onClick={onOpenSettings}><Pencil size={15} /> Edit</button>}
        </header>

        <form className="pw-composer" onSubmit={(e) => { e.preventDefault(); start(); }}>
          <textarea aria-label="Start a project conversation" rows={1} dir="auto" value={draft} placeholder={`New chat in ${project.name}`}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); start(); }
            }} />
          <button type="submit" className="pw-send" disabled={!draft.trim()} aria-label="Send message (Enter)" title="Send (Enter)"><ArrowUp size={18} /></button>
        </form>

        <aside className={`pw-context${contextOpen ? ' is-open' : ''}`} aria-label="Project context">
          <button type="button" className="pw-context-toggle project-context-toggle" aria-expanded={contextOpen} aria-controls="project-context-content" onClick={() => setContextOpen(!contextOpen)}>
            <span><strong>Context</strong><small>{summary}</small></span><ChevronDown size={18} aria-hidden="true" />
          </button>
          <div id="project-context-content" className="pw-context-content project-context-content">
            <section className="pw-ctx" aria-labelledby={`pw-ins-${project.id}`}>
              <div className="pw-ctx-head"><h2 id={`pw-ins-${project.id}`}>Instructions</h2><button type="button" className="pw-link" onClick={onOpenSettings} aria-label={instructions ? 'Edit project instructions' : 'Add project instructions'}>{instructions ? 'Edit' : 'Add'}</button></div>
              {instructions && <p className="pw-instructions project-instructions" dir="auto">{instructions}</p>}
            </section>
            <section className="pw-ctx" aria-labelledby={`pw-files-${project.id}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void addFiles([...(e.dataTransfer.files || [])]); }}>
              <div className="pw-ctx-head">
                <h2 id={`pw-files-${project.id}`}>Files <span className="pw-count">{files.length}/{MAX_FILES}</span></h2>
                <button type="button" className="pw-link" disabled={files.length >= MAX_FILES || uploading} onClick={() => fileInput.current?.click()} aria-label="Add project files">{uploading ? 'Adding…' : 'Add'}</button>
              </div>
              <input ref={fileInput} type="file" multiple hidden accept={FILE_TYPES} onChange={(e) => { void addFiles([...(e.target.files || [])]); e.target.value = ''; }} />
              {files.length > 0 && (
                <ul className="pw-files">
                  {files.map((f) => {
                    const Icon = fileIcon(f.name);
                    return (
                      <li key={f.id} className="pw-file">
                        <Icon size={16} aria-hidden="true" />
                        <span className="pw-file-name" title={f.name} dir="auto">{f.name}</span>
                        <span className="pw-file-size">{formatBytes(f.size || f.text?.length || 0)}</span>
                        {f.text && <button type="button" className="pw-icon" aria-label={`Preview ${f.name}`} title="Preview text" onClick={() => setPreview({ name: f.name, text: f.text || '' })}><Eye size={15} /></button>}
                        <button type="button" className="pw-icon" aria-label={`Remove ${f.name}`} title="Remove" onClick={() => saveFiles(files.filter((x) => x.id !== f.id))}><Trash2 size={15} /></button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <ProjectMemory projectId={project.id} memories={memories} />
            <section className="pw-ctx" aria-labelledby={`pw-model-${project.id}`}>
              <div className="pw-ctx-head"><h2 id={`pw-model-${project.id}`}>Model</h2><button type="button" className="pw-link" onClick={onOpenSettings} aria-label="Change the project's default model">Change</button></div>
              <p className="pw-value">{model || 'Same as the rest of the app'}</p>
            </section>
          </div>
        </aside>

        <section className="pw-chats" aria-labelledby={`pw-chats-${project.id}`}>
          <div className="pw-chats-head">
            <h2 id={`pw-chats-${project.id}`}>Chats <span className="pw-count">{projectChats.length}</span></h2>
            {projectChats.length > 5 && (
              <label className="pw-search"><Search size={15} aria-hidden="true" /><input type="search" aria-label="Search project conversations" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
            )}
          </div>
          {projectChats.length === 0 ? <p className="pw-empty">No chats yet</p>
            : shown.length === 0 ? <p className="pw-empty">No chats match “{query}”</p>
            : (
              <ul className="pw-chat-list">
                {shown.map((c) => (
                  <li key={c.id} className="pw-chat">
                    {renaming === c.id ? (
                      <input autoFocus className="pw-rename" aria-label="Chat title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onBlur={() => rename(c.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') rename(c.id); else if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null); } }} />
                    ) : (
                      <button type="button" className="pw-chat-open claude-chat-row-title" onClick={() => selectChat(c.id)}>
                        <span className="pw-chat-title" dir="auto">{c.title}</span>
                        <span className="pw-chat-snippet" dir="auto">{chatPreview(c.messages.at(-1)?.text, c.title)}</span>
                        <span className="pw-chat-time">{relTime(c.updatedAt)}</span>
                      </button>
                    )}
                    <ScreenActions label={`Options for ${c.title}`} actions={[
                      { label: 'Rename', run: () => { setNewTitle(c.title); setRenaming(c.id); } },
                      { label: 'Move out of project', run: () => { moveChatToProject(c.id, null); toast('Moved out of the project', 'info'); } },
                      { label: 'Delete chat…', destructive: true, run: () => { if (confirm(`Delete "${c.title}"?`)) void deleteChat(c.id); } },
                    ]} />
                  </li>
                ))}
              </ul>
            )}
        </section>
      </div>

      {preview && (
        <Modal title={preview.name} onClose={() => setPreview(null)}>
          <div className="project-doc-preview-modal">
            <p className="muted small">{preview.text.length.toLocaleString()} characters</p>
            <pre className="project-doc-preview-body">{preview.text}</pre>
          </div>
        </Modal>
      )}
    </div>
  );
}
