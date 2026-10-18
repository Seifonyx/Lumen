// Build a layout for a kind of work: pick a task (or describe it), Lumen checks your providers for new models,
// ranks every model for that task and shows why each one was picked. Untick any you don't want, then save.
import { Check, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { keyVersion } from '../lib/ai/providers.js';
import { modelMeetsTask, rankForTask, taskFromText, TASKS, type Pick, type TaskProfile } from '../lib/layout-builder';
import { newLayoutId, LAYOUT_PREFIX } from '../lib/layouts';
import { layoutRequirements } from '../lib/layout-policy';
import { modelLabel, useStore } from '../store';
import Modal from './Modal';

export default function LayoutBuilder({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [task, setTask] = useState<TaskProfile | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [fresh, setFresh] = useState<string[]>([]);
  const [useDefault, setUseDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Keep choices even while a catalogue temporarily omits a model.
  const choices = useRef(new Map<string, boolean>());
  const operation = useRef(0);
  const busy = useRef(false);
  const builtScope = useRef('');
  const catalog = useStore((s) => s.catalog);
  const scope = () => `${useStore.getState().user?.uid || ''}:${keyVersion()}`;
  useEffect(() => () => { operation.current++; }, []);
  const close = () => { operation.current++; onClose(); };

  const build = async (t: TaskProfile, preserve = false) => {
    if (busy.current) return;
    busy.current = true;
    const token = ++operation.current, owner = scope();
    const selected = preserve ? new Map(choices.current) : new Map<string, boolean>();
    setError(null);
    setTask(t); if (!preserve) setName(t.name); setPicks(null);
    // New models appear all the time: look again before choosing.
    setStatus('Checking your providers for new models…');
    const before = new Set(useStore.getState().catalog?.models.map((m) => m.id) || []);
    await useStore.getState().loadCatalog().catch(() => {});
    if (token !== operation.current) return;
    busy.current = false;
    if (scope() !== owner) { setStatus(null); setTask(null); setError('Your connections changed. Build the layout again.'); return; }
    const models = useStore.getState().catalog?.models || [];
    setFresh(models.filter((m) => before.size && !before.has(m.id)).map((m) => m.id));
    setStatus(`Ranking ${models.length} models for ${t.name.toLowerCase()}…`);
    const ranked = rankForTask(t, models, useStore.getState().modelContext(), preserve ? models.length : 6)
      .filter((pick, index) => index < 6 || selected.get(pick.id) === true);
    builtScope.current = owner;
    setPicks(ranked);
    if (!preserve) choices.current = new Map(ranked.map(pick => [pick.id, true]));
    setChosen(new Set(ranked.filter(p => !preserve || selected.get(p.id) === true).map((p) => p.id)));
    setStatus(null);
  };
  const save = () => {
    if (!task || !picks) return;
    const known = new Map(useStore.getState().catalog?.models.map(m => [m.id, m]));
    if (builtScope.current !== scope() || picks.some(p => chosen.has(p.id) && (!known.has(p.id) || !modelMeetsTask(task, known.get(p.id)!)))) {
      setError('Your models changed. Check again before saving.'); return;
    }
    if (!chosen.size) return;
    const { settings, updateSettings, toast } = useStore.getState();
    const layout = { id: newLayoutId(), name: name.trim() || task.name, icon: task.icon, description: task.description, models: picks.filter((p) => chosen.has(p.id)).map((p) => p.id), mode: task.mode, instructions: task.instructions,requirements:layoutRequirements(task),priority:task.priority || (task.id==='fast'?'speed':undefined) };
    updateSettings({ layouts: [...(settings.layouts || []), layout], ...(useDefault ? { defaultModel: LAYOUT_PREFIX + layout.id } : {}) });
    toast(`Saved “${layout.name}”. Pick it from the model menu.`, 'success');
    close();
  };

  return (
    <Modal title="Build a layout" onClose={close}>
      <div className="layout-builder">
        {error && <p className="error-msg" role="alert">{error}</p>}
        {!picks && !status && (
          <>
            <p className="muted small">What kind of work is it for? Lumen checks for new models first, then picks the best ones you have for it.</p>
            <div className="builder-tasks">
              {TASKS.map((t) => <button key={t.id} type="button" className="writing-chip" onClick={() => void build(t)}>{t.name}</button>)}
            </div>
            <form className="ask-form" noValidate onSubmit={(e) => { e.preventDefault(); if (text.trim()) void build(taskFromText(text)); }}>
              <label className="search"><input dir="auto" aria-label="Describe the work" placeholder="Or describe it, e.g. “debugging React apps”" value={text} onChange={(e) => setText(e.target.value)} /></label>
              <button type="submit" className="btn primary" disabled={!text.trim()}><Sparkles size={15} /> Build</button>
            </form>
          </>
        )}
        {status && <div className="ask-status" role="status"><Loader2 size={16} className="spin" /> {status}</div>}
        {picks && task && (
          <>
            <label className="builder-name"><span className="muted small">Name</span><input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} dir="auto" /></label>
            {fresh.length > 0 && <p className="builder-fresh small">Found {fresh.length} new model{fresh.length === 1 ? '' : 's'} since last time.</p>}
            {picks.length === 0 ? <p className="muted small">No connected model meets all the requirements. Change the description or connect a model with the needed capabilities and context.</p> : (
              <ol className="builder-picks">
                {picks.map((p) => (
                  <li key={p.id}>
                    <label>
                      <input type="checkbox" checked={chosen.has(p.id)} onChange={(event) => {
                        const checked = event.target.checked;
                        choices.current.set(p.id, checked);
                        setChosen((s) => { const next = new Set(s); if (checked) next.add(p.id); else next.delete(p.id); return next; });
                      }} />
                      <span className="builder-pick">
                        <strong>{picks.find(item => chosen.has(item.id))?.id === p.id ? 'First: ' : ''}{modelLabel(catalog, p.id)}{fresh.includes(p.id) && <span className="builder-new">new</span>}</strong>
                        <span className="muted small">{p.why.join(' · ')}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ol>
            )}
            <p className="muted small">{task.mode === 'auto' ? 'For each message, the best of these answers.' : 'The first one answers; the next steps in if it fails or hits its limit.'}</p>
            <label className="builder-default"><input type="checkbox" checked={useDefault} onChange={(e) => setUseDefault(e.target.checked)} /> Use it for new chats</label>
            <div className="builder-actions">
              <button type="button" className="btn ghost small" onClick={() => { setPicks(null); setTask(null); }}>Back</button>
              <button type="button" className="btn ghost small" onClick={() => void build(task, true)}><RefreshCw size={14} /> Check again</button>
              <span className="spacer" />
              <button type="button" className="btn primary small" disabled={!chosen.size} onClick={save}><Check size={14} /> Save layout</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
