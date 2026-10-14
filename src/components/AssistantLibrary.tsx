import { useLayoutEffect,useRef,useState } from 'react';
import { BookOpen, Clock, Pencil, Plus, Search, Sparkles, Trash2, Wrench } from 'lucide-react';
import FreeTools from './FreeTools';
import TaskLibrary from './TaskLibrary';
import KnowledgeLibrary from './KnowledgeLibrary';
import Modal from './Modal';
import FilterMenu from './FilterMenu';
import { modelLabel, useStore } from '../store';
import { BUILTIN_ASSISTANTS, BUILTIN_PROMPTS, libraryFits, normalizeAssistant, normalizePrompt } from '../lib/assistants';
import { AUTO } from '../lib/routing';
import { uid } from '../lib/util';
import type { SavedAssistant, SavedPrompt } from '../types';
import { insertPrompt } from './Composer';

export default function AssistantLibrary({ onClose, initialTab = 'assistants' }: { onClose: () => void; initialTab?: 'assistants' | 'prompts' | 'tools' | 'tasks' | 'knowledge' }) {
  const settings = useStore(s => s.settings);
  const catalog = useStore(s => s.catalog);
  const { updateSettings, startAssistant, toast } = useStore.getState();
  const assistants = settings.assistants || [];
  const prompts = settings.prompts || [];
  const [tab, setTab] = useState<'assistants' | 'prompts' | 'tools' | 'tasks' | 'knowledge'>(initialTab);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<'all' | 'mine' | 'starter'>('all');
  const tabStrip=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{tabStrip.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({block:'nearest',inline:'nearest'});},[tab]);
  const [editing, setEditing] = useState<SavedAssistant | SavedPrompt | null>(null);
  const isAssistant = (value: SavedAssistant | SavedPrompt): value is SavedAssistant => 'instructions' in value;
  const save = () => {
    if (!editing) return;
    const assistant = isAssistant(editing) ? normalizeAssistant(editing) : null;
    const prompt = !isAssistant(editing) ? normalizePrompt(editing) : null;
    if (!assistant && !prompt) return;
    const nextAssistants = assistant ? [...assistants.filter(a => a.id !== assistant.id), assistant] : assistants;
    const nextPrompts = prompt ? [...prompts.filter(p => p.id !== prompt.id), prompt] : prompts;
    if (!libraryFits(nextAssistants, nextPrompts)) { toast('Library limit reached: 25 helpers, 50 prompts or 100,000 characters total.', 'error'); return; }
    updateSettings({ assistants: nextAssistants, prompts: nextPrompts });
    setEditing(null);
  };
  const remove = (id: string) => {
    if (!confirm('Delete this saved item? Existing chats will keep their helper instructions.')) return;
    updateSettings(tab === 'assistants' ? { assistants: assistants.filter(a => a.id !== id) } : { prompts: prompts.filter(p => p.id !== id) });
  };
  const items = tab === 'assistants' ? [...assistants, ...BUILTIN_ASSISTANTS] : [...prompts, ...BUILTIN_PROMPTS];
  const mine = items.filter(item => !item.id.startsWith('builtin-')).length;
  const matches = items.filter(item => (source === 'all' || (source === 'mine') !== item.id.startsWith('builtin-')) && JSON.stringify(item).toLowerCase().includes(query.trim().toLowerCase()));
  return <Modal title="Library" onClose={onClose} wide>
    <div className="assistant-library">
      {editing ? <div className="library-editor">
        <h3>{isAssistant(editing) ? 'Assistant details' : 'Prompt details'}</h3>
        <label className="field-block"><span className="setting-label">Name</span><input aria-label="Library item name" maxLength={60} value={isAssistant(editing) ? editing.name : editing.title} onChange={e => setEditing(isAssistant(editing) ? { ...editing, name: e.target.value } : { ...editing, title: e.target.value })} /></label>
        {isAssistant(editing) && <>
          <label className="field-block"><span className="setting-label">Description</span><input maxLength={160} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} /></label>
          <label className="field-block"><span className="setting-label">Default model</span><select aria-label="Assistant model" value={editing.model} onChange={e => setEditing({ ...editing, model: e.target.value })}><option value={AUTO}>Auto · choose for the task</option>{settings.enabledModels.filter(id => id !== AUTO).map(id => <option key={id} value={id}>{modelLabel(catalog, id)}</option>)}{editing.model !== AUTO && !settings.enabledModels.includes(editing.model) && <option value={editing.model}>Unavailable · uses Auto</option>}</select></label>
        </>}
        <label className="field-block"><span className="setting-label">{isAssistant(editing) ? 'Instructions' : 'Prompt text'}</span><textarea aria-label="Library instructions" rows={8} maxLength={8000} value={isAssistant(editing) ? editing.instructions : editing.text} onChange={e => setEditing(isAssistant(editing) ? { ...editing, instructions: e.target.value } : { ...editing, text: e.target.value })} /></label>
        <div className="library-form-actions"><button className="btn" onClick={() => setEditing(null)}>Back</button><button className="btn primary" disabled={isAssistant(editing) ? !editing.name.trim() || !editing.instructions.trim() : !editing.title.trim() || !editing.text.trim()} onClick={save}>Save</button></div>
      </div> : <>
        <div className="library-tabs" ref={tabStrip} role="tablist" aria-label="Library sections">{(['assistants', 'prompts', 'tools', 'tasks', 'knowledge'] as const).map(value => <button key={value} role="tab" tabIndex={tab === value ? 0 : -1} aria-selected={tab === value} className={tab === value ? 'active' : ''} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=['assistants','prompts','tools','tasks','knowledge'] as const;const index=tabs.indexOf(value);const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowLeft'?-1:1)+tabs.length)%tabs.length;setTab(tabs[next]);setQuery('');setSource('all');e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus();}} onClick={() => { setTab(value); setQuery('');setSource('all'); }}>{value === 'assistants' ? <Sparkles size={16} /> : value === 'tasks' ? <Clock size={16} /> : value === 'tools' ? <Wrench size={16} /> : <BookOpen size={16} />}{value === 'assistants' ? 'Assistants' : value === 'tasks' ? 'Tasks' : value === 'tools' ? 'Tools' : value === 'knowledge' ? 'Knowledge' : 'Prompts'}</button>)}</div>
        {tab === 'knowledge' ? <KnowledgeLibrary onClose={onClose} /> : tab === 'tools' ? <FreeTools onClose={onClose} /> : tab === 'tasks' ? <TaskLibrary onClose={onClose} /> : <>
        <p className="muted small">{tab === 'assistants' ? 'Start a chat with a saved helper’s instructions and model. You can change its model anytime.' : 'Reusable starting points. Insert a prompt, add your details, then send when ready.'}</p>
        <div className="library-toolbar"><label className="library-search"><Search size={16} /><input type="search" aria-label="Search library" placeholder="Search library" value={query} onChange={e => setQuery(e.target.value)} /></label>{mine > 0 && <FilterMenu<'all' | 'mine' | 'starter'> label="Show" value={source} onChange={setSource} options={[{ value: 'all', label: 'All', count: items.length }, { value: 'mine', label: 'Yours', count: mine }, { value: 'starter', label: 'Starters', count: items.length - mine }]} />}<button className="btn" onClick={() => setEditing(tab === 'assistants' ? { id: uid(), name: '', description: '', instructions: '', model: AUTO } : { id: uid(), title: '', text: '' })}><Plus size={16} />{tab === 'assistants' ? 'New assistant' : 'New prompt'}</button></div>
        <div className="library-grid">{matches.map(item => {
          const builtin = item.id.startsWith('builtin-');
          return <article className="library-card" key={item.id}>
            <div className="library-card-heading"><span className="library-card-icon">{isAssistant(item) ? <Sparkles size={15} /> : <BookOpen size={15} />}</span><h3>{isAssistant(item) ? item.name : item.title}</h3><span className={`library-tag${builtin ? '' : ' mine'}`}>{builtin ? 'Starter' : 'Yours'}</span></div>
            <p>{isAssistant(item) ? item.description || 'Your custom assistant.' : item.text}</p>
            <div className="library-card-actions"><button className="btn small" onClick={() => { if (isAssistant(item)) startAssistant(item); else insertPrompt(item.text); onClose(); }}>{isAssistant(item) ? 'Start chat' : 'Insert prompt'}</button><span className="spacer" /><button className="icon-btn sm" aria-label={`${builtin ? 'Customize' : 'Edit'} ${isAssistant(item) ? item.name : item.title}`} onClick={() => setEditing({ ...item, id: builtin ? uid() : item.id })}><Pencil size={15} /></button>{!builtin && <button className="icon-btn sm" aria-label={`Delete ${isAssistant(item) ? item.name : item.title}`} onClick={() => remove(item.id)}><Trash2 size={15} /></button>}</div>
          </article>;
        })}</div>
        {!matches.length && <p className="muted library-empty">No matching items.</p>}
        </>}
      </>}
    </div>
  </Modal>;
}
