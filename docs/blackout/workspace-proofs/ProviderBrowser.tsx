// Shared, proof-only provider experience. Account data and mutations stay with Lumen's owners.
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, ChevronRight, Search, X } from 'lucide-react';
import { useStore } from '../../../src/store';
import { AI_PROVIDERS, EXTRA_PROVIDERS, providerEnabled } from '../../../src/lib/ai/provider-config.js';
import { PROVIDER_NAMES, providerOfId } from '../../../src/lib/util';
import { modelProblem } from '../../../src/lib/ai/eligibility.js';
import { formatTokens, remaining } from '../../../src/lib/usage';
import type { ModelInfo } from '../../../src/types';
import FilterMenu from '../../../src/components/FilterMenu';

const providerId = (model: ModelInfo) => model.provider === 'google' ? 'gemini' : model.provider;
const providerLabel = (id: string) => id === 'gemini' ? 'Google AI Studio' : PROVIDER_NAMES[providerOfId(id + ':')] || id;
type State = ReturnType<typeof useStore.getState>;
function selectionProblem(state: State, model: ModelInfo) {
  const id = providerId(model);
  if (!state.authed || !state.user) return 'Sign in to choose a model.';
  if (!providerEnabled(id, state.keys)) return 'Save a key and enable this provider first.';
  if (!state.settings.enabledModels.includes(model.id)) return 'Enable this model in Settings → Models first.';
  if (!state.catalog?.models.some(m => m.id === model.id) || state.settings.unavailableModels?.includes(model.id) || state.catalog.deniedModelIds?.includes(model.id)) return 'This model is unavailable for this account.';
  if (state.catalog.providerStatus?.[id]?.errorKind === 'auth') return 'Update this provider’s connection first.';
  const problem = modelProblem(model);
  return problem ? `This model ${problem}.` : null;
}

/** The same account/permission gate serves catalog and provider-detail actions. */
export function ProofModelAction({ model, onSelected }: { model: ModelInfo; onSelected: () => void }) {
  const state = useStore(), owner = state.user?.uid;
  const problem = selectionProblem(state, model);
  return <div className="proof-model-action"><button type="button" disabled={Boolean(problem)} aria-label={`Use ${model.label}`} aria-describedby={problem ? `reason-${model.id}` : undefined} onClick={() => {
    const fresh = useStore.getState();
    if (fresh.user?.uid !== owner || selectionProblem(fresh, model)) return;
    fresh.setChatModel(model.id); // Canonical manual selection; send-time routing still owns eligibility/recovery.
    onSelected();
  }}>Use model <ArrowUpRight size={14}/></button>{problem && <small id={`reason-${model.id}`}>{problem}</small>}</div>;
}

export default function ProviderBrowser({ onManage, onSelected }: { onManage: (id: string) => void; onSelected: () => void }) {
  const keys = useStore(s => s.keys), catalog = useStore(s => s.catalog), usage = useStore(s => s.usage);
  const [selected, setSelected] = useState<string | null>(null), [query, setQuery] = useState(''), [filter, setFilter] = useState<'all' | 'configured'>('all');
  const input = useRef<HTMLInputElement>(null), title = useRef<HTMLHeadingElement>(null), list = useRef<HTMLDivElement>(null);
  useEffect(() => { if (selected) title.current?.focus({ preventScroll: true }); }, [selected]);
  const providers = AI_PROVIDERS.map(id => {
    const raw = keys[id as keyof typeof keys];
    const keySaved = typeof raw === 'string' && Boolean(raw.trim());
    const enabled = providerEnabled(id, keys);
    const models = (catalog?.models || []).filter(m => providerId(m) === id);
    const status = catalog?.providerStatus?.[id];
    return { id, label: providerLabel(id), keySaved, enabled, models, status };
  }).sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.label.localeCompare(b.label));
  const configured = providers.filter(p => p.enabled).length;
  const visible = providers.filter(p => (filter === 'all' || p.enabled) && `${p.label} ${p.id}`.toLowerCase().includes(query.trim().toLowerCase()));
  // Desktop has a useful first detail; phone opens a dedicated detail only after an explicit tap.
  const active = providers.find(p => p.id === selected) || providers[0];
  const discovery = (state?: string) => state === 'ready' ? 'Catalog ready' : state === 'stale' ? 'Cached catalog' : state === 'error' ? 'Discovery failed' : 'Not checked';
  const clear = () => { setQuery(''); input.current?.focus(); };
  const close = () => {
    const previous = selected; setSelected(null);
    requestAnimationFrame(() => list.current?.querySelector<HTMLButtonElement>(`[data-provider-browse="${previous}"]`)?.focus({ preventScroll: true }));
  };
  const observed = Object.values(usage?.models || {}).filter(m => m.id.split(':')[0] === active.id);
  const requests = observed.reduce((n, m) => n + m.requests, 0), tokens = observed.reduce((n, m) => n + m.input + m.output, 0);
  const knownLimits = observed.filter(m => m.quota !== null);
  const hasSharedLimit = active.id === 'openrouter' && usage?.openrouter.limit !== null && usage?.openrouter.limit !== undefined;
  const sharedLeft = hasSharedLimit ? Math.max(0, usage!.openrouter.limit! - usage!.openrouter.used) : null;
  const errorHint = active.status?.errorKind === 'auth' ? 'The saved connection was refused. Update it in connection settings.' : active.status?.state === 'stale' ? 'Showing cached models. Discovery has not refreshed successfully.' : active.status?.state === 'error' ? 'Model discovery did not complete. Inspect the connection in Settings.' : !active.keySaved ? 'Add a key to discover models for this account.' : !active.enabled ? 'Permission is off. Enable this provider in connection settings.' : 'Model discovery and inference are separate checks.';
  const formatDate = (at: number) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }).format(at);
  const extra = EXTRA_PROVIDERS[active.id as keyof typeof EXTRA_PROVIDERS];
  return <section className={`proof-provider-browser${selected ? ' has-detail' : ''}`} aria-label="Provider browser">
    <div className="proof-provider-list" ref={list}>
      <div className="proof-panel-title"><div><h2>Providers</h2><p className="proof-muted">{configured} configured · {providers.length} supported</p></div><FilterMenu<'all' | 'configured'> label="Filter providers" value={filter} onChange={setFilter} options={[{value:'all',label:'All providers',count:providers.length},{value:'configured',label:'Configured',count:configured}]}/></div>
      <div className="proof-provider-search"><Search size={16} aria-hidden="true"/><input ref={input} type="search" aria-label="Find a provider" placeholder="Find a provider" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button type="button" aria-label="Clear provider search" onClick={clear}><X size={16}/></button>}</div>
      <p className="proof-provider-count" role="status">{visible.length} of {providers.length} providers</p>
      <div className="proof-provider-scroll" tabIndex={0} aria-label="Provider list">
        {visible.map(p => <button type="button" key={p.id} data-provider-browse={p.id} aria-current={active.id === p.id ? 'true' : undefined} onClick={() => setSelected(p.id)}>
          <span className="proof-provider-initial" aria-hidden="true">{p.label.slice(0, 1)}</span><span><strong>{p.label}</strong><small>{p.keySaved ? p.enabled ? 'Key saved · enabled' : 'Key saved · permission off' : 'No key saved'}</small><span className="proof-provider-discovery">{discovery(p.status?.state)} · {p.models.length} models</span></span><ChevronRight size={16} aria-hidden="true"/>
        </button>)}
        {!visible.length && <div className="proof-provider-empty"><p>No providers match.</p><button type="button" className="proof-link" onClick={() => { setFilter('all'); clear(); }}>Reset provider filters</button></div>}
      </div>
    </div>
    <section className="proof-provider-detail" aria-label="Provider detail">
      <button type="button" className="proof-link proof-provider-back" onClick={close}><ArrowLeft size={16}/> Back to providers</button>
      <header className="proof-provider-detail-head"><div><span className="proof-section-label">PROVIDER / {active.id}</span><h2 tabIndex={-1} ref={title}>{active.label}</h2></div><button type="button" className="proof-primary" aria-label={`Manage ${active.label} connection`} onClick={() => onManage(active.id)}>Manage<span className="proof-connection-long"> connection</span> <ArrowUpRight size={15}/></button></header>
      <p className="proof-muted">{extra?.hint || 'Your own API key, managed in Lumen’s connection settings.'}</p>
      <dl className="proof-provider-facts">
        <div><dt>Saved connection</dt><dd>{active.keySaved ? 'Key saved' : 'No key saved'}</dd></div>
        <div><dt>Permission</dt><dd>{active.enabled ? 'Enabled' : active.keySaved ? 'Permission off' : 'Not configured'}</dd></div>
        <div><dt>Model discovery</dt><dd>{discovery(active.status?.state)}</dd></div>
        <div><dt>Inference readiness</dt><dd>Not established by discovery</dd></div>
      </dl>
      <p className="proof-provider-notice">{errorHint}{active.status?.lastSuccess ? <span> Last successful discovery: {formatDate(active.status.lastSuccess)} (Cairo).</span> : null}</p>
      <div className="proof-provider-usage"><div><span>Requests recorded in Lumen</span><strong>{usage ? `${requests} requests` : 'Unknown'}</strong></div><div><span>Tokens recorded in Lumen</span><strong>{usage ? formatTokens(tokens) : 'Unknown'}</strong></div><div><span>Request allowance</span><strong>{sharedLeft !== null ? `${sharedLeft} requests remaining` : knownLimits.length ? 'Per-model limits below' : 'Unknown'}</strong></div></div>
      <details className="proof-provider-count-note"><summary>About these counts</summary><p className="proof-muted">{sharedLeft !== null ? `One shared allowance for OpenRouter free models: ${usage!.openrouter.used} of ${usage!.openrouter.limit} requests recorded. Paid models are excluded.` : knownLimits.length ? 'Known limits belong to individual models; they are not a combined provider balance.' : 'No provider allowance is reported in this account’s current usage data.'} Counts reflect Lumen activity, not account-wide billing or proof of successful replies. Token counts may include estimates; provider billing may differ.</p></details>
      <div className="proof-panel-title"><h3>Model inventory</h3><span className="proof-muted">{active.models.length} catalog models</span></div>
      <p className="proof-muted">Use a model for this conversation. Request compatibility, limits and your existing fallback rules are checked when you send.</p>
      <div className="proof-provider-models">{active.models.map(m => {
        const left = remaining(usage, m.id), count = usage?.models[m.id];
        return <article className="proof-provider-model" key={m.id}><div><h4>{m.label}</h4><code>{m.id}</code><p>{m.context ? `${formatTokens(m.context)} context` : 'Context unknown'}{m.metadata?.verification === 'unchecked' ? ' · Declared, unchecked' : ''}{m.metadata?.stale ? ' · Cached metadata' : ''}</p><p>{left === null ? 'Allowance unknown' : `${left} requests remaining${m.id.startsWith('openrouter:') && m.id.endsWith(':free') ? ' · shared free-model pool' : ' · model limit'}`}{count?.blockedUntil && count.blockedUntil > Date.now() ? ' · Temporarily limited' : ''}</p></div><ProofModelAction model={m} onSelected={onSelected}/></article>;
      })}</div>
      {!active.models.length && <div className="proof-provider-empty"><h4>No catalog models</h4><p>{active.keySaved ? 'Open connection settings to check permissions and model discovery.' : 'Add a provider key in connection settings to discover its models.'}</p></div>}
      {knownLimits.filter(m => !active.models.some(model => model.id === m.id)).map(m => <p className="proof-muted" key={m.id}>Previously observed model {m.id}: {remaining(usage, m.id) ?? 'unknown'} requests remaining. Not in the current catalog.</p>)}
    </section>
  </section>;
}
