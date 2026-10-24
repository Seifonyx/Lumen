import { usePhoneLayout } from '../lib/phone-layout';
import { CANVAS_SHELL, navigateScreen, CanvasLibraryActions, useScreenMemory, CanvasFilterMenu, CanvasPhoneSections } from '../lib/canvas-presentation';
// Collection: everything you've added or made, from every chat: photos, files you attached, documents you wrote
// in the canvas, images Lumen created, and files you uploaded for Lumen to search. Projects are the folders:
// filter by one, or move an item's chat into one.
import { Download, FileText, FolderKanban, Image as ImageIcon, MoreHorizontal, Plus, Search, Sparkles, Trash2, FileSearch, Paperclip, LayoutGrid } from 'lucide-react';
import { Suspense, useId, useMemo, useState } from 'react';
import { isTemporaryChat } from '../lib/temporary-chat';
import { saveBlob, safeFileName } from '../lib/util';
import { useStore } from '../store';
import type { Attachment, CanvasDocument, Chat, Project } from '../types';
import HubPage, { HubEmpty, relTime } from './HubPage';
import KnowledgeLibrary from './KnowledgeLibrary';
import { openImage } from './ImageViewer';

export type CollectionKind = 'all' | 'photos' | 'documents' | 'files' | 'generated' | 'searchable';
export type Item =
  | { kind: 'photos' | 'generated' | 'files'; key: string; chat: Chat; file: Attachment; at: number }
  | { kind: 'documents'; key: string; chat: Chat; doc: CanvasDocument; at: number };

const NO_PROJECTS: Project[] = [];
/** A few lines of a document, Markdown marks removed, for its page preview. */
const preview = (text: string) => text.split('\n').map((l) => l.replace(/^#{1,6}\s+/, '').replace(/[*_`>]/g, '').replace(/^\s*[-+]\s+/, '• ')).filter((l, i, a) => l.trim() || (i > 0 && a[i - 1].trim())).slice(0, 14);
const heading = (text: string) => /^#{1,3}\s+/.test(text.trimStart());
const imageSrc = (f: Attachment) => (f.data ? `data:${f.mime || 'image/jpeg'};base64,${f.data}` : f.thumb || '');
const ext = (name: string) => (/\.([a-z0-9]{1,5})$/i.exec(name)?.[1] || 'file').toUpperCase();

export default function CollectionPage({ onClose, initial = 'all' }: { onClose: () => void; initial?: CollectionKind }) {
  const phone = CANVAS_SHELL ? usePhoneLayout() : false;
  const panelId = CANVAS_SHELL ? useId() : undefined;
  const chats = useStore((s) => s.chats);
  const projects = useStore((s) => s.settings.projects) || NO_PROJECTS;
  const [kind, setKind] = CANVAS_SHELL ? useScreenMemory!<CollectionKind>('library-kind', initial, initial !== 'all') : useState<CollectionKind>(initial);
  const [project, setProject] = CANVAS_SHELL ? useScreenMemory!<string>('library-project', '') : useState('');
  const [query, setQuery] = CANVAS_SHELL ? useScreenMemory!<string>('library-query', '') : useState('');
  const [menu, setMenu] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  const items = useMemo(() => {
    const out: Item[] = [];
    for (const chat of chats) {
      if (isTemporaryChat(chat)) continue;
      for (const doc of chat.documents || []) out.push({ kind: 'documents', key: `d-${chat.id}-${doc.id}`, chat, doc, at: doc.updatedAt });
      for (const m of chat.messages) for (const file of m.files || []) {
        if (file.auto || file.videoUri) continue;
        const k = file.kind === 'image' ? (m.role === 'assistant' ? 'generated' : 'photos') : 'files';
        out.push({ kind: k, key: `f-${chat.id}-${m.id}-${file.id}`, chat, file, at: m.createdAt });
      }
    }
    return out.sort((a, b) => b.at - a.at);
  }, [chats]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const i of items) c[i.kind] = (c[i.kind] || 0) + 1;
    return c;
  }, [items]);
  const q = query.trim().toLowerCase();
  const shown = items.filter((i) => (kind === 'all' || i.kind === kind) && (!project || i.chat.projectId === project) && (!q || (i.kind === 'documents' ? `${i.doc.name} ${i.doc.content}` : i.file.name).toLowerCase().includes(q) || i.chat.title.toLowerCase().includes(q)));

  const openChat = (chatId: string) => useStore.getState().selectChat(chatId);
  const open = (i: Item, from?: Element | null) => {
    if (i.kind === 'documents') { if (CANVAS_SHELL) navigateScreen!(() => { openChat(i.chat.id); useStore.getState().setUi({ canvasOpen: true, canvasDocumentId: i.doc.id }); }); else { openChat(i.chat.id); useStore.getState().setUi({ canvasOpen: true, canvasDocumentId: i.doc.id }); } }
    else if ((i.kind === 'photos' || i.kind === 'generated') && imageSrc(i.file)) openImage({ src: imageSrc(i.file), alt: i.file.name, name: i.file.name, from: from as HTMLElement | null });
    else openChat(i.chat.id);
  };
  const newDoc = () => { useStore.getState().newChat(); setTimeout(() => useStore.getState().openCanvas(), 0); };
  const FILTERS: { id: CollectionKind; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'Everything', icon: <LayoutGrid size={15} /> },
    { id: 'photos', label: 'Photos', icon: <ImageIcon size={15} /> },
    { id: 'documents', label: 'Documents', icon: <FileText size={15} /> },
    { id: 'files', label: 'Attached files', icon: <Paperclip size={15} /> },
    { id: 'generated', label: 'Made by Lumen', icon: <Sparkles size={15} /> },
    { id: 'searchable', label: 'Searchable', icon: <FileSearch size={15} /> },
  ];
  const projectName = (id?: string) => projects.find((p) => p.id === id)?.name;
  // iPhone glass look: the filters are the bottom tab bar (short names so six fit), not chips at the top.
  const [glassPhone] = useState(() => document.documentElement.classList.contains('glass') && window.matchMedia('(max-width: 899px)').matches);
  const SHORT: Record<CollectionKind, string> = { all: 'All', photos: 'Photos', documents: 'Docs', files: 'Files', generated: 'Made', searchable: 'Search' };
  const BIG: Record<CollectionKind, React.ReactNode> = { all: <LayoutGrid size={22} />, photos: <ImageIcon size={22} />, documents: <FileText size={22} />, files: <Paperclip size={22} />, generated: <Sparkles size={22} />, searchable: <FileSearch size={22} /> };
  // What "new" means in each tab (the + at the top left, and the button under an empty tab).
  const inNewChat = (mode: 'attach' | 'image') => { useStore.getState().setUi({ page: null }); useStore.getState().newChat(); setTimeout(() => window.dispatchEvent(new CustomEvent('mr:composer-mode', { detail: mode })), 80); };
  const CREATE: Record<CollectionKind, { label: string; run: () => void }> = {
    all: { label: 'New document', run: newDoc },
    documents: { label: 'New document', run: newDoc },
    photos: { label: 'Add photos', run: () => inNewChat('attach') },
    // (Files you upload for Lumen to search live here, under your attached files; attach to a chat from its +.)
    files: { label: 'Upload a file', run: () => document.querySelector<HTMLInputElement>('.files-uploads input[type="file"]')?.click() },
    generated: { label: 'Create an image', run: () => inNewChat('image') },
    searchable: { label: 'Upload a file to search', run: () => document.querySelector<HTMLInputElement>('.files-uploads input[type="file"]')?.click() },
  };
  const EMPTY: Record<CollectionKind, string> = {
    all: 'Photos and files you attach, documents you write in the canvas and images Lumen makes all collect here.',
    photos: 'Photos you add to your chats show up here.',
    documents: 'Documents you write in the canvas show up here.',
    files: 'Files you attach to your chats show up here.',
    generated: 'Images Lumen creates for you show up here.',
    searchable: 'Files you upload for Lumen to search show up here.',
  };
  const bar = (CANVAS_SHELL || glassPhone) ? { label: 'Show', active: kind, onSelect: (id: string) => { setKind(id as CollectionKind); setQuery(''); }, create: CREATE[kind], items: FILTERS.filter((f) => f.id !== 'searchable').map((f) => ({ id: f.id, label: SHORT[f.id], icon: BIG[f.id] })) } : undefined;
  // (On iPhone the Files tab also lists the files uploaded for search, so it's never shown as empty.)
  const emptyHere = kind !== 'all' && kind !== 'searchable' && !(glassPhone && kind === 'files') && !items.some((i) => i.kind === kind);

  const More = ({ i }: { i: Item }) => (
    <div className="doc-more">
      <button type="button" className="icon-btn sm" aria-label={`More for ${i.kind === 'documents' ? i.doc.name : i.file.name}`} aria-haspopup="menu" aria-expanded={menu === i.key} onClick={(e) => { e.stopPropagation(); setMenu(menu === i.key ? null : i.key); setMoving(null); }}><MoreHorizontal size={16} /></button>
      {menu === i.key && (
        <div className="menu doc-menu" role="menu" onMouseLeave={() => { setMenu(null); setMoving(null); }}>
          <button type="button" role="menuitem" onClick={() => { setMenu(null); openChat(i.chat.id); }}>Open its chat</button>
          {i.kind === 'documents' && <button type="button" role="menuitem" onClick={() => { setMenu(null); void saveBlob(new Blob([i.doc.content], { type: 'text/markdown' }), `${safeFileName(i.doc.name.replace(/\.md$/i, ''), 'Document')}.md`); }}><Download size={15} /> Download</button>}
          {projects.length > 0 && <button type="button" role="menuitem" aria-expanded={moving === i.key} onClick={() => setMoving(moving === i.key ? null : i.key)}><FolderKanban size={15} /> Move chat to project</button>}
          {moving === i.key && (
            <div className="doc-move">
              <button type="button" role="menuitem" onClick={() => { useStore.getState().moveChatToProject(i.chat.id, null); setMenu(null); }}>No project</button>
              {projects.map((p) => <button key={p.id} type="button" role="menuitem" aria-current={i.chat.projectId === p.id || undefined} onClick={() => { useStore.getState().moveChatToProject(i.chat.id, p.id); useStore.getState().toast(`Moved “${i.chat.title}” to ${p.name}`, 'success'); setMenu(null); }}>{p.name}</button>)}
            </div>
          )}
          {i.kind === 'documents' && <button type="button" role="menuitem" className="danger" onClick={() => { setMenu(null); if (confirm(`Delete “${i.doc.name}”?`)) void useStore.getState().deleteCanvasDocument(i.chat.id, i.doc.id); }}><Trash2 size={15} /> Delete</button>}
        </div>
      )}
    </div>
  );

  const sub = (i: Item) => [projectName(i.chat.projectId), i.chat.title, relTime(i.at)].filter(Boolean).join(' · ');

  const librarySearch = CANVAS_SHELL && <label className="hub-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search your library" placeholder={kind === 'searchable' ? 'Find searchable files' : `Search ${kind === 'all' ? 'your library' : FILTERS.find(f => f.id === kind)?.label.toLowerCase()}`} value={query} onChange={e => setQuery(e.target.value)} dir="auto" />{query && <button type="button" aria-label="Clear library search" onClick={e => { setQuery(''); e.currentTarget.parentElement?.querySelector('input')?.focus(); }}>×</button>}</label>;
  const phoneLabels: Record<CollectionKind, string> = { all:'Everything', documents:'Documents', photos:'Photos', files:'Files', generated:'Generated images', searchable:'Searchable' };
  const phoneKinds: CollectionKind[] = ['all','documents','photos','files','generated','searchable'];
  const panel = (content: React.ReactNode) => CANVAS_SHELL && phone ? <div id={panelId} role="tabpanel" aria-labelledby={`${panelId}-${kind}`}>{content}</div> : content;

  return (
    <HubPage label="Library" title="Library" subtitle="Your files, photos and documents from every chat. Find actions and assistants in Tools." onClose={onClose} bar={bar}
      sectionNavigation={CANVAS_SHELL && CanvasPhoneSections && <Suspense fallback={null}><CanvasPhoneSections label="Library content types" panelId={panelId} active={kind} items={phoneKinds.map(id => ({ id, label:phoneLabels[id] }))} onSelect={id => setKind(id as CollectionKind)} /></Suspense>}
      footer={CANVAS_SHELL && <footer className="phone-page-search" aria-label="Library search">{librarySearch}</footer>}
      actions={<button type="button" className="btn primary" onClick={newDoc}><Plus size={16} /> New document</button>}>
      {CANVAS_SHELL && phone ? null : CANVAS_SHELL && CanvasFilterMenu ? <CanvasFilterMenu label="Content type" value={kind} options={FILTERS.map(f => ({ value: f.id, label: f.label, count: counts[f.id] }))} onChange={setKind} /> : !glassPhone && <div className="coll-filters" role="radiogroup" aria-label="Show">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" role="radio" aria-checked={kind === f.id} className="coll-chip" onClick={() => setKind(f.id)}>
            {f.icon}{f.label}{f.id !== 'searchable' && counts[f.id] ? <span className="hub-count">{counts[f.id]}</span> : null}
          </button>
        ))}
      </div>}
      {panel(kind === 'searchable' ? (
        <div className="files-uploads"><p className="muted small coll-note">Files you’ve uploaded for Lumen to search. Replies quote them with page numbers.</p><KnowledgeLibrary onClose={onClose} filter={CANVAS_SHELL && phone ? query : undefined} /></div>
      ) : (
        <>
          {(CANVAS_SHELL || items.length > 0 || glassPhone) && (
            <div className="hub-toolbar">
              {CANVAS_SHELL ? !phone && librarySearch : <label className="hub-search"><Search size={16} /><input type="search" aria-label="Search your library" placeholder={glassPhone ? `Search ${FILTERS.find((f) => f.id === kind)?.label.toLowerCase()}` : 'Search names and documents'} value={query} onChange={(e) => setQuery(e.target.value)} dir="auto" /></label>}
              {projects.length > 0 && (
                <label className="coll-project"><FolderKanban size={15} /><select aria-label="Project" value={project} onChange={(e) => setProject(e.target.value)}><option value="">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              )}
            </div>
          )}
          {glassPhone && kind === 'files' && !shown.length ? null : (items.length === 0 && !(glassPhone && kind === 'files')) || (glassPhone && emptyHere && !q) ? (
            <HubEmpty icon={BIG[kind]} title="Nothing here yet" text={EMPTY[kind]} action={<button type="button" className="btn primary" onClick={CREATE[kind].run}><Plus size={16} /> {CREATE[kind].label}</button>} />
          ) : shown.length === 0 ? (
            <p className="hub-none">Nothing matches.</p>
          ) : (
            <ul className="coll-grid">
              {shown.map((i) => (
                <li key={i.key} className={`coll-item kind-${i.kind}`}>
                  <button type="button" className="doc-open" onClick={(e) => open(i, e.currentTarget.querySelector('img'))} aria-label={`Open ${i.kind === 'documents' ? i.doc.name : i.file.name}`}>
                    {i.kind === 'documents' ? (
                      CANVAS_SHELL ? <span className="coll-document-icon" aria-hidden="true"><FileText size={28} strokeWidth={1.4} /><span>DOC</span></span> : (<span className="doc-paper" aria-hidden="true">
                        {preview(i.doc.content).map((l, n) => <span key={n} className={n === 0 && heading(i.doc.content) ? 'doc-paper-h' : ''} dir="auto">{l || ' '}</span>)}
                      </span>)
                    ) : (i.kind === 'photos' || i.kind === 'generated') ? (
                      <span className="coll-photo">{imageSrc(i.file) ? <img src={i.file.thumb || imageSrc(i.file)} alt="" loading="lazy" /> : <span className="coll-away">On another device</span>}{i.kind === 'generated' && <span className="coll-badge"><Sparkles size={12} /> Made by Lumen</span>}</span>
                    ) : (
                      <span className="coll-file"><span className="coll-ext">{ext(i.file.name)}</span><FileText size={30} strokeWidth={1.4} /></span>
                    )}
                    <span className="doc-meta">
                      <span className="doc-name" dir="auto">{i.kind === 'documents' ? i.doc.name.replace(/\.md$/i, '') : i.file.name}</span>
                      <span className="doc-sub" dir="auto">{sub(i)}</span>
                    </span>
                  </button>
                  {CANVAS_SHELL && CanvasLibraryActions ? <Suspense fallback={null}><CanvasLibraryActions item={i} openChat={openChat} /></Suspense> : <More i={i} />}
                </li>
              ))}
            </ul>
          )}
          {glassPhone && kind === 'files' && (
            <section className="files-uploads coll-searchable" aria-label="Files Lumen can search">
              <h2 className="coll-section-title">Files Lumen can search</h2>
              <KnowledgeLibrary onClose={onClose} filter={query} />
            </section>
          )}
        </>
      ))}
    </HubPage>
  );
}
