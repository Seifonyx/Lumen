// Shared, proof-only provider experience. Account data and mutations stay with Lumen's owners.
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, ChevronRight, Search, X } from 'lucide-react';
import { useStore } from '../../../src/store';
import { AI_PROVIDERS, providerEnabled } from '../../../src/lib/ai/provider-config.js';
import { PROVIDER_NAMES, providerOfId } from '../../../src/lib/util';
import { modelProblem } from '../../../src/lib/ai/eligibility.js';
import { formatTokens, remaining } from '../../../src/lib/usage';
import type { ModelInfo } from '../../../src/types';
import FilterMenu from '../../../src/components/FilterMenu';

const providerId = (model: ModelInfo) => model.provider === 'google' ? 'gemini' : model.provider;
const providerLabel = (id: string) => id === 'gemini' ? 'Google AI Studio' : PROVIDER_NAMES[providerOfId(id + ':')] || id;
type State = ReturnType<typeof useStore.getState>;
const idSets = new WeakMap<readonly string[], Set<string>>();
const catalogIds = new WeakMap<ModelInfo[], Set<string>>();
function includesId(ids: readonly string[] | undefined, id: string) {
  if (!ids) return false;
  let set = idSets.get(ids); if (!set) { set = new Set(ids); idSets.set(ids, set); }
  return set.has(id);
}
function selectionProblem(state: State, model: ModelInfo) {
  const id = providerId(model);
  if (!state.authed || !state.user) return 'Sign in to choose a model.';
  if (!providerEnabled(id, state.keys)) return 'Save a key and enable this provider first.';
  if (!includesId(state.settings.enabledModels, model.id)) return 'Enable this model in Settings → Models first.';
  let known = state.catalog && catalogIds.get(state.catalog.models);
  if (state.catalog && !known) { known = new Set(state.catalog.models.map(m => m.id)); catalogIds.set(state.catalog.models, known); }
  if (!known?.has(model.id) || includesId(state.settings.unavailableModels, model.id) || includesId(state.catalog?.deniedModelIds, model.id)) return 'This model is unavailable for this account.';
  if (state.catalog?.providerStatus?.[id]?.errorKind === 'auth') return 'Update this provider’s connection first.';
  const problem = modelProblem(model);
  return problem ? `This model ${problem}.` : null;
}

/** The same account/permission gate serves catalog and provider-detail actions. */
export const ProofModelAction = memo(function ProofModelAction({ model, onSelected }: { model: ModelInfo; onSelected: () => void }) {
  const owner = useStore(s => s.user?.uid);
  const problem = useStore(s => selectionProblem(s, model));
  return <div className="proof-model-action"><button type="button" disabled={Boolean(problem)} aria-label={`Use ${model.label}`} aria-describedby={problem ? `reason-${model.id}` : undefined} onClick={() => {
    const fresh = useStore.getState();
    if (fresh.user?.uid !== owner || selectionProblem(fresh, model)) return;
    fresh.setChatModel(model.id); // Canonical manual selection; send-time routing still owns eligibility/recovery.
    onSelected();
  }}>Use model <ArrowUpRight size={14}/></button>{problem && <small id={`reason-${model.id}`}>{problem}</small>}</div>;
});

export default function ProviderBrowser({ onManage, onSelected, preferredProvider }: { onManage: (id: string) => void; onSelected: () => void; preferredProvider?: string }) {
  const keys = useStore(s => s.keys), catalog = useStore(s => s.catalog), usage = useStore(s => s.usage);
  const [selected, setSelected] = useState<string | null>(preferredProvider || null), [detailOpen, setDetailOpen] = useState(false);
  const [query, setQuery] = useState(''), [filter, setFilter] = useState<'all' | 'saved' | 'enabled'>('all');
  const input = useRef<HTMLInputElement>(null), title = useRef<HTMLHeadingElement>(null), list = useRef<HTMLDivElement>(null);
  useEffect(() => { if (detailOpen) title.current?.focus({ preventScroll: true }); }, [selected, detailOpen]);
  const providers = useMemo(() => {
    const grouped = new Map<string, ModelInfo[]>();
    for (const model of catalog?.models || []) { const id = providerId(model); const group = grouped.get(id) || []; group.push(model); grouped.set(id, group); }
    return AI_PROVIDERS.map(id => {
      const raw = keys[id as keyof typeof keys];
      return { id, label: providerLabel(id), keySaved: typeof raw === 'string' && Boolean(raw.trim()), enabled: providerEnabled(id, keys), models: grouped.get(id) || [], status: catalog?.providerStatus?.[id] };
    }).sort((a, b) => Number(b.keySaved) - Number(a.keySaved) || a.label.localeCompare(b.label));
  }, [keys, catalog]);
  const enabled = providers.filter(p => p.enabled).length, saved = providers.filter(p => p.keySaved).length;
  const matches = (p: typeof providers[number], text: string, scope: typeof filter) => (scope === 'all' || (scope === 'saved' ? p.keySaved : p.enabled)) && `${p.label} ${p.id}`.toLowerCase().includes(text.trim().toLowerCase());
  const visible = providers.filter(p => matches(p, query, filter));
  // An explicit selection or the conversation provider must also belong to the visible results.
  const active = visible.find(p => p.id === selected);
  const changeResults = (text: string, scope: typeof filter) => {
    setQuery(text); setFilter(scope);
    if (!providers.some(p => p.id === selected && matches(p, text, scope))) { setSelected(null); setDetailOpen(false); }
  };
  const discovery = (state?: string) => state === 'ready' ? 'Catalog ready' : state === 'stale' ? 'Cached catalog' : state === 'error' ? 'Discovery failed' : 'Not checked';
  const clear = () => { changeResults('', filter); input.current?.focus(); };
  const close = () => { setDetailOpen(false); requestAnimationFrame(() => list.current?.querySelector<HTMLButtonElement>(`[data-provider-browse="${selected}"]`)?.focus({ preventScroll: true })); };
  const observed = Object.values(usage?.models || {}).filter(m => m.id.split(':')[0] === active?.id);
  const requests = observed.reduce((n, m) => n + m.requests, 0), tokens = observed.reduce((n, m) => n + m.input + m.output, 0);
  const knownLimits = observed.filter(m => m.quota !== null);
  const hasSharedLimit = active?.id === 'openrouter' && usage?.openrouter.limit !== null && usage?.openrouter.limit !== undefined;
  const sharedLeft = hasSharedLimit ? Math.max(0, usage!.openrouter.limit! - usage!.openrouter.used) : null;
  const problem = active?.status?.errorKind === 'auth' ? 'Connection refused. Update the saved key.' : active?.status?.state === 'stale' ? 'Cached models; discovery has not refreshed.' : active?.status?.state === 'error' ? 'Discovery did not complete. Check connection settings.' : null;
  const formatDate = (at: number) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(at);
  return <section className={`proof-provider-browser${active && detailOpen ? ' has-detail' : ''}`} aria-label="Provider browser">
    <div className="proof-provider-list" ref={list}>
      <div className="proof-panel-title"><div><h2>Providers</h2><p className="proof-muted">{saved} keys saved · {enabled} enabled</p></div><FilterMenu<typeof filter> label="Filter providers" value={filter} onChange={scope => changeResults(query, scope)} options={[{value:'all',label:'All providers',count:providers.length},{value:'saved',label:'Saved connections',count:saved},{value:'enabled',label:'Enabled providers',count:enabled}]}/></div>
      <div className="proof-provider-search"><Search size={16} aria-hidden="true"/><input ref={input} type="search" aria-label="Find a provider" placeholder="Find a provider" value={query} onChange={e => changeResults(e.target.value, filter)}/>{query && <button type="button" aria-label="Clear provider search" onClick={clear}><X size={16}/></button>}</div>
      <p className="proof-provider-count" role="status">{visible.length} of {providers.length} providers</p>
      <div className="proof-provider-scroll" tabIndex={0} aria-label="Provider list">
        {visible.map(p => <button type="button" key={p.id} data-provider-browse={p.id} aria-current={active?.id === p.id ? 'true' : undefined} onClick={() => { setSelected(p.id); setDetailOpen(true); }}>
          <span className="proof-provider-initial" aria-hidden="true">{p.label.slice(0, 1)}</span><span><strong>{p.label}</strong><small>{p.keySaved ? p.enabled ? 'Key saved · enabled' : 'Key saved · permission off' : 'No key saved'}</small><span className="proof-provider-discovery">{discovery(p.status?.state)} · {p.models.length} models</span></span><ChevronRight size={16} aria-hidden="true"/>
        </button>)}
        {!visible.length && <div className="proof-provider-empty"><p>No providers match.</p><button type="button" className="proof-link" onClick={() => { changeResults('', 'all'); input.current?.focus(); }}>Reset provider filters</button></div>}
      </div>
    </div>
    {active ? <section className="proof-provider-detail" aria-label="Provider detail">
      <button type="button" className="proof-link proof-provider-back" onClick={close}><ArrowLeft size={16}/> Back to providers</button>
      <header className="proof-provider-detail-head"><div><span className="proof-section-label">PROVIDER / {active.id}</span><h2 tabIndex={-1} ref={title}>{active.label}</h2></div><button type="button" className="proof-primary" aria-label={`Manage ${active.label} connection`} onClick={() => onManage(active.id)}>Manage<span className="proof-connection-long"> connection</span> <ArrowUpRight size={15}/></button></header>
      <dl className="proof-provider-facts">
        <div><dt>Connection</dt><dd>{active.keySaved ? 'Key saved' : 'No key saved'} · {active.enabled ? 'Enabled' : active.keySaved ? 'Permission off' : 'Not configured'}</dd></div>
        <div><dt>Discovery</dt><dd>{discovery(active.status?.state)}{active.status?.lastSuccess ? <time data-timestamp={active.status.lastSuccess} dateTime={new Date(active.status.lastSuccess).toISOString()}>{formatDate(active.status.lastSuccess)}</time> : null}</dd></div>
      </dl>
      <p className="proof-provider-notice">{problem ? `${problem} ` : ''}Discovery does not verify successful replies.</p>
      <div className="proof-provider-allowance"><span>Request allowance</span><strong>{sharedLeft !== null ? `${sharedLeft} requests remaining · shared free-model pool` : knownLimits.length ? 'Per-model limits below' : 'Unknown'}</strong></div>
      <ProviderModels key={active.id} models={active.models} onSelected={onSelected}/>
      <details className="proof-provider-count-note"><summary>Usage & provenance</summary>
        <div className="proof-provider-usage"><div><span>Requests recorded in Lumen</span><strong>{usage ? `${requests} requests` : 'Unknown'}</strong></div><div><span>Tokens recorded in Lumen</span><strong>{usage ? formatTokens(tokens) : 'Unknown'}</strong></div></div>
        <p className="proof-muted">{sharedLeft !== null ? `One shared allowance for OpenRouter free models: ${usage!.openrouter.used} of ${usage!.openrouter.limit} requests recorded. Paid models are excluded.` : knownLimits.length ? 'Known limits belong to individual models; they are not a combined provider balance.' : 'No provider allowance is reported in this account’s current usage data.'} Counts reflect Lumen activity, not account-wide billing or proof of successful replies. Token counts may include estimates; provider billing may differ. Models are checked against your request and fallback rules when you send.</p>
        {knownLimits.filter(m => !active.models.some(model => model.id === m.id)).map(m => <p className="proof-muted" key={m.id}>Previously observed model {m.id}: {remaining(usage, m.id) ?? 'unknown'} requests remaining. Not in the current catalog.</p>)}
      </details>
    </section> : <aside className="proof-provider-selection"><h3>Choose a provider</h3><p>Select a visible provider to inspect its connection, models and usage.</p></aside>}
  </section>;
}

function ProviderModels({ models, onSelected }: { models: ModelInfo[]; onSelected: () => void }) {
  const usage = useStore(s => s.usage);
  const [query, setQuery] = useState(''), [page, setPage] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => models.filter(m => `${m.label} ${m.name}`.toLowerCase().includes(query.trim().toLowerCase())), [models, query]);
  const count = Math.max(1, Math.ceil(filtered.length / 24)), currentPage = Math.min(page, count - 1);
  return <section className="proof-provider-models" aria-label="Provider models"><div className="proof-panel-title"><h3>Model inventory</h3><span>{models.length} catalog models</span></div>
    {(models.length > 24 || query) && <div className="proof-provider-search"><Search size={16} aria-hidden="true"/><input ref={input} type="search" aria-label="Find a model" placeholder="Find a model" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }}/>{query && <button type="button" aria-label="Clear model search" onClick={() => { setQuery(''); setPage(0); input.current?.focus(); }}><X size={16}/></button>}</div>}
    {filtered.slice(currentPage * 24, (currentPage + 1) * 24).map(m => {
      const left = remaining(usage, m.id), observed = usage?.models[m.id];
      return <article className="proof-provider-model" key={m.id}><div><h4>{m.label}</h4><code>{m.id}</code><p>{m.context ? `${formatTokens(m.context)} context` : 'Context unknown'}{m.metadata?.verification === 'unchecked' ? ' · Declared, unchecked' : ''}{m.metadata?.stale ? ' · Cached metadata' : ''}</p><p>{left === null ? 'Allowance unknown' : `${left} requests remaining${m.id.startsWith('openrouter:') && m.id.endsWith(':free') ? ' · shared pool' : ' · model limit'}`}{observed?.blockedUntil && observed.blockedUntil > Date.now() ? ' · Temporarily limited' : ''}</p></div><ProofModelAction model={m} onSelected={onSelected}/></article>;
    })}
    {!filtered.length && <div className="proof-provider-empty"><h4>{models.length ? 'No models match.' : 'No catalog models'}</h4><p>{models.length ? 'Clear your model search to see this provider’s catalog.' : 'Check the connection and permissions in Settings to discover models.'}</p></div>}
    {filtered.length > 24 && <nav className="proof-model-pages" aria-label="Model pages"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous models</button><span role="status">{currentPage * 24 + 1}–{Math.min(filtered.length, (currentPage + 1) * 24)} of {filtered.length}</span><button type="button" disabled={currentPage + 1 === count} onClick={() => setPage(currentPage + 1)}>Next models</button></nav>}
  </section>;
}
