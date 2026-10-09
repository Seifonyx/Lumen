import { ArrowDown, ArrowUp, Copy, Pencil, Plus, Search, Star, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { allLayouts, LAYOUT_ICONS, LAYOUT_PREFIX, newLayoutId, recommendedLayouts, type Layout } from '../lib/layouts';
import { PROVIDER_NAMES } from '../lib/util';
import { modelLabel, useStore } from '../store';
import LayoutIcon from './LayoutIcon';

function Editor({ start, onDone }: { start: Layout; onDone: () => void }) {
  const catalog = useStore((s) => s.catalog);
  const layouts = useStore((s) => s.settings.layouts) || [];
  const update = useStore((s) => s.updateSettings);
  const [l, setL] = useState<Layout>({ ...start, builtin: undefined });
  const [query, setQuery] = useState('');
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
    <div className="layout-editor">
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

function Card({ l, onEdit, onCopy, onDelete, showDelete }: { l: Layout; onEdit?: () => void; onCopy: () => void; onDelete?: () => void; showDelete?: boolean }) {
  const catalog = useStore((s) => s.catalog);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const id = LAYOUT_PREFIX + l.id;
  const available = l.models.filter((m) => catalog?.models.some((x) => x.id === m));
  const isDefault = settings.defaultModel === id;
  return (
    <li className="layout-card">
      <span className="layout-icon"><LayoutIcon icon={l.icon} size={18} /></span>
      <div className="layout-main">
        <div className="layout-title">
          {l.name}
          <span className="tag">{l.mode === 'auto' ? 'best for each' : 'in order'}</span>
          {l.builtin && <span className="tag small">Recommended</span>}
        </div>
        <div className="setting-hint">{l.description}</div>
        <div className="layout-models">
          {available.length ? available.map((m) => <span key={m} className="chip">{modelLabel(catalog, m)}</span>) : <span className="muted small">No models available with your keys yet.</span>}
        </div>
      </div>
      <div className="layout-actions">
        <button className={`icon-btn sm star${isDefault ? ' on' : ''}`} onClick={() => update({ defaultModel: isDefault ? 'auto' : id })} aria-label="Use for new chats" title={isDefault ? 'Default for new chats' : 'Use for new chats'}>
          <Star size={16} fill={isDefault ? 'currentColor' : 'none'} />
        </button>
        {onEdit ? (
          <button className="icon-btn sm" onClick={onEdit} aria-label={`Edit ${l.name}`} title="Edit"><Pencil size={15} /></button>
        ) : (
          <button className="icon-btn sm" onClick={onCopy} aria-label={`Customize ${l.name}`} title="Customize (makes your own copy)"><Pencil size={15} /></button>
        )}
        {!l.builtin && (
          <button className="icon-btn sm" onClick={onCopy} aria-label={`Copy ${l.name}`} title="Duplicate"><Copy size={15} /></button>
        )}
        {showDelete && (
          <button
            className="icon-btn sm"
            onClick={onDelete}
            aria-label={l.builtin ? `Hide ${l.name}` : `Delete ${l.name}`}
            title={l.builtin ? "Remove this recommended layout" : "Delete this layout"}
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </li>
  );
}

export default function LayoutsTab() {
  const catalog = useStore((s) => s.catalog);
  const custom = useStore((s) => s.settings.layouts) || [];
  const hiddenLayouts = useStore((s) => s.settings.hiddenLayouts) || [];
  const update = useStore((s) => s.updateSettings);
  const [editing, setEditing] = useState<Layout | null>(null);
  const recommended = recommendedLayouts(catalog?.models || [], hiddenLayouts);
  const copyOf = (l: Layout): Layout => ({ ...l, id: newLayoutId(), name: `${l.name} (mine)`.slice(0, 40), builtin: undefined });

  if (editing) return <Editor start={editing} onDone={() => setEditing(null)} />;
  return (
    <div className="settings-section layouts-tab" style={{ padding: 0 }}>
      <div className="section-head">
        <h3>Your layouts</h3>
        <button className="btn small" onClick={() => setEditing({ id: newLayoutId(), name: '', icon: 'layers', description: '', models: [], mode: 'order' })}>
          <Plus size={15} /> New layout
        </button>
      </div>
      <p className="muted small" style={{ marginBottom: '1rem' }}>
        Pick a layout from the model menu like any model. ★ makes it the default for new chats. Recommended layouts use the best models you have; customize one to make your own editable copy.
      </p>
      {custom.length === 0 ? (
        <p className="muted small" style={{ marginBottom: '1.5rem' }}>None yet. Create one, or customize a recommended layout below.</p>
      ) : (
        <ul className="layout-list" style={{ marginBottom: '1.5rem' }}>
          {custom.map((l) => (
            <Card 
              key={l.id} 
              l={l} 
              showDelete 
              onEdit={() => setEditing(l)} 
              onCopy={() => setEditing(copyOf(l))} 
              onDelete={() => {
                if (!confirm(`Delete the "${l.name}" layout?`)) return;
                const isDefault = useStore.getState().settings.defaultModel === LAYOUT_PREFIX + l.id;
                update({ 
                  layouts: (useStore.getState().settings.layouts || []).filter((x) => x.id !== l.id), 
                  ...(isDefault ? { defaultModel: 'auto' } : {}) 
                });
              }} 
            />
          ))}
        </ul>
      )}
      <div className="section-head">
        <h3>Recommended</h3>
      </div>
      <ul className="layout-list">
        {recommended.map((l) => (
          <Card 
            key={l.id} 
            l={l} 
            showDelete 
            onCopy={() => setEditing(copyOf(l))}
            onDelete={() => {
              if (!confirm(`Hide the "${l.name}" recommended layout?`)) return;
              update({ hiddenLayouts: [...new Set([...hiddenLayouts, l.id])] });
            }} 
          />
        ))}
      </ul>
      {hiddenLayouts.length > 0 && (
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-start' }}>
          <button 
            className="btn small ghost" 
            onClick={() => update({ hiddenLayouts: [] })}
          >
            Reset recommended layouts
          </button>
        </div>
      )}
      {allLayouts(catalog?.models || [], custom, hiddenLayouts).length > 0 && !catalog?.providers.groq && !catalog?.providers.cerebras && (
        <p className="muted small" style={{ marginTop: '1rem' }}>Tip: add free Groq and Cerebras keys (API keys) for the Fastest and Max coding layouts.</p>
      )}
    </div>
  );
}
