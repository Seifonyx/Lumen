import { ArrowDown, ArrowUp, Copy, Pencil, Plus, RotateCcw, Search, Sparkles, Star, Trash2, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { allLayouts, LAYOUT_ICONS, LAYOUT_PREFIX, newLayoutId, type Layout } from '../lib/layouts';
import { PROVIDER_NAMES } from '../lib/util';
import { modelLabel, useStore } from '../store';
import LayoutIcon from './LayoutIcon';
import LayoutBuilder from './LayoutBuilder';
import { layoutModelProblem } from '../lib/layout-policy';
import { layoutPreview, layoutAssignmentProblem } from '../lib/routing-presentation';
import { matchesModel } from '../lib/model-search';

export function LayoutEditor({ start, onDone, onDraftChange, presentation }: { start: Layout; onDone: (result?: 'saved' | 'cancelled') => void; onDraftChange?: (draft: Layout) => void; presentation?: 'prism' }) {
  const canvas = presentation === 'prism';
  const catalog = useStore((s) => s.catalog);
  const settings = useStore(s => s.settings), owner = useStore(s => s.user?.uid);
  const layouts = settings.layouts || [];
  const update = useStore((s) => s.updateSettings);
  const [l, setL] = useState<Layout>({ ...start, builtin: undefined, edited: undefined });
  const [query, setQuery] = useState('');
  const errorId = useId();
  const draftChange = useRef(onDraftChange); draftChange.current = onDraftChange;
  useEffect(() => { draftChange.current?.(l); }, [l]);
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => { top.current?.scrollIntoView({ block: 'start' }); if (canvas) top.current?.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true }); }, []);
  const models = catalog?.models || [];
  const requirementError=[l.requirements?.minContext,l.requirements?.minInputTokens].some(n=>n!==undefined&&(!Number.isSafeInteger(n)||n<1));
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return models.filter((m) => !l.models.includes(m.id) && (!q || matchesModel(m,q))).slice(0, 40);
  }, [models, l.models, query]);
  const move = (i: number, d: number) => {
    const next = [...l.models];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setL({ ...l, models: next });
  };
  const save = () => {
    const fresh = useStore.getState();
    if(requirementError || fresh.user?.uid !== owner)return;
    const layouts = fresh.settings.layouts || [];
    const exists = layouts.some((x) => x.id === l.id),saved={...l,name:l.name.trim(),models:[...new Set(l.models)]};
    update({ layouts: exists ? layouts.map((x) => (x.id === l.id ? saved : x)) : [...layouts, saved] });
    onDone('saved');
  };

  const iconPicker = (<div className="field-block">
        <span className="setting-label">Icon</span>
        <div className="icon-pick">
          {LAYOUT_ICONS.map((icon) => (
            <button key={icon} className={`icon-btn sm${l.icon === icon ? ' picked' : ''}`} onClick={() => setL({ ...l, icon })} aria-label={icon} aria-pressed={l.icon === icon}>
              <LayoutIcon icon={icon} />
            </button>
          ))}
        </div>
      </div>);
  const assignedModels = (<div className="field-block">
        <span className="setting-label">Models{l.mode === 'order' ? ' (first is used first)' : ''}</span>
        <ul className="model-list">
          {l.models.length === 0 && <li className="muted small pad">Add models below.</li>}
          {l.models.map((id, i) => {
            const m = models.find((x) => x.id === id);
            return (
              <li key={id} className="model-row" data-model={id}>
                <span className="model-meta">
                  <span className="model-title">{canvas ? `${i + 1}. ` : ''}{m?.label || modelLabel(catalog, id)}</span>
                  <span className="model-sub">{m ? layoutAssignmentProblem(l,m) ? `This model ${layoutAssignmentProblem(l,m)}.` : PROVIDER_NAMES[m.provider] : 'Not in current catalog · kept in this Layout'}</span>
                </span>
                <button className="icon-btn sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp size={16} /></button>
                <button className="icon-btn sm" onClick={() => move(i, 1)} disabled={i === l.models.length - 1} aria-label="Move down"><ArrowDown size={16} /></button>
                <button className="icon-btn sm" onClick={() => setL({ ...l, models: l.models.filter((x) => x !== id) })} aria-label="Remove"><X size={16} /></button>
              </li>
            );
          })}
        </ul>
        <label className="search">
          <Search size={16} />
          <input type="search" aria-label="Add a model" placeholder="Add a model (e.g. coder, flash, groq)" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {(query || canvas) && (
          <ul className="model-list add">
            {matches.length === 0 && <li className="muted small pad">No matches.</li>}
            {(query ? matches : matches.slice(0,6)).map((m) => (
              <li key={m.id} className="model-row">
                <span className="model-meta">
                  <span className="model-title">{m.label}</span>
                  <span className="model-sub">{PROVIDER_NAMES[m.provider]} · {m.name}</span>
                  {layoutModelProblem(l,m) && <span className="model-sub">This model {layoutModelProblem(l,m)}.</span>}
                </span>
                <button className="icon-btn sm" disabled={Boolean(layoutModelProblem(l,m))} title={layoutModelProblem(l,m) || undefined} onClick={() => setL({ ...l, models: [...l.models, m.id] })} aria-label={`Add ${m.label}`}><Plus size={17} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>);

  const preview = layoutPreview(l, settings);

  return (
    <div className={`layout-editor${canvas ? ' cv-layout-editor' : ''}`} ref={top} role="form" aria-label="Layout editor">
      <div className="section-head">
        <h3 tabIndex={-1}>{layouts.some((x) => x.id === start.id) || start.builtin ? `Edit “${start.name}”` : 'New layout'}</h3>
      </div>
      <label className="field-block">
        <span className="setting-label">Name</span>
        <input type="text" value={l.name} maxLength={40} onChange={(e) => setL({ ...l, name: e.target.value })} placeholder="e.g. Web apps" />
      </label>
      {!canvas && iconPicker}
      <label className="field-block">
        <span className="setting-label">Description</span>
        <input type="text" value={l.description} onChange={(e) => setL({ ...l, description: e.target.value })} placeholder="What it's for" />
      </label>
      <div className="setting-row">
        <span className="setting-text">
          <span className="setting-label">How models are used</span>
          <span className="setting-hint">{l.mode === 'auto' ? 'Auto chooses among these models for each message.' : 'Starts with the first model. Fallback rules control when another can answer.'}</span>
        </span>
        <div className="segmented" role="group" aria-label="How models are used">
          <button type="button" aria-pressed={l.mode === 'order'} className={l.mode === 'order' ? 'active' : ''} onClick={() => setL({ ...l, mode: 'order' })}>In order</button>
          <button type="button" aria-pressed={l.mode === 'auto'} className={l.mode === 'auto' ? 'active' : ''} onClick={() => setL({ ...l, mode: 'auto' })}>{canvas ? 'Match request' : 'Best for each'}</button>
        </div>
      </div>
      {canvas && assignedModels}
      <label className="field-block"><span className="setting-label">Routing priority</span><select aria-label="Layout routing priority" value={l.priority || ''} onChange={e=>setL({...l,priority:e.target.value?e.target.value as Layout['priority']:undefined})}>
        <option value="">Use app setting</option><option value="balanced">Balanced</option><option value="quality">Quality</option><option value="speed">Speed</option><option value="cost">Cost</option>
      </select><span className="setting-hint">Used for automatic choices. Fixed model order stays authoritative.</span></label>
      <label className="field-block"><span className="setting-label">Fallback models</span><select aria-label="Layout fallback models" value={l.fallback || 'enabled'} onChange={e=>setL({...l,fallback:e.target.value as Layout['fallback']})}>
        <option value="enabled">Layout, then enabled models</option><option value="layout">Only models in this layout</option><option value="none">No automatic fallback</option>
      </select><span className="setting-hint">The app’s automatic-switching setting must also be on.</span></label>
      <details className="layout-requirements"><summary>Requirements{l.requirements?.minContext?` · ${l.requirements.minContext.toLocaleString()} context`:''}</summary>
      <fieldset className="field-block"><legend className="setting-label">Required capabilities</legend>
        {(['vision','pdf','search'] as const).map(cap=><label key={cap} className="builder-default"><input type="checkbox" checked={Boolean(l.requirements?.capabilities?.includes(cap))} onChange={e=>setL({...l,requirements:{...l.requirements,capabilities:e.target.checked?[...new Set([...(l.requirements?.capabilities || []),cap])]:(l.requirements?.capabilities || []).filter(c=>c!==cap)}})} />{cap==='vision'?'Images':cap==='pdf'?'Native PDF input':'Web search'}</label>)}
        <label className="builder-default"><input type="checkbox" checked={Boolean(l.requirements?.noReasoning)} onChange={e=>setL({...l,requirements:{...l.requirements,noReasoning:e.target.checked}})} />Exclude models that require lengthy reasoning</label>
      </fieldset>
      <label className="field-block"><span className="setting-label">Minimum context (tokens)</span><input type="number" aria-invalid={requirementError || undefined} aria-describedby={requirementError ? errorId : undefined} min={1} step={1} value={l.requirements?.minContext ?? ''} onChange={e=>setL({...l,requirements:{...l.requirements,minContext:e.target.value===''?undefined:Number(e.target.value)}})} placeholder="No minimum" /></label>
      <label className="field-block"><span className="setting-label">Input to fit (tokens)</span><input type="number" aria-invalid={requirementError || undefined} aria-describedby={requirementError ? errorId : undefined} min={1} step={1} value={l.requirements?.minInputTokens ?? ''} onChange={e=>setL({...l,requirements:{...l.requirements,minInputTokens:e.target.value===''?undefined:Number(e.target.value)}})} placeholder="No minimum" /><span className="setting-hint">Reserves room for the input and a reply.</span></label>
      </details>
      {requirementError&&<p id={errorId} className="error-msg" role="alert">Context requirements must be positive whole numbers.</p>}
      {!canvas && assignedModels}
      {canvas ? <details className="layout-instructions"><summary>Extra instructions</summary><label className="field-block">
        <span className="setting-label">Instructions (optional)</span>
        <span className="setting-hint">Added for every model in this layout, on top of your own instructions.</span>
        <textarea dir="auto" rows={4} value={l.instructions || ''} onChange={(e) => setL({ ...l, instructions: e.target.value })} style={{ minHeight: 0 }} />
      </label></details> : (<label className="field-block">
        <span className="setting-label">Instructions (optional)</span>
        <span className="setting-hint">Added for every model in this layout, on top of your own instructions.</span>
        <textarea dir="auto" rows={4} value={l.instructions || ''} onChange={(e) => setL({ ...l, instructions: e.target.value })} style={{ minHeight: 0 }} />
      </label>)}
      {canvas && <details className="layout-appearance"><summary>Appearance</summary>{iconPicker}</details>}
      {canvas && <section className="layout-preview" aria-label="Layout preview"><h4>Before you save</h4><p>{preview.mode}</p><p><b>{preview.fallback.title}.</b> {preview.fallback.description}</p><p>{preview.priority} priority for automatic choices. {preview.requirements}</p><p>{l.models.filter(id => layoutAssignmentProblem(l,models.find(m => m.id === id))).length} assigned models need attention. Assignments are retained unless you remove them.</p></section>}
      <div className="editor-actions">
        <button type="button" className="btn ghost" onClick={() => onDone('cancelled')}>Cancel</button>
        <button className="btn primary" disabled={!l.name.trim() || !l.models.length || requirementError} onClick={save}>Save layout</button>
      </div>
    </div>
  );
}

function Card({ l, onEdit, onCopy }: { l: Layout; onEdit: () => void; onCopy: () => void }) {
  const catalog = useStore((s) => s.catalog);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const id = LAYOUT_PREFIX + l.id;
  const available = l.models.filter(id=>!layoutModelProblem(l,catalog?.models.find(m=>m.id===id)));
  const isDefault = settings.defaultModel === id;
  const saved = settings.layouts || [];
  const remove = () => {
    if (!confirm(l.builtin ? `Remove the recommended "${l.name}" layout?` : `Delete the "${l.name}" layout?`)) return;
    update({
      layouts: saved.filter((x) => x.id !== l.id),
      ...(l.builtin ? { hiddenLayouts: [...new Set([...(settings.hiddenLayouts || []), l.id])] } : {}),
      ...(isDefault ? { defaultModel: 'auto' } : {}),
    });
  };
  return (
    <li className="layout-card">
      <span className="layout-icon"><LayoutIcon icon={l.icon} size={18} /></span>
      <div className="layout-main">
        <div className="layout-title">
          <span className="layout-name">{l.name}</span>
          <span className="tag">{l.mode === 'auto' ? 'best for each' : 'in order'}</span>
          {l.edited && <span className="tag">edited</span>}
        </div>
        {l.description && <div className="setting-hint">{l.description}</div>}
        <div className="layout-models">
          {available.length ? (
            <>
              {available.slice(0, 4).map((m) => <span key={m} className="chip">{modelLabel(catalog, m)}</span>)}
              {available.length > 4 && <span className="chip more" title={available.slice(4).map((m) => modelLabel(catalog, m)).join(', ')}>+{available.length - 4}</span>}
            </>
          ) : <span className="muted small">No models available with your keys yet.</span>}
        </div>
      </div>
      <div className="layout-actions">
        <button className={`icon-btn sm star${isDefault ? ' on' : ''}`} onClick={() => update({ defaultModel: isDefault ? 'auto' : id })} aria-label="Use for new chats" title={isDefault ? 'Default for new chats' : 'Use for new chats'}>
          <Star size={16} fill={isDefault ? 'currentColor' : 'none'} />
        </button>
        <button className="icon-btn sm" onClick={onEdit} aria-label={`Edit ${l.name}`} title="Edit"><Pencil size={15} /></button>
        <button className="icon-btn sm" onClick={onCopy} aria-label={`Copy ${l.name}`} title="Duplicate"><Copy size={15} /></button>
        {l.edited && (
          <button className="icon-btn sm" onClick={() => update({ layouts: saved.filter((x) => x.id !== l.id) })} aria-label={`Reset ${l.name}`} title="Reset to recommended">
            <RotateCcw size={15} />
          </button>
        )}
        <button className="icon-btn sm" onClick={remove} aria-label={`Delete ${l.name}`} title={l.builtin ? 'Remove' : 'Delete'}>
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  );
}

/** Layouts, shown inside the Models section of Settings. The editor is shown by the caller. */
export default function LayoutsSection({ onEdit }: { onEdit: (l: Layout) => void }) {
  const catalog = useStore((s) => s.catalog);
  const custom = useStore((s) => s.settings.layouts) || [];
  const hidden = useStore((s) => s.settings.hiddenLayouts) || [];
  const all = allLayouts(catalog?.models || [], custom, hidden);
  const copyOf = (l: Layout): Layout => ({ ...l, id: newLayoutId(), name: `${l.name} (copy)`.slice(0, 40), builtin: undefined, edited: undefined });
  const [building, setBuilding] = useState(false);

  return (
    <div className="settings-group layouts-tab">
      <div className="settings-group-title">
        <span>Layouts</span>
        <span className="layout-head-actions">
        <button className="link-btn small" onClick={() => setBuilding(true)} title="Pick a task; Lumen checks for new models and chooses the best ones for it"><Sparkles size={14} /> Build for a task</button>
        <button className="link-btn small" onClick={() => onEdit({ id: newLayoutId(), name: '', icon: 'layers', description: '', models: [], mode: 'order' })}>
          <Plus size={14} /> New layout
        </button>
        </span>
      </div>
      {building && <LayoutBuilder onClose={() => setBuilding(false)} />}
      {all.length === 0 ? (
        <div className="settings-card pad-card">
          <p className="muted small" style={{ margin: 0 }}>No layouts. Create one.</p>
        </div>
      ) : (
        <div className="settings-card">
          <ul className="layout-list">
            {all.map((l) => (
              <Card key={l.id} l={l} onEdit={() => onEdit(l)} onCopy={() => onEdit(copyOf(l))} />
            ))}
          </ul>
        </div>
      )}
      <p className="card-note outside">
        A layout is a set of models for one kind of work. Pick it from the model menu; ★ makes it the default for new chats.
        {!catalog?.providers.groq && !catalog?.providers.cerebras ? ' Add free Groq and Cerebras keys for the Fastest and Max coding layouts.' : ''}
      </p>
    </div>
  );
}
