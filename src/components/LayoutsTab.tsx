import { ArrowDown, ArrowUp, Copy, Pencil, Plus, RotateCcw, Search, Star, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { allLayouts, LAYOUT_ICONS, LAYOUT_PREFIX, newLayoutId, RECOMMENDED_IDS, type Layout } from '../lib/layouts';
import { PROVIDER_NAMES } from '../lib/util';
import { modelLabel, useStore } from '../store';
import LayoutIcon from './LayoutIcon';

export function LayoutEditor({ start, onDone }: { start: Layout; onDone: () => void }) {
  const catalog = useStore((s) => s.catalog);
  const layouts = useStore((s) => s.settings.layouts) || [];
  const update = useStore((s) => s.updateSettings);
  const [l, setL] = useState<Layout>({ ...start, builtin: undefined, edited: undefined });
  const [query, setQuery] = useState('');
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => top.current?.scrollIntoView({ block: 'start' }), []);
  const models = catalog?.models || [];
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return models.filter((m) => !l.models.includes(m.id) && (!q || `${m.label} ${m.name} ${m.provider}`.toLowerCase().includes(q))).slice(0, 40);
  }, [models, l.models, query]);
  const move = (i: number, d: number) => {
    const next = [...l.models];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setL({ ...l, models: next });
  };
  const save = () => {
    const exists = layouts.some((x) => x.id === l.id);
    update({ layouts: exists ? layouts.map((x) => (x.id === l.id ? l : x)) : [...layouts, l] });
    onDone();
  };

  return (
    <div className="layout-editor" ref={top}>
      <div className="section-head">
        <h3>{layouts.some((x) => x.id === start.id) || start.builtin ? `Edit “${start.name}”` : 'New layout'}</h3>
      </div>
      <label className="field-block">
        <span className="setting-label">Name</span>
        <input type="text" value={l.name} maxLength={40} onChange={(e) => setL({ ...l, name: e.target.value })} placeholder="e.g. Web apps" />
      </label>
      <div className="field-block">
        <span className="setting-label">Icon</span>
        <div className="icon-pick">
          {LAYOUT_ICONS.map((icon) => (
            <button key={icon} className={`icon-btn sm${l.icon === icon ? ' picked' : ''}`} onClick={() => setL({ ...l, icon })} aria-label={icon} aria-pressed={l.icon === icon}>
              <LayoutIcon icon={icon} />
            </button>
          ))}
        </div>
      </div>
      <label className="field-block">
        <span className="setting-label">Description</span>
        <input type="text" value={l.description} maxLength={120} onChange={(e) => setL({ ...l, description: e.target.value })} placeholder="What it's for" />
      </label>
      <div className="setting-row">
        <span className="setting-text">
          <span className="setting-label">How models are used</span>
          <span className="setting-hint">{l.mode === 'auto' ? 'Picks the best of these for each message (like Auto).' : 'Always the first one; the next takes over if it fails or hits a limit.'}</span>
        </span>
        <div className="segmented">
          <button className={l.mode === 'order' ? 'active' : ''} onClick={() => setL({ ...l, mode: 'order' })}>In order</button>
          <button className={l.mode === 'auto' ? 'active' : ''} onClick={() => setL({ ...l, mode: 'auto' })}>Best for each</button>
        </div>
      </div>
      <div className="field-block">
        <span className="setting-label">Models{l.mode === 'order' ? ' (first is used first)' : ''}</span>
        <ul className="model-list">
          {l.models.length === 0 && <li className="muted small pad">Add models below.</li>}
          {l.models.map((id, i) => {
            const m = models.find((x) => x.id === id);
            return (
              <li key={id} className="model-row">
                <span className="model-meta">
                  <span className="model-title">{m?.label || modelLabel(catalog, id)}</span>
                  <span className="model-sub">{m ? PROVIDER_NAMES[m.provider] : 'Not available with your keys'}</span>
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
          <input type="search" placeholder="Add a model (e.g. coder, flash, groq)" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {query && (
          <ul className="model-list add">
            {matches.length === 0 && <li className="muted small pad">No matches.</li>}
            {matches.map((m) => (
              <li key={m.id} className="model-row">
                <span className="model-meta">
                  <span className="model-title">{m.label}</span>
                  <span className="model-sub">{PROVIDER_NAMES[m.provider]} · {m.name}</span>
                </span>
                <button className="icon-btn sm" onClick={() => setL({ ...l, models: [...l.models, m.id] })} aria-label={`Add ${m.label}`}><Plus size={17} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <label className="field-block">
        <span className="setting-label">Instructions (optional)</span>
        <span className="setting-hint">Added for every model in this layout, on top of your own instructions.</span>
        <textarea dir="auto" rows={4} value={l.instructions || ''} maxLength={2000} onChange={(e) => setL({ ...l, instructions: e.target.value })} style={{ minHeight: 0 }} />
      </label>
      <div className="editor-actions">
        <button className="btn ghost" onClick={onDone}>Cancel</button>
        <button className="btn primary" disabled={!l.name.trim() || !l.models.length} onClick={save}>Save layout</button>
      </div>
    </div>
  );
}

function Card({ l, onEdit, onCopy }: { l: Layout; onEdit: () => void; onCopy: () => void }) {
  const catalog = useStore((s) => s.catalog);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const id = LAYOUT_PREFIX + l.id;
  const available = l.models.filter((m) => catalog?.models.some((x) => x.id === m));
  const isDefault = settings.defaultModel === id;
  const saved = settings.layouts || [];
  const remove = () => {
    if (!confirm(l.builtin ? `Remove the recommended "${l.name}" layout? You can bring it back later.` : `Delete the "${l.name}" layout?`)) return;
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
  const update = useStore((s) => s.updateSettings);
  const all = allLayouts(catalog?.models || [], custom, hidden);
  const copyOf = (l: Layout): Layout => ({ ...l, id: newLayoutId(), name: `${l.name} (copy)`.slice(0, 40), builtin: undefined, edited: undefined });
  const removed = hidden.filter((id) => RECOMMENDED_IDS.includes(id)).length;

  return (
    <div className="settings-group layouts-tab">
      <div className="settings-group-title">
        <span>Layouts</span>
        <button className="link-btn small" onClick={() => onEdit({ id: newLayoutId(), name: '', icon: 'layers', description: '', models: [], mode: 'order' })}>
          <Plus size={14} /> New layout
        </button>
      </div>
      {all.length === 0 ? (
        <div className="settings-card pad-card">
          <p className="muted small" style={{ margin: 0 }}>No layouts. Create one{removed ? ', or bring back the recommended ones' : ''}.</p>
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
      {removed > 0 && (
        <button className="btn ghost small restore-btn" onClick={() => update({ hiddenLayouts: [] })}>
          <RotateCcw size={14} /> Bring back {removed} removed recommended layout{removed === 1 ? '' : 's'}
        </button>
      )}
    </div>
  );
}
