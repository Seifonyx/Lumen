import { ArrowDown, ArrowUp, Copy, Pencil, Plus, RotateCcw, Search, Sparkles, Star, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  deleteLayout,
  generateLayout,
  LAYOUT_ICONS,
  LAYOUT_PREFIX,
  NEEDS,
  newLayoutId,
  recommendedLayouts,
  resetLayout,
  restoreRecommended,
  saveLayout,
  type Layout,
  type LayoutState,
  type Need,
} from '../lib/layouts';
import { PROVIDER_NAMES } from '../lib/util';
import { modelLabel, useStore } from '../store';
import LayoutIcon from './LayoutIcon';

/** Current layout data from settings, plus one place to save changes back. */
function useLayoutState() {
  const custom = useStore((s) => s.settings.layouts) || [];
  const edits = useStore((s) => s.settings.layoutEdits) || {};
  const hidden = useStore((s) => s.settings.layoutHidden) || [];
  const update = useStore((s) => s.updateSettings);
  const state: LayoutState = { custom, overrides: { edits, hidden } };
  const commit = (next: LayoutState, extra: { defaultModel?: string } = {}) =>
    update({ layouts: next.custom, layoutEdits: next.overrides.edits ?? {}, layoutHidden: next.overrides.hidden ?? [], ...extra });
  return { state, commit };
}

function Editor({ start, onDone }: { start: Layout; onDone: () => void }) {
  const catalog = useStore((s) => s.catalog);
  const { state, commit } = useLayoutState();
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
    commit(saveLayout(l, state));
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
          {l.models.map((id,
