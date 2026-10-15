// Documents: everything you've written in the canvas, across chats, as pages you can see at a glance.
import { Download, FileText, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { isTemporaryChat } from '../lib/temporary-chat';
import { saveBlob, safeFileName } from '../lib/util';
import { useStore } from '../store';
import HubPage, { HubEmpty, relTime } from './HubPage';

type Sort = 'recent' | 'name';

/** A few lines of the document, Markdown marks removed, for the page preview. */
const preview = (text: string) => text.split('\n').map((l) => l.replace(/^#{1,6}\s+/, '').replace(/[*_`>]/g, '').replace(/^\s*[-+]\s+/, '• ')).filter((l, i, a) => l.trim() || (i > 0 && a[i - 1].trim())).slice(0, 14);
const heading = (text: string) => /^#{1,3}\s+/.test(text.trimStart());

export default function DocumentsPage({ onClose }: { onClose: () => void }) {
  const chats = useStore((s) => s.chats);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [menu, setMenu] = useState<string | null>(null);
  const docs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = chats.filter((c) => !isTemporaryChat(c)).flatMap((c) => (c.documents || []).map((doc) => ({ doc, chat: c })));
    return all
      .filter(({ doc, chat }) => !q || doc.name.toLowerCase().includes(q) || chat.title.toLowerCase().includes(q) || doc.content.toLowerCase().includes(q))
      .sort((a, b) => (sort === 'name' ? a.doc.name.localeCompare(b.doc.name) : b.doc.updatedAt - a.doc.updatedAt));
  }, [chats, query, sort]);
  const total = useMemo(() => chats.reduce((n, c) => n + (isTemporaryChat(c) ? 0 : c.documents?.length || 0), 0), [chats]);
  const open = (chatId: string, docId: string) => { useStore.getState().selectChat(chatId); useStore.getState().setUi({ canvasOpen: true, canvasDocumentId: docId }); };
  const newDoc = () => { useStore.getState().newChat(); setTimeout(() => useStore.getState().openCanvas(), 0); };

  return (
    <HubPage label="Documents" title="Documents" subtitle="Everything you've written in the canvas, from all your chats." onClose={onClose}
      actions={<button type="button" className="btn primary" onClick={newDoc}><Plus size={16} /> New document</button>}
      toolbar={total > 0 && (
        <>
          <label className="hub-search"><Search size={16} /><input type="search" aria-label="Search documents" placeholder="Search documents" value={query} onChange={(e) => setQuery(e.target.value)} dir="auto" /></label>
          <div className="hub-seg" role="radiogroup" aria-label="Sort">
            {([['recent', 'Recent'], ['name', 'Name']] as const).map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={sort === v} onClick={() => setSort(v)}>{l}</button>)}
          </div>
        </>
      )}>
      {total === 0 ? (
        <HubEmpty icon={<FileText size={26} />} title="No documents yet" text="Write in the canvas from any chat (+ → Document canvas, or “Edit in canvas” on a reply) and your documents collect here." action={<button type="button" className="btn primary" onClick={newDoc}><Plus size={16} /> New document</button>} />
      ) : docs.length === 0 ? (
        <p className="hub-none">No documents match “{query}”.</p>
      ) : (
        <ul className="doc-grid">
          {docs.map(({ doc, chat }) => {
            const key = `${chat.id}-${doc.id}`;
            const lines = preview(doc.content);
            return (
              <li key={key} className="doc-card">
                <button type="button" className="doc-open" onClick={() => open(chat.id, doc.id)} aria-label={`Open ${doc.name}`}>
                  <span className="doc-paper" aria-hidden="true">
                    {lines.length ? lines.map((l, i) => <span key={i} className={i === 0 && heading(doc.content) ? 'doc-paper-h' : ''} dir="auto">{l || ' '}</span>) : <span className="doc-paper-blank">Empty</span>}
                  </span>
                  <span className="doc-meta">
                    <span className="doc-name" dir="auto">{doc.name.replace(/\.md$/i, '')}</span>
                    <span className="doc-sub" dir="auto">{chat.title} · {relTime(doc.updatedAt)}</span>
                  </span>
                </button>
                <div className="doc-more">
                  <button type="button" className="icon-btn sm" aria-label={`More for ${doc.name}`} aria-haspopup="menu" aria-expanded={menu === key} onClick={() => setMenu(menu === key ? null : key)}><MoreHorizontal size={16} /></button>
                  {menu === key && (
                    <div className="menu doc-menu" role="menu" onMouseLeave={() => setMenu(null)}>
                      <button type="button" role="menuitem" onClick={() => { setMenu(null); void saveBlob(new Blob([doc.content], { type: 'text/markdown' }), `${safeFileName(doc.name.replace(/\.md$/i, ''), 'Document')}.md`); }}><Download size={15} /> Download</button>
                      <button type="button" role="menuitem" className="danger" onClick={() => { setMenu(null); if (confirm(`Delete “${doc.name}”?`)) void useStore.getState().deleteCanvasDocument(chat.id, doc.id); }}><Trash2 size={15} /> Delete</button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </HubPage>
  );
}
