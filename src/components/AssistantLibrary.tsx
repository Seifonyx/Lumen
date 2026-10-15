// Assistants: saved helpers with their own instructions and model. Start a chat with one, or make your own.
// (Prompts live in the message box's + menu, tools there too, uploaded files in Files, schedules in Settings.)
import { useState } from 'react';
import { Pencil, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import HubPage from './HubPage';
import { modelLabel, useStore } from '../store';
import { BUILTIN_ASSISTANTS, libraryFits, normalizeAssistant } from '../lib/assistants';
import { AUTO } from '../lib/routing';
import { uid } from '../lib/util';
import type { SavedAssistant } from '../types';

const HUES = [212, 152, 28, 280, 340, 190, 48, 100];
/** A steady colour per assistant, from its name. */
const hue = (name: string) => HUES[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % HUES.length];
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';

export default function AssistantLibrary({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const catalog = useStore((s) => s.catalog);
  const { updateSettings, startAssistant, toast } = useStore.getState();
  const assistants = settings.assistants || [];
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<SavedAssistant | null>(null);
  const save = () => {
    const assistant = editing && normalizeAssistant(editing);
    if (!assistant) return;
    const next = [...assistants.filter((a) => a.id !== assistant.id), assistant];
    if (!libraryFits(next, settings.prompts || [])) { toast('Limit reached: 25 assistants, 50 prompts or 100,000 characters in total.', 'error'); return; }
    updateSettings({ assistants: next });
    setEditing(null);
  };
  const remove = (id: string) => {
    if (!confirm('Delete this assistant? Chats that used it keep its instructions.')) return;
    updateSettings({ assistants: assistants.filter((a) => a.id !== id) });
  };
  const q = query.trim().toLowerCase();
  const match = (item: SavedAssistant) => !q || JSON.stringify(item).toLowerCase().includes(q);
  const newItem = () => setEditing({ id: uid(), name: '', description: '', instructions: '', model: AUTO });

  if (editing) {
    return (
      <HubPage label="Assistants" title={editing.name || 'New assistant'} subtitle="An assistant starts every chat with these instructions and model." onClose={onClose} onBack={() => setEditing(null)}>
        <div className="library-editor hub-form">
          <label className="field-block"><span className="setting-label">Name</span><input aria-label="Library item name" maxLength={60} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
          <label className="field-block"><span className="setting-label">Description</span><input maxLength={160} value={editing.description} placeholder="What it helps with, in a few words" onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></label>
          <label className="field-block"><span className="setting-label">Default model</span><select aria-label="Assistant model" value={editing.model} onChange={(e) => setEditing({ ...editing, model: e.target.value })}><option value={AUTO}>Auto · choose for the task</option>{settings.enabledModels.filter((id) => id !== AUTO).map((id) => <option key={id} value={id}>{modelLabel(catalog, id)}</option>)}{editing.model !== AUTO && !settings.enabledModels.includes(editing.model) && <option value={editing.model}>Unavailable · uses Auto</option>}</select></label>
          <label className="field-block"><span className="setting-label">Instructions</span><textarea aria-label="Library instructions" rows={10} maxLength={8000} value={editing.instructions} onChange={(e) => setEditing({ ...editing, instructions: e.target.value })} /></label>
          <div className="library-form-actions"><button className="btn" onClick={() => setEditing(null)}>Back</button><button className="btn primary" disabled={!editing.name.trim() || !editing.instructions.trim()} onClick={save}>Save</button></div>
        </div>
      </HubPage>
    );
  }

  const Assistant = ({ a }: { a: SavedAssistant }) => {
    const builtin = a.id.startsWith('builtin-');
    return (
      <article className="lib-card" style={{ ['--h' as string]: hue(a.name) }}>
        <button type="button" className="lib-card-main" onClick={() => { startAssistant(a); onClose(); }} aria-label={`Start a chat with ${a.name}`}>
          <span className="lib-avatar" aria-hidden="true">{builtin ? <Sparkles size={18} /> : initials(a.name)}</span>
          <span className="lib-card-text">
            <strong dir="auto">{a.name}</strong>
            <span className="lib-desc" dir="auto">{a.description || 'Your custom assistant.'}</span>
          </span>
        </button>
        <footer className="lib-card-foot">
          <span className="lib-owner">{builtin ? 'By Lumen' : 'By you'} · {a.model === AUTO ? 'Auto' : modelLabel(catalog, a.model)}</span>
          <span className="spacer" />
          <button className="icon-btn sm" aria-label={`${builtin ? 'Customize' : 'Edit'} ${a.name}`} title={builtin ? 'Make your own copy' : 'Edit'} onClick={() => setEditing({ ...a, id: builtin ? uid() : a.id })}><Pencil size={15} /></button>
          {!builtin && <button className="icon-btn sm" aria-label={`Delete ${a.name}`} onClick={() => remove(a.id)}><Trash2 size={15} /></button>}
        </footer>
      </article>
    );
  };
  const mine = assistants.filter(match), lumen = BUILTIN_ASSISTANTS.filter(match);

  return (
    <HubPage label="Assistants" title="Assistants" subtitle="Helpers with their own instructions and model. Start a chat with one, or make your own." onClose={onClose}
      actions={<button className="btn primary" onClick={newItem}><Plus size={16} /> New assistant</button>}
      toolbar={<label className="hub-search"><Search size={16} /><input type="search" aria-label="Search assistants" placeholder="Search assistants" value={query} onChange={(e) => setQuery(e.target.value)} /></label>}>
      <div className="assistant-library">
        {(mine.length > 0 || !q) && (
          <section className="lib-section">
            <h2>Yours</h2>
            {mine.length ? <div className="lib-grid">{mine.map((a) => <Assistant key={a.id} a={a} />)}</div> : (
              <button type="button" className="lib-create" onClick={newItem}><span className="lib-create-icon"><Plus size={18} /></span><span><strong>Make an assistant</strong><span>Give it instructions and a model; it’s ready in every chat.</span></span></button>
            )}
          </section>
        )}
        {lumen.length > 0 && <section className="lib-section"><h2>From Lumen</h2><div className="lib-grid">{lumen.map((a) => <Assistant key={a.id} a={a} />)}</div></section>}
        {q && !mine.length && !lumen.length && <p className="hub-none">No assistants match “{query}”.</p>}
      </div>
    </HubPage>
  );
}
