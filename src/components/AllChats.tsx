import { useMemo, useRef, useState } from 'react';
import { exitGhost, useFlip } from '../lib/motion';
import { Download, FolderKanban, Search, Trash2 } from 'lucide-react';
import Modal from './Modal';
import { useStore } from '../store';
import { isTemporaryChat } from '../lib/temporary-chat';
import { chatExportName, chatToMarkdown } from '../lib/chat-export';
import { saveBlob, safeFileName } from '../lib/util';
import type { Project } from '../types';

const NO_PROJECTS: Project[] = [];

/** Sidebar → View all: every chat in one list, to select several and delete, move or export them. */
export default function AllChats({ onClose }: { onClose: () => void }) {
  const chats = useStore((s) => s.chats);
  const projects = useStore((s) => s.settings.projects) || NO_PROJECTS;
  const { selectChat, deleteChat, moveChatToProject, toast, setUi } = useStore.getState();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chats
      .filter((c) => !isTemporaryChat(c) && (c.messages.length > 0 || Boolean(c.documents?.length)))
      .filter((c) => !q || c.title.toLowerCase().includes(q) || c.tags?.some((t) => t.toLowerCase().includes(q)))
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt);
  }, [chats, query]);
  const picked = chats.filter((c) => selected.has(c.id));
  const n = picked.length;
  const allShown = list.length > 0 && list.every((c) => selected.has(c.id));
  const toggle = (id: string) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const projectName = (id?: string) => projects.find((p) => p.id === id)?.name;
  const plural = (k: number) => `${k} chat${k === 1 ? '' : 's'}`;

  const listRef = useRef<HTMLUListElement>(null);
  useFlip(listRef, list.map((c) => c.id).join(','), !query);
  const remove = async () => {
    // Deleted rows slide out while the rest close the gap.
    listRef.current?.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => { if (selected.has(el.dataset.flip!)) exitGhost(el, 'row'); });
    for (const chat of picked) await deleteChat(chat.id);
    toast(`Deleted ${plural(n)}`);
    setSelected(new Set()); setConfirming(false);
  };
  const move = (projectId: string | null) => {
    picked.forEach((c) => moveChatToProject(c.id, projectId));
    toast(`Moved ${plural(n)} to ${projectId ? projectName(projectId) : 'All chats'}`);
    setSelected(new Set()); setMoving(false);
  };
  const exportAll = async () => {
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip(), used = new Set<string>();
      for (const chat of picked) {
        let name = chatExportName(chat, 'md');
        for (let i = 2; used.has(name.toLowerCase()); i++) name = `${safeFileName(chat.title, 'Chat')} (${i}).md`;
        used.add(name.toLowerCase());
        zip.file(name, chatToMarkdown(chat));
      }
      await saveBlob(await zip.generateAsync({ type: 'blob' }), `Lumen chats (${n}).zip`);
    } catch (e) { toast(`Couldn't export: ${(e as Error).message}`, 'error'); }
  };

  return (
    <Modal title="All chats" onClose={onClose}>
      <div className="all-chats">
        <div className="list-toolbar">
          <label className="search"><Search size={16} /><input type="search" aria-label="Search all chats" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} dir="auto" /></label>
        </div>
        <div className="all-chats-head">
          <label className="all-chats-check">
            <input type="checkbox" checked={allShown} disabled={!list.length} onChange={() => setSelected(allShown ? new Set() : new Set(list.map((c) => c.id)))} aria-label="Select all chats" />
            <span>{n ? `${n} selected` : `${plural(list.length)}`}</span>
          </label>
        </div>
        {list.length ? (
          <ul className="all-chats-list" ref={listRef}>
            {list.map((c) => (
              <li key={c.id} data-flip={c.id} className={selected.has(c.id) ? 'checked' : ''}>
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Select ${c.title}`} />
                <button type="button" className="all-chats-open" onClick={() => { selectChat(c.id); setUi({ sidebarOpen: false }); onClose(); }} dir="auto">
                  <span className="all-chats-title">{c.title}</span>
                  <small>{[c.pinned ? 'Pinned' : '', projectName(c.projectId) || '', new Date(c.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: new Date(c.updatedAt).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })].filter(Boolean).join(' · ')}</small>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="muted small empty-list">{query ? 'No chats match.' : 'No saved chats yet.'}</p>}
        {moving && n > 0 && (
          <div className="bulk-move" role="menu" aria-label="Move to project">
            <button role="menuitem" onClick={() => move(null)}>All chats · no project</button>
            {projects.map((p) => <button key={p.id} role="menuitem" onClick={() => move(p.id)}><span className={`sidebar-project-dot color-${p.color || 'indigo'}`} aria-hidden="true" />{p.name}</button>)}
          </div>
        )}
        {confirming && n > 0 ? (
          <div className="all-chats-confirm" role="alert">
            <span>Delete {plural(n)}? This can’t be undone.</span>
            <div className="all-chats-actions"><button type="button" className="btn small" onClick={() => setConfirming(false)}>Cancel</button><button type="button" className="btn small danger-fill" onClick={() => void remove()}><Trash2 size={15} /> Delete</button></div>
          </div>
        ) : (
          <div className="all-chats-actions">
            <button type="button" className="btn small" disabled={!n || !projects.length} aria-expanded={moving} title={projects.length ? undefined : 'Create a project first'} onClick={() => setMoving(!moving)}><FolderKanban size={15} /> Move</button>
            <button type="button" className="btn small" disabled={!n} onClick={() => void exportAll()}><Download size={15} /> Export</button>
            <button type="button" className="btn small danger" disabled={!n} onClick={() => { setMoving(false); setConfirming(true); }}><Trash2 size={15} /> Delete</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
