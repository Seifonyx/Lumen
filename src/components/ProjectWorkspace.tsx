import { useRef, useState } from 'react';
import { ArrowUp, ChevronDown, ExternalLink, Eye, FileCode, FileSpreadsheet, FileText, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { modelLabel, useStore } from '../store';
import { readAttachment } from '../lib/files/read';
import { formatBytes } from '../lib/util';
import type { Attachment, Project } from '../types';
import Modal from './Modal';

const MAX_FILES = 5;
const FILE_TYPES = '.pdf,.docx,.xlsx,.xlsm,.pptx,.txt,.md,.csv,.tsv,.json,.html,.xml,.js,.ts,.py,.css,.sql,.log,.yaml,.yml,.srt,.tex';

const ago = (ts: number) => {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const fileIcon = (name: string) => (/\.(xlsx|xlsm|csv|tsv)$/i.test(name) ? FileSpreadsheet : /\.(js|ts|tsx|jsx|py|html|css|json|sql|ya?ml)$/i.test(name) ? FileCode : FileText);

/** A project's page: what it is, a box to start a chat in it, its chats, and the context every chat gets. */
export default function ProjectWorkspace({ project, onOpenSettings }: { project: Project; onOpenSettings?: () => void }) {
  const chats = useStore((s) => s.chats);
  const catalog = useStore((s) => s.catalog);
  const { saveProject, selectChat, newChat, deleteChat, renameChat, moveChatToProject, send, toast } = useStore.getState();

  const [prompt, setPrompt] = useState('');
  const [contextOpen, setContextOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<{ name: string; text: string } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const files = project.files || [];
  const color = project.color || 'indigo';

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
    const text = prompt.trim();
    if (!text) return;
    newChat();
    void send(text, []);
  };

  const projectChats = chats.filter((c) => c.projectId === project.id).sort((a, b) => b.updatedAt - a.updatedAt);
  const q = query.trim().toLowerCase();
  const shown = q ? projectChats.filter((c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.text.toLowerCase().includes(q))) : projectChats;
  const instructions = project.instructions?.trim() || '';

  return (
    <div className="project-page claude-project-view">
      <header className="project-head">
        <span className={`project-tile color-${color}`} aria-hidden="true">{project.name.slice(0, 1).toUpperCase()}</span>
        <div className="project-head-text">
          <h1 className="project-title claude-project-title">{project.name}</h1>
          {project.description && <p className="project-desc">{project.description}</p>}
        </div>
        <button type="button" className="btn small project-edit-btn" onClick={onOpenSettings}>
          <Pencil size={14} /> Edit
        </button>
      </header>

      <form className="project-composer" onSubmit={(e) => { e.preventDefault(); start(); }}>
        <textarea
          aria-label="Start a project conversation"
          rows={2}
          dir="auto"
          value={prompt}
          placeholder={`Start a chat in ${project.name}`}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) {
              e.preventDefault();
              start();
            }
          }}
        />
        <div className="project-composer-foot">
          <span className="project-composer-note">
            <span className="route-dot" aria-hidden="true" />
            {[instructions && 'Instructions', files.length && `${files.length} file${files.length === 1 ? '' : 's'}`, project.defaultModel && modelLabel(catalog, project.defaultModel)].filter(Boolean).join(' · ') || 'Every chat here shares this project’s context'}
          </span>
          <button type="submit" className="send-btn project-send" disabled={!prompt.trim()} aria-label="Send message (Enter)" title="Send (Enter)">
            <ArrowUp size={18} />
          </button>
        </div>
      </form>

      <div className="project-grid">
        <section className="project-chats" aria-label="Chats in this project">
          <div className="project-section-head">
            <h2>Chats <span className="project-count">{projectChats.length}</span></h2>
            {projectChats.length > 5 && (
              <label className="search project-search">
                <Search size={14} />
                <input type="search" aria-label="Search project conversations" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
            )}
          </div>
          {projectChats.length === 0 ? (
            <p className="project-empty">No chats yet. Start one above; it will use this project’s instructions and files.</p>
          ) : shown.length === 0 ? (
            <p className="project-empty">No chats match “{query}”.</p>
          ) : (
            <ul className="project-chat-list">
              {shown.map((c) => {
                const last = c.messages.at(-1);
                return (
                  <li key={c.id} className="project-chat">
                    <div className="project-chat-main">
                      {renaming === c.id ? (
                        <input
                          autoFocus
                          className="project-rename"
                          aria-label="Chat title"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          onBlur={() => { if (newTitle.trim()) void renameChat(c.id, newTitle.trim()); setRenaming(null); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { if (newTitle.trim()) void renameChat(c.id, newTitle.trim()); setRenaming(null); }
                            else if (e.key === 'Escape') setRenaming(null);
                          }}
                        />
                      ) : (
                        <button type="button" className="project-chat-title claude-chat-row-title" title={c.title} onClick={() => selectChat(c.id)}>{c.title}</button>
                      )}
                      <p className="project-chat-snippet" dir="auto">{last?.text?.replace(/\s+/g, ' ').slice(0, 120) || 'Empty chat'}</p>
                    </div>
                    <span className="project-chat-time">{ago(c.updatedAt)}</span>
                    <div className="project-chat-menu">
                      <button type="button" className="icon-btn xs" aria-label={`Options for ${c.title}`} aria-haspopup="menu" aria-expanded={menu === c.id} onClick={() => setMenu(menu === c.id ? null : c.id)}>
                        <MoreHorizontal size={15} />
                      </button>
                      {menu === c.id && (
                        <div className="menu" role="menu" onKeyDown={(e) => {
                          if (e.key === 'Escape') { e.stopPropagation(); setMenu(null); }
                          if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
                          e.preventDefault();
                          const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
                          const i = items.indexOf(document.activeElement as HTMLButtonElement);
                          items[(i + (e.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length]?.focus();
                        }}>
                          <button type="button" role="menuitem" onClick={() => { setMenu(null); setNewTitle(c.title); setRenaming(c.id); }}><Pencil size={13} /> Rename</button>
                          <button type="button" role="menuitem" onClick={() => { setMenu(null); moveChatToProject(c.id, null); toast('Moved out of the project', 'info'); }}><ExternalLink size={13} /> Move out of project</button>
                          <button type="button" role="menuitem" className="danger" onClick={() => { setMenu(null); if (confirm(`Delete "${c.title}"?`)) void deleteChat(c.id); }}><Trash2 size={13} /> Delete</button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className={`project-context${contextOpen ? ' context-open' : ''}`} aria-label="Project context">
          <button type="button" className="project-context-toggle" aria-expanded={contextOpen} aria-controls="project-context-content" onClick={() => setContextOpen(!contextOpen)}>
            <span>Context <small>{files.length} file{files.length === 1 ? '' : 's'} · {instructions ? 'instructions on' : 'no instructions'}</small></span>
            <ChevronDown size={18} />
          </button>
          <div id="project-context-content" className="project-context-content">
            <section className="project-card">
              <div className="project-card-head">
                <h3>Instructions</h3>
                <button type="button" className="btn ghost small" onClick={onOpenSettings} aria-label="Edit project instructions">{instructions ? 'Edit' : 'Add'}</button>
              </div>
              {instructions ? <p className="project-instructions" dir="auto">{instructions}</p> : <p className="project-empty">Tell models how to work in this project: tone, language, what to focus on.</p>}
            </section>

            <section className="project-card">
              <div className="project-card-head">
                <h3>Files <span className="project-count">{files.length}/{MAX_FILES}</span></h3>
                <button type="button" className="btn ghost small" disabled={files.length >= MAX_FILES || uploading} onClick={() => fileInput.current?.click()}>
                  <Plus size={14} /> Add
                </button>
              </div>
              <input ref={fileInput} type="file" multiple hidden accept={FILE_TYPES} onChange={(e) => { void addFiles([...(e.target.files || [])]); e.target.value = ''; }} />
              {files.length === 0 ? (
                <button type="button" className="project-drop" onClick={() => fileInput.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void addFiles([...(e.dataTransfer.files || [])]); }}>
                  Add PDFs, Word, Excel or text files. Every chat here can use them.
                </button>
              ) : (
                <ul className="project-files">
                  {files.map((f) => {
                    const Icon = fileIcon(f.name);
                    return (
                      <li key={f.id} className="project-file-row">
                        <Icon size={16} className="project-file-icon" />
                        <span className="project-file-name" title={f.name}>{f.name}</span>
                        <span className="project-file-size">{formatBytes(f.size || f.text?.length || 0)}</span>
                        {f.text && <button type="button" className="icon-btn xs" aria-label={`Preview ${f.name}`} title="Preview text" onClick={() => setPreview({ name: f.name, text: f.text || '' })}><Eye size={14} /></button>}
                        <button type="button" className="icon-btn xs" aria-label={`Remove ${f.name}`} title="Remove" onClick={() => saveFiles(files.filter((x) => x.id !== f.id))}><Trash2 size={14} /></button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </aside>
      </div>

      {preview && (
        <Modal title={preview.name} onClose={() => setPreview(null)}>
          <div className="project-doc-preview-modal">
            <p className="muted small">The text models get from this file ({preview.text.length.toLocaleString()} characters).</p>
            <pre className="project-doc-preview-body">{preview.text}</pre>
          </div>
        </Modal>
      )}
    </div>
  );
}
