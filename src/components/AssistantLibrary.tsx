// Library: assistants (saved helpers with their own instructions and model), prompts, free tools, scheduled
// tasks and knowledge, as one page with tabs.
import { useState } from 'react';
import { BookOpen, Clock, Database, MessageSquareText, Pencil, Plus, Search, Sparkles, Trash2, Wrench } from 'lucide-react';
import FreeTools from './FreeTools';
import TaskLibrary from './TaskLibrary';
import KnowledgeLibrary from './KnowledgeLibrary';
import HubPage, { HubEmpty } from './HubPage';
import { modelLabel, useStore } from '../store';
import { BUILTIN_ASSISTANTS, BUILTIN_PROMPTS, libraryFits, normalizeAssistant, normalizePrompt } from '../lib/assistants';
import { AUTO } from '../lib/routing';
import { uid } from '../lib/util';
import type { SavedAssistant, SavedPrompt } from '../types';
import { insertPrompt } from './Composer';

type Tab = 'assistants' | 'prompts' | 'tools' | 'tasks' | 'knowledge';
const HUES = [212, 152, 28, 280, 340, 190, 48, 100];
/** A steady colour per assistant, from its name. */
const hue = (name: string) => HUES[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % HUES.length];
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';

const COPY: Record<Tab, string> = {
  assistants: 'Helpers with their own instructions and model. Start a chat with one, or make your own.',
  prompts: 'Reusable starting points. Insert one into the message box, add your details, then send.',
  tools: 'Free tools that run on your device or with your keys.',
  tasks: 'Reminders and AI requests that run on a schedule.',
  knowledge: 'Documents Lumen can search and cite in your chats.',
};

export default function AssistantLibrary({ onClose, initialTab = 'assistants' }: { onClose: () => void; initialTab?: Tab }) {
  const settings = useStore((s) => s.settings);
  const catalog = useStore((s) => s.catalog);
  const { updateSettings, startAssistant, toast } = useStore.getState();
  const assistants = settings.assistants || [];
  const prompts = settings.prompts || [];
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<SavedAssistant | SavedPrompt | null>(null);
  const isAssistant = (value: SavedAssistant | SavedPrompt): value is SavedAssistant => 'instructions' in value;
  const save = () => {
    if (!editing) return;
    const assistant = isAssistant(editing) ? normalizeAssistant(editing) : null;
    const prompt = !isAssistant(editing) ? normalizePrompt(editing) : null;
    if (!assistant && !prompt) return;
    const nextAssistants = assistant ? [...assistants.filter((a) => a.id !== assistant.id), assistant] : assistants;
    const nextPrompts = prompt ? [...prompts.filter((p) => p.id !== prompt.id), prompt] : prompts;
    if (!libraryFits(nextAssistants, nextPrompts)) { toast('Library limit reached: 25 helpers, 50 prompts or 100,000 characters total.', 'error'); return; }
    updateSettings({ assistants: nextAssistants, prompts: nextPrompts });
    setEditing(null);
  };
  const remove = (id: string) => {
    if (!confirm('Delete this saved item? Existing chats will keep their helper instructions.')) return;
    updateSettings(tab === 'assistants' ? { assistants: assistants.filter((a) => a.id !== id) } : { prompts: prompts.filter((p) => p.id !== id) });
  };
  const q = query.trim().toLowerCase();
  const match = (item: SavedAssistant | SavedPrompt) => !q || JSON.stringify(item).toLowerCase().includes(q);
  const newItem = () => setEditing(tab === 'assistants' ? { id: uid(), name: '', description: '', instructions: '', model: AUTO } : { id: uid(), title: '', text: '' });
  const listTab = tab === 'assistants' || tab === 'prompts';

  if (editing) {
    const assistant = isAssistant(editing);
    return (
      <HubPage label="Library" title={assistant ? (editing.name || 'New assistant') : (editing.title || 'New prompt')} subtitle={assistant ? 'An assistant starts every chat with these instructions and model.' : 'A prompt is inserted into the message box for you to finish.'} onClose={onClose} onBack={() => setEditing(null)}>
        <div className="library-editor hub-form">
          <label className="field-block"><span className="setting-label">Name</span><input aria-label="Library item name" maxLength={60} value={assistant ? editing.name : editing.title} onChange={(e) => setEditing(assistant ? { ...editing, name: e.target.value } : { ...editing, title: e.target.value })} /></label>
          {assistant && <>
            <label className="field-block"><span className="setting-label">Description</span><input maxLength={160} value={editing.description} placeholder="What it helps with, in a few words" onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></label>
            <label className="field-block"><span className="setting-label">Default model</span><select aria-label="Assistant model" value={editing.model} onChange={(e) => setEditing({ ...editing, model: e.target.value })}><option value={AUTO}>Auto · choose for the task</option>{settings.enabledModels.filter((id) => id !== AUTO).map((id) => <option key={id} value={id}>{modelLabel(catalog, id)}</option>)}{editing.model !== AUTO && !settings.enabledModels.includes(editing.model) && <option value={editing.model}>Unavailable · uses Auto</option>}</select></label>
          </>}
          <label className="field-block"><span className="setting-label">{assistant ? 'Instructions' : 'Prompt text'}</span><textarea aria-label="Library instructions" rows={10} maxLength={8000} value={assistant ? editing.instructions : editing.text} onChange={(e) => setEditing(assistant ? { ...editing, instructions: e.target.value } : { ...editing, text: e.target.value })} /></label>
          <div className="library-form-actions"><button className="btn" onClick={() => setEditing(null)}>Back</button><button className="btn primary" disabled={assistant ? !editing.name.trim() || !editing.instructions.trim() : !editing.title.trim() || !editing.text.trim()} onClick={save}>Save</button></div>
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
  const Prompt = ({ p }: { p: SavedPrompt }) => {
    const builtin = p.id.startsWith('builtin-');
    return (
      <li className="lib-row">
        <span className="lib-row-icon" aria-hidden="true"><MessageSquareText size={17} /></span>
        <span className="lib-row-text"><strong dir="auto">{p.title}</strong><span dir="auto">{p.text.replace(/\s+/g, ' ')}</span></span>
        <span className="lib-row-actions">
          <button className="icon-btn sm" aria-label={`${builtin ? 'Customize' : 'Edit'} ${p.title}`} onClick={() => setEditing({ ...p, id: builtin ? uid() : p.id })}><Pencil size={15} /></button>
          {!builtin && <button className="icon-btn sm" aria-label={`Delete ${p.title}`} onClick={() => remove(p.id)}><Trash2 size={15} /></button>}
          <button className="btn small" onClick={() => { insertPrompt(p.text); onClose(); }}>Use</button>
        </span>
      </li>
    );
  };
  const mineA = assistants.filter(match), lumenA = BUILTIN_ASSISTANTS.filter(match);
  const mineP = prompts.filter(match), lumenP = BUILTIN_PROMPTS.filter(match);

  return (
    <HubPage<Tab> label="Library" title="Library" subtitle={COPY[tab]} onClose={onClose} tab={tab} onTab={(t) => { setTab(t); setQuery(''); }}
      tabs={[
        { id: 'assistants', label: 'Assistants', icon: <Sparkles size={15} /> },
        { id: 'prompts', label: 'Prompts', icon: <BookOpen size={15} /> },
        { id: 'knowledge', label: 'Knowledge', icon: <Database size={15} /> },
        { id: 'tools', label: 'Tools', icon: <Wrench size={15} /> },
        { id: 'tasks', label: 'Tasks', icon: <Clock size={15} /> },
      ]}
      actions={listTab && <button className="btn primary" onClick={newItem}><Plus size={16} /> {tab === 'assistants' ? 'New assistant' : 'New prompt'}</button>}
      toolbar={listTab && <label className="hub-search"><Search size={16} /><input type="search" aria-label="Search library" placeholder={tab === 'assistants' ? 'Search assistants' : 'Search prompts'} value={query} onChange={(e) => setQuery(e.target.value)} /></label>}>
      <div className="assistant-library">
        {tab === 'knowledge' ? <KnowledgeLibrary onClose={onClose} /> : tab === 'tools' ? <FreeTools onClose={onClose} /> : tab === 'tasks' ? <TaskLibrary onClose={onClose} /> : tab === 'assistants' ? (
          <>
            {(mineA.length > 0 || !q) && (
              <section className="lib-section">
                <h2>Yours</h2>
                {mineA.length ? <div className="lib-grid">{mineA.map((a) => <Assistant key={a.id} a={a} />)}</div> : (
                  <button type="button" className="lib-create" onClick={newItem}><span className="lib-create-icon"><Plus size={18} /></span><span><strong>Make an assistant</strong><span>Give it instructions and a model; it’s ready in every chat.</span></span></button>
                )}
              </section>
            )}
            {lumenA.length > 0 && <section className="lib-section"><h2>From Lumen</h2><div className="lib-grid">{lumenA.map((a) => <Assistant key={a.id} a={a} />)}</div></section>}
            {q && !mineA.length && !lumenA.length && <p className="hub-none">No assistants match “{query}”.</p>}
          </>
        ) : (
          <>
            {mineP.length > 0 && <section className="lib-section"><h2>Yours</h2><ul className="lib-rows">{mineP.map((p) => <Prompt key={p.id} p={p} />)}</ul></section>}
            {lumenP.length > 0 && <section className="lib-section"><h2>From Lumen</h2><ul className="lib-rows">{lumenP.map((p) => <Prompt key={p.id} p={p} />)}</ul></section>}
            {!mineP.length && !lumenP.length && (q ? <p className="hub-none">No prompts match “{query}”.</p> : <HubEmpty icon={<BookOpen size={24} />} title="No prompts" text="Save prompts you use often." />)}
          </>
        )}
      </div>
    </HubPage>
  );
}
