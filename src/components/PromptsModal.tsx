// Prompts: reusable starting points for a message. Picking one puts it in the message box for you to finish;
// yours can be edited, and Lumen's copied and changed.
import { ChevronLeft, MessageSquareText, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { BUILTIN_PROMPTS, libraryFits, normalizePrompt } from '../lib/assistants';
import { uid } from '../lib/util';
import { useStore } from '../store';
import type { SavedPrompt } from '../types';
import { insertPrompt } from './Composer';
import Modal from './Modal';

export default function PromptsModal({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const prompts = settings.prompts || [];
  const [query, setQuery] = useState('');
  const [glassPhone] = useState(() => document.documentElement.classList.contains('glass') && window.matchMedia('(max-width: 899px)').matches);
  const [editing, setEditing] = useState<SavedPrompt | null>(null);
  const q = query.trim().toLowerCase();
  const match = (p: SavedPrompt) => !q || `${p.title} ${p.text}`.toLowerCase().includes(q);
  const save = () => {
    const prompt = editing && normalizePrompt(editing);
    if (!prompt) return;
    const next = [...prompts.filter((p) => p.id !== prompt.id), prompt];
    if (!libraryFits(settings.assistants || [], next)) { useStore.getState().toast('Limit reached: 25 assistants, 50 prompts or 100,000 characters in total.', 'error'); return; }
    useStore.getState().updateSettings({ prompts: next });
    setEditing(null);
  };
  const use = (p: SavedPrompt) => { insertPrompt(p.text); onClose(); };
  const Row = ({ p }: { p: SavedPrompt }) => {
    const builtin = p.id.startsWith('builtin-');
    return (
      <li className="lib-row">
        <button type="button" className="prompt-use" onClick={() => use(p)} aria-label={`Use ${p.title}`}>
          <span className="lib-row-icon" aria-hidden="true"><MessageSquareText size={17} /></span>
          <span className="lib-row-text"><strong dir="auto">{p.title}</strong><span dir="auto">{p.text.replace(/\s+/g, ' ')}</span></span>
        </button>
        <span className="lib-row-actions">
          <button className="icon-btn sm" aria-label={`${builtin ? 'Customize' : 'Edit'} ${p.title}`} onClick={() => setEditing({ ...p, id: builtin ? uid() : p.id })}><Pencil size={15} /></button>
          {!builtin && <button className="icon-btn sm" aria-label={`Delete ${p.title}`} onClick={() => { if (confirm(`Delete “${p.title}”?`)) useStore.getState().updateSettings({ prompts: prompts.filter((x) => x.id !== p.id) }); }}><Trash2 size={15} /></button>}
        </span>
      </li>
    );
  };
  const mine = prompts.filter(match), lumen = BUILTIN_PROMPTS.filter(match);
  return (
    <Modal title={editing ? (editing.title || 'New prompt') : 'Prompts'} onClose={onClose}
      actions={!editing && (glassPhone
        // iPhone glass look: a round + like the other pages (the sheet closes by swiping it down).
        ? <button type="button" className="icon-btn modal-new" aria-label="New prompt" onClick={() => setEditing({ id: uid(), title: '', text: '' })}><Plus size={22} /></button>
        : <button type="button" className="btn small" onClick={() => setEditing({ id: uid(), title: '', text: '' })}><Plus size={15} /> New</button>)}>
      <div className="prompts-modal">
        {editing ? (
          <div className="library-editor">
            <label className="field-block"><span className="setting-label">Name</span><input aria-label="Library item name" maxLength={60} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></label>
            <label className="field-block"><span className="setting-label">Prompt text</span><textarea aria-label="Library instructions" rows={8} maxLength={8000} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} /></label>
            <div className="library-form-actions"><button className="btn" onClick={() => setEditing(null)}><ChevronLeft size={16} /> Back</button><button className="btn primary" disabled={!editing.title.trim() || !editing.text.trim()} onClick={save}>Save</button></div>
          </div>
        ) : (
          <>
            {!glassPhone && <p className="muted small">Pick one to put it in the message box, add your details, then send.</p>}
            <label className="hub-search"><Search size={16} /><input type="search" aria-label="Search prompts" placeholder="Search prompts" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
            {mine.length > 0 && <section className="lib-section"><h2>Yours</h2><ul className="lib-rows">{mine.map((p) => <Row key={p.id} p={p} />)}</ul></section>}
            {lumen.length > 0 && <section className="lib-section"><h2>From Lumen</h2><ul className="lib-rows">{lumen.map((p) => <Row key={p.id} p={p} />)}</ul></section>}
            {!mine.length && !lumen.length && <p className="hub-none">No prompts match “{query}”.</p>}
          </>
        )}
      </div>
    </Modal>
  );
}
