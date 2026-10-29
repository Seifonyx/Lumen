import { ArrowDown, ArrowUp, MoreHorizontal, Plus, RefreshCw, Search, Star, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { choosePreference } from '../lib/ai/preferences.js';
import type { Layout } from '../lib/layouts';
import { PROVIDER_NAMES, providerOfId, type ProviderId } from '../lib/util';
import { useStore } from '../store';
import type { ModelInfo, Settings } from '../types';
import CatalogErrorNotice from './CatalogErrorNotice';
import FilterMenu from './FilterMenu';
import LayoutsSection, { LayoutEditor } from './LayoutsTab';
import ModelCheck, { LAST_CHECK_KEY } from './ModelCheck';
import ModelDeclarations from './ModelDeclarations';
import { Badges } from './ModelPicker';
import RemovedModels from './RemovedModels';
import Toggle from './SettingToggle';

const ctx = (n: number | null) => (n ? (n >= 1_000_000 ? `${Math.round(n / 1_000_000)}M` : `${Math.round(n / 1000)}K`) : '');

/** Saved models, routing and model health. Settings shows every view; Router's Routing section shows `only="routing"`
 * (no Layouts view, which Router has as its own section). Same store owners either way. */
export default function ModelsTab({ only }: { only?: 'routing' } = {}) {
  const catalog = useStore((s) => s.catalog);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const loadCatalog = useStore((s) => s.loadCatalog);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);
  const [removedOpen, setRemovedOpen] = useState(false);
  const lastCheck = Number((() => { try { return localStorage.getItem(LAST_CHECK_KEY); } catch { return 0; } })()) || 0;
  const [editing, setEditing] = useState<Layout | null>(null);
  const [filter, setFilter] = useState<'all' | ProviderId>('all');
  const [view, setView] = useState<'saved' | 'browse' | 'layouts'>(() => useStore.getState().settingsTab === 'layouts' ? 'layouts' : 'saved');
  const [actions, setActions] = useState<string | null>(null);
  const [visibleModels, setVisibleModels] = useState(24);
  const enabled = settings.enabledModels;
  const find = (id: string) => catalog?.models.find((m) => m.id === id);

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (catalog?.models || []).filter((m) => !enabled.includes(m.id) && (!q || `${m.label} ${m.name}`.toLowerCase().includes(q)));
  }, [catalog, enabled, query]);

  const move = (i: number, d: number) => {
    const next = [...enabled];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    update({ enabledModels: next });
  };
  const remove = (id: string) => {
    const next = enabled.filter((x) => x !== id);
    update({ enabledModels: next, defaultModel: settings.defaultModel === id ? next[0] || '' : settings.defaultModel });
  };
  const add = (id: string) => update({ enabledModels: [...enabled, id], defaultModel: settings.defaultModel || id });

  const providers = Object.keys(PROVIDER_NAMES) as ProviderId[];
  const connected = providers.filter((p) => catalog?.providers[p]);
  const missing = catalog ? providers.filter((p) => !catalog.providers[p]) : [];
  const shown = available.filter((m) => filter === 'all' || m.provider === filter);

  if (editing) return <div className="settings-section"><LayoutEditor start={editing} onDone={() => setEditing(null)} /></div>;
  return (
    <div className="settings-section models-settings">
      {!only && <div className="models-nav" role="group" aria-label="Model settings">
        {([['saved', 'Your models'], ['browse', 'Browse models'], ['layouts', 'Layouts']] as const).map(([value, label]) => (
          <button key={value} aria-pressed={view === value} className={view === value ? 'active' : ''} onClick={() => { setView(value); setActions(null); }}>{label}</button>
        ))}
      </div>}
      {view === 'saved' && <>
      {(() => {
        const routingGroup = <>
      <div className="settings-group">
        <span className="settings-group-title">{only ? 'How models are chosen' : 'Routing'}</span>
        <div className="settings-card">
          <Toggle
            label="Switch models automatically"
            hint="Use the next model if a request fails or reaches its limit."
            checked={settings.autoSwitch}
            onChange={(v) => update({ autoSwitch: v })}
          />
          <Toggle
            label="Auto for new chats"
            hint="Choose the best saved model for each message."
            checked={settings.defaultModel === 'auto'}
            onChange={(v) => update({ defaultModel: v ? 'auto' : enabled[0] || '' })}
          />
          <div className="setting-row">
            <span className="setting-text"><span className="setting-label">Routing priority</span><span className="setting-hint">Your request takes priority. Cost uses reported prices; missing prices stay unknown.</span></span>
            <span className="setting-ctrl"><select aria-label="Routing priority" value={choosePreference(settings.routingPreference)} onChange={e=>update({routingPreference:e.target.value as Settings['routingPreference']})}>
              <option value="balanced">Balanced</option><option value="quality">Quality</option><option value="speed">Speed</option><option value="cost">Cost</option>
            </select></span>
          </div>
          <div className="setting-row">
            <span className="setting-text">
              <span className="setting-label">Auto prefers</span>
              <span className="setting-hint">When models are close, lean towards this provider.{settings.autoExcluded?.length ? ` ${settings.autoExcluded.length} model${settings.autoExcluded.length === 1 ? ' is' : 's are'} kept out of Auto.` : ''}</span>
            </span>
            <span className="setting-ctrl">
              <select aria-label="Provider Auto prefers" value={settings.autoPreferProvider || ''} onChange={(e) => update({ autoPreferProvider: e.target.value || undefined })}>
                <option value="">No preference</option>
                {[...new Set(enabled.map((id) => id.split(':')[0]))].filter((p) => p !== 'auto' && !p.startsWith('layout')).map((p) => <option key={p} value={p}>{PROVIDER_NAMES[providerOfId(`${p}:x`)] || p}</option>)}
              </select>
            </span>
          </div>
        </div>
      </div>

      </>;
        const declarations = <>
      <ModelDeclarations />
      </>;
        const healthGroup = <>
      <div className="settings-group">
        <span className="settings-group-title">Model health</span>
        <div className="settings-card model-health">
          <div className="setting-row">
            <span className="setting-text">
              <span className="setting-label">Check your models</span>
              <span className="setting-hint">{lastCheck ? `Last checked ${new Date(lastCheck).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}. ` : ''}Removes models that can’t answer, like retired ones or ones that need payment.</span>
            </span>
            <span className="setting-ctrl"><button className="btn small" disabled={!catalog?.models.length} onClick={() => setCheckOpen(true)}>Check models</button></span>
          </div>
          {!!settings.unavailableModels?.length && (
            <div className="setting-row">
              <span className="setting-text">
                <span className="setting-label">{settings.unavailableModels.length} model{settings.unavailableModels.length === 1 ? '' : 's'} removed</span>
                <span className="setting-hint">Hidden from your lists and from Auto. See why, or bring any back.</span>
              </span>
              <span className="setting-ctrl"><button className="btn small" onClick={() => setRemovedOpen(true)}>Review</button></span>
            </div>
          )}
        </div>
      </div>

      </>;
        const yourModels = <>
      <div className="settings-group">
        <div className="settings-group-title">
          <span>{only ? 'Fallback order' : 'Your models'}</span>
          <span className="count-pill">{enabled.length}</span>
        </div>
        <div className="settings-card">
          <ul className="model-list" style={{ border: 0, margin: 0, borderRadius: 0 }}>
            {enabled.length === 0 && <li className="models-empty"><span>No models saved yet</span><p>Browse models from your connected providers to get started.</p><button className="btn small" onClick={() => setView('browse')}><Plus size={14} /> Browse models</button></li>}
            {enabled.map((id, i) => {
              const m = find(id);
              return (
                <li key={id} className="model-row saved-model">
                  <button className={`icon-btn sm star${settings.defaultModel === id ? ' on' : ''}`} onClick={() => update({ defaultModel: id })} aria-label="Make default" title="Default for new chats">
                    <Star size={16} fill={settings.defaultModel === id ? 'currentColor' : 'none'} />
                  </button>
                  <span className="model-meta">
                    <span className="model-title">{m?.label || id.split(':').slice(1).join(':')}</span>
                    <span className="model-sub">
                      {m ? PROVIDER_NAMES[m.provider] : 'Not available right now'}
                      {m?.context ? ` · ${ctx(m.context)} context` : ''}{m?.metadata?.verification==='unchecked'?' · Declared details · unchecked':''}{m?.metadata?.stale?' · Cached details':''}
                      {settings.autoExcluded?.includes(id) ? ' · not in Auto' : ''}
                    </span>
                  </span>
                  <button className="icon-btn sm model-options" aria-label={`Options for ${m?.label || id}`} aria-expanded={actions === id} aria-controls={`model-actions-${i}`} onClick={() => setActions(actions === id ? null : id)}><MoreHorizontal size={18} /></button>
                  {actions === id && <div className="model-row-actions" id={`model-actions-${i}`}>
                    <button className="btn ghost small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp size={14} /> Up</button>
                    <button className="btn ghost small" onClick={() => move(i, 1)} disabled={i === enabled.length - 1} aria-label="Move down"><ArrowDown size={14} /> Down</button>
                    <button className="btn ghost small" onClick={() => useStore.getState().setAutoExcluded(id, !settings.autoExcluded?.includes(id))}>{settings.autoExcluded?.includes(id) ? 'Use in Auto' : 'Not in Auto'}</button>
                    <button className="btn ghost small danger" onClick={() => { remove(id); setActions(null); }} aria-label="Remove"><X size={14} /> Remove</button>
                  </div>}
                </li>
              );
            })}
          </ul>
          <p className="card-note">★ sets the default. Reorder models from their options to change the fallback order.</p>
        </div>
        <button className="btn ghost small models-browse-link" onClick={() => setView('browse')}><Plus size={14} /> Add a model</button>
      </div>
      </>;
        // Router leads with what decides the next message: the switches, then the fallback order.
        return only ? <>{routingGroup}{yourModels}{healthGroup}{declarations}</> : <>{routingGroup}{declarations}{healthGroup}{yourModels}</>;
      })()}
      </>}

      {checkOpen && <ModelCheck onClose={() => setCheckOpen(false)} />}
      {removedOpen && <RemovedModels onClose={() => setRemovedOpen(false)} />}
      {view === 'layouts' && <LayoutsSection onEdit={setEditing} />}

      {view === 'browse' &&
      <div className="settings-group">
        {only && <button type="button" className="btn ghost small models-back" onClick={() => setView('saved')}>Back to routing</button>}
        <div className="settings-group-title">
          <span>Add models</span>
          <button className="link-btn small" disabled={refreshing} onClick={async () => { setRefreshing(true); await loadCatalog(); setRefreshing(false); }}>
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} /> Refresh
          </button>
        </div>
        <div className="settings-card pad-card">
          <CatalogErrorNotice placement="models" />
          <div className="list-toolbar">
            <label className="search">
              <Search size={16} />
              <input type="search" aria-label="Search available models" placeholder="Search models" value={query} onChange={(e) => { setQuery(e.target.value); setVisibleModels(24); }} />
            </label>
            {connected.length > 1 && (
              <FilterMenu<'all' | ProviderId> label="Provider" value={filter} onChange={(p) => { setFilter(p); setVisibleModels(24); }} options={[
                { value: 'all', label: 'All providers', count: available.length },
                ...connected.map((p) => ({ value: p, label: PROVIDER_NAMES[p], count: available.filter((m) => m.provider === p).length })),
              ]} />
            )}
          </div>
          <ul className="model-list add">
            {shown.length === 0 && <li className="muted small pad">{query || filter !== 'all' ? 'No matches.' : 'All added.'}</li>}
            {shown.slice(0, visibleModels).map((m) => (
              <li key={m.id} className="model-row">
                <span className="model-meta">
                  <span className="model-title">{m.label}{m.preview && <span className="tag">preview</span>}</span>
                  <span className="model-sub">{PROVIDER_NAMES[m.provider]}{m.context ? ` · ${ctx(m.context)} context` : ''}</span>
                </span>
                <Badges m={m} />
                <button className="icon-btn sm" onClick={() => add(m.id)} aria-label={`Add ${m.label}`}><Plus size={17} /></button>
              </li>
            ))}
          </ul>
          {shown.length > visibleModels && <button className="btn ghost small" onClick={() => setVisibleModels((n) => n + 24)}>Show more models ({shown.length - visibleModels})</button>}
          {missing.length > 0 && (
            <p className="muted small" style={{ margin: 0 }}>
              Not connected: {missing.map((p) => PROVIDER_NAMES[p]).join(', ')}. Add a key {only ? 'in Providers' : 'under API keys'} to use {missing.length === 1 ? 'its' : 'their'} models.
            </p>
          )}
          <p className="muted small legend" style={{ margin: 0 }}>
            Icons: <Badges m={{ vision: true } as ModelInfo} /> reads images · <Badges m={{ search: true } as ModelInfo} /> web search · <Badges m={{ thinking: true } as ModelInfo} /> thinks first
          </p>
        </div>
      </div>}
    </div>
  );
}
