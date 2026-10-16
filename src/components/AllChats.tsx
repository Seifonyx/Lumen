import { useEffect, useMemo, useRef, useState } from 'react';
import { installSwipeRows } from '../lib/swipe-row';
import { exitGhost, useFlip } from '../lib/motion';
import { Archive, ArchiveRestore, Download, FolderKanban, Pin, PinOff, Search, Trash2 } from 'lucide-react';
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
  const [showArchived, setShowArchived] = useState(false);
  // iPhone glass look: like Mail or Notes, rows are plain until you tap Select; then each gets a round check and
  // the actions appear in a bar at the bottom.
  const [glassPhone] = useState(() => document.documentElement.classList.contains('glass') && window.matchMedia('(max-width: 899px)').matches);
  const [selectMode, setSelectMode] = useState(false);
  const picking = !glassPhone || selectMode;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chats
      .filter((c) => !isTemporaryChat(c) && (c.messages.length > 0 || Boolean(c.documents?.length)) && Boolean(c.archived) === showArchived)
      .filter((c) => !q || c.title.toLowerCase().includes(q) || c.tags?.some((t) => t.toLowerCase().includes(q)) || c.messages.some((m) => m.text.toLowerCase().includes(q)))
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt);
  }, [chats, query, showArchived]);
  const archivedCount = useMemo(() => chats.filter((c) => c.archived && !isTemporaryChat(c)).length, [chats]);
  const archive = () => {
    picked.forEach((c) => void useStore.getState().setArchived(c.id, !showArchived));
    toast(showArchived ? `Moved ${plural(n)} back` : `Archived ${plural(n)}`);
    setSelected(new Set());
  };
  const picked = chats.filter((c) => selected.has(c.id));
  const n = picked.length;
  const allShown = list.length > 0 && list.every((c) => selected.has(c.id));
  const toggle = (id: string) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const projectName = (id?: string) => projects.find((p) => p.id === id)?.name;
  const plural = (k: number) => `${k} chat${k === 1 ? '' : 's'}`;

  const listRef = useRef<HTMLUListElement>(null);
  useFlip(listRef, list.map((c) => c.id).join(','), !query);
  // Phones: swipe a row left to delete (with Undo), right to pin.
  const deleteOne = (id: string, row?: HTMLElement | null) => {
    const chat = useStore.getState().chats.find((c) => c.id === id);
    if (!chat) return;
    if (row) exitGhost(row, 'row');
    void deleteChat(id);
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
    toast('Chat deleted', 'info', { label: 'Undo', run: () => void useStore.getState().importChats([chat]) });
  };
  const swipe = useRef({ deleteOne, togglePin: useStore.getState().togglePin });
  swipe.current.deleteOne = deleteOne;
  const hasList = list.length > 0;
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    return installSwipeRows(el, { onDelete: (id, row) => swipe.current.deleteOne(id, row), onPin: (id) => void swipe.current.togglePin(id) });
  }, [hasList]);
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
    <Modal title="All chats" onClose={onClose}
      actions={glassPhone && list.length > 0 && <button type="button" className="btn ghost small all-chats-select" onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); setMoving(false); setConfirming(false); }}>{selectMode ? 'Done' : 'Select'}</button>}>
      <div className={`all-chats${picking ? '' : ' browsing'}`}>
        <div className="list-toolbar">
          <label className="search"><Search size={16} /><input type="search" aria-label="Search all chats" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} dir="auto" /></label>
          {(archivedCount > 0 || showArchived) && (
            <div className="all-chats-views" role="tablist" aria-label="Show">
              <button type="button" role="tab" aria-selected={!showArchived} onClick={() => { setShowArchived(false); setSelected(new Set()); }}>Chats</button>
              <button type="button" role="tab" aria-selected={showArchived} onClick={() => { setShowArchived(true); setSelected(new Set()); }}>Archived{archivedCount ? ` · ${archivedCount}` : ''}</button>
            </div>
          )}
        </div>
        {picking && <div className="all-chats-head">
          <label className="all-chats-check">
            <input type="checkbox" checked={allShown} disabled={!list.length} onChange={() => setSelected(allShown ? new Set() : new Set(list.map((c) => c.id)))} aria-label="Select all chats" />
            <span>{n ? `${n} selected` : glassPhone ? 'Select all' : `${plural(list.length)}`}</span>
          </label>
        </div>}
        {list.length ? (
          <ul className="all-chats-list" ref={listRef}>
            {list.map((c) => (
              <li key={c.id} data-flip={c.id} className={`swipe-row${selected.has(c.id) ? ' checked' : ''}`}>
                <div className="row-actions" aria-hidden="true">
                  <span className="swipe-pin">{c.pinned ? <PinOff size={18} /> : <Pin size={18} />}{c.pinned ? 'Unpin' : 'Pin'}</span>
                  <button type="button" className="swipe-delete" tabIndex={-1} onClick={(e) => deleteOne(c.id, e.currentTarget.closest('li'))}><Trash2 size={18} />Delete</button>
                </div>
                <div className="swipe-face">
                  {picking && <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Select ${c.title}`} />}
                  <button type="button" className="all-chats-open" onClick={() => { if (glassPhone && selectMode) { toggle(c.id); return; } selectChat(c.id); setUi({ sidebarOpen: false }); onClose(); }} dir="auto">
                    <span className="all-chats-title">{c.title}</span>
                    <small>{[c.pinned ? 'Pinned' : '', projectName(c.projectId) || '', new Date(c.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: new Date(c.updatedAt).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })].filter(Boolean).join(' · ')}</small>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="muted small empty-list">{query ? 'No chats match.' : showArchived ? 'No archived chats.' : 'No saved chats yet.'}</p>}
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
        ) : picking && (
          <div className="all-chats-actions">
            <button type="button" className="btn small" disabled={!n || !projects.length} aria-expanded={moving} title={projects.length ? undefined : 'Create a project first'} onClick={() => setMoving(!moving)}><FolderKanban size={15} /> Move</button>
            <button type="button" className="btn small" disabled={!n} onClick={archive}>{showArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />} {showArchived ? 'Unarchive' : 'Archive'}</button>
            <button type="button" className="btn small" disabled={!n} onClick={() => void exportAll()}><Download size={15} /> Export</button>
            <button type="button" className="btn small danger" disabled={!n} onClick={() => { setMoving(false); setConfirming(true); }}><Trash2 size={15} /> Delete</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
