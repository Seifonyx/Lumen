// CP04 Canvas Routing Center (approved Canvas direction; content from the verified provider proof). Loaded lazily
// and only while CANVAS_SHELL is on (src/lib/canvas-presentation.ts); the ordinary build never reaches it.
// Presentation only: it reads Lumen's existing catalog, keys, settings and usage and reuses its owners — manual
// selection through setChatModel, Layouts through LayoutEditor, usage through UsageTab, decisions through RouteWhy,
// connections through Settings → Keys. Send-time routing, eligibility and recovery are unchanged.
import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown, ChevronRight, Plus, Search, Shield, SlidersHorizontal, X } from 'lucide-react';
import { modelLabel, selectCurrentChat, selectCurrentModel, useStore } from '../store';
import { AI_PROVIDERS, providerEnabled } from '../lib/ai/provider-config.js';
import { modelProblem } from '../lib/ai/eligibility.js';
import { PROVIDER_NAMES, providerOfId } from '../lib/util';
import { formatTokens, remaining } from '../lib/usage';
import { closeRoutingCenter, showRoutingSection, useRoutingCenter, type RoutingSection } from '../lib/routing-center';
import type { Layout } from '../lib/layouts';
import type { ModelInfo } from '../types';
import { LayoutEditor } from './LayoutsTab';
import UsageTab from './UsageTab';
import RouteWhy from './RouteWhy';
import { routeWords } from '../lib/route-words';
import { isTemporaryChat } from '../lib/temporary-chat';
import FilterMenu from './FilterMenu';
// Tier 5 panels (usage history, request log, routing file, connection check) load on first use, in their own chunk.
const extras = () => import('./RoutingExtras');
const CheckConnection = lazy(() => extras().then((m) => ({ default: m.CheckConnection })));
const UsageHistory = lazy(() => extras().then((m) => ({ default: m.UsageHistory })));
const RequestLog = lazy(() => extras().then((m) => ({ default: m.RequestLog })));
const RoutingFile = lazy(() => extras().then((m) => ({ default: m.RoutingFile })));

const SECTIONS: [RoutingSection, string][] = [['overview', 'Overview'], ['providers', 'Providers'], ['models', 'Models'], ['policies', 'Policies'], ['usage', 'Usage'], ['diagnostics', 'Diagnostics']];
const providerId = (model: ModelInfo) => (model.provider === 'google' ? 'gemini' : model.provider);
const providerLabel = (id: string) => (id === 'gemini' ? 'Google AI Studio' : PROVIDER_NAMES[providerOfId(id + ':')] || id);
const openSettings = (tab: string) => useStore.getState().setUi({ settingsOpen: true, settingsTab: tab, sidebarOpen: false });
type State = ReturnType<typeof useStore.getState>;

/** Why this account can't choose a model right now (same gates as the picker), or null. */
function selectionProblem(state: State, model: ModelInfo) {
  const id = providerId(model);
  if (!state.authed || !state.user) return 'Sign in to choose a model.';
  if (!providerEnabled(id, state.keys)) return 'Save a key and enable this provider first.';
  if (!state.settings.enabledModels.includes(model.id)) return 'Enable this model in Settings → Models first.';
  if (!state.catalog?.models.some((m) => m.id === model.id) || state.settings.unavailableModels?.includes(model.id) || state.catalog?.deniedModelIds?.includes(model.id)) return 'This model is unavailable for this account.';
  if (state.catalog?.providerStatus?.[id]?.errorKind === 'auth') return 'Update this provider’s connection first.';
  const problem = modelProblem(model);
  return problem ? `This model ${problem}.` : null;
}

/** Choose a model for this conversation through the canonical manual selection; the account must not change. */
const UseModel = memo(function UseModel({ model }: { model: ModelInfo }) {
  const owner = useStore((s) => s.user?.uid);
  const problem = useStore((s) => selectionProblem(s, model));
  return (
    <div className="rc-use">
      <button type="button" disabled={Boolean(problem)} aria-label={`Use ${model.label}`} aria-describedby={problem ? `rc-why-${model.id}` : undefined} onClick={() => {
        const fresh = useStore.getState();
        if (fresh.user?.uid !== owner || selectionProblem(fresh, model)) return;
        fresh.setChatModel(model.id);
        closeRoutingCenter();
        // Back in the conversation (draft untouched): say the choice took.
        fresh.toast(`Now using ${model.label} in this chat`);
      }}>Use model <ArrowUpRight size={14} /></button>
      {problem && <small id={`rc-why-${model.id}`}>{problem}</small>}
    </div>
  );
});

function Providers({ preferred }: { preferred?: string }) {
  const keys = useStore((s) => s.keys), catalog = useStore((s) => s.catalog), usage = useStore((s) => s.usage);
  const [selected, setSelected] = useState<string | null>(preferred || null), [detail, setDetail] = useState(false);
  const [query, setQuery] = useState(''), [filter, setFilter] = useState<'all' | 'saved' | 'enabled'>('all');
  const input = useRef<HTMLInputElement>(null), title = useRef<HTMLHeadingElement>(null), list = useRef<HTMLDivElement>(null);
  useEffect(() => { if (detail) title.current?.focus({ preventScroll: true }); }, [selected, detail]);
  const providers = useMemo(() => {
    const grouped = new Map<string, ModelInfo[]>();
    for (const m of catalog?.models || []) { const id = providerId(m); grouped.set(id, [...(grouped.get(id) || []), m]); }
    return AI_PROVIDERS.map((id) => {
      const raw = keys[id as keyof typeof keys];
      return { id, label: providerLabel(id), keySaved: typeof raw === 'string' && Boolean(raw.trim()), enabled: providerEnabled(id, keys), models: grouped.get(id) || [], status: catalog?.providerStatus?.[id] };
    }).sort((a, b) => Number(b.keySaved) - Number(a.keySaved) || a.label.localeCompare(b.label));
  }, [keys, catalog]);
  const enabled = providers.filter((p) => p.enabled).length, saved = providers.filter((p) => p.keySaved).length;
  const matches = (p: typeof providers[number], text: string, scope: typeof filter) => (scope === 'all' || (scope === 'saved' ? p.keySaved : p.enabled)) && `${p.label} ${p.id}`.toLowerCase().includes(text.trim().toLowerCase());
  const visible = providers.filter((p) => matches(p, query, filter));
  const active = visible.find((p) => p.id === selected);
  // Providers with neither a saved key nor permission fold under one row, closed unless the current model's provider is
  // among them; a search or a filter lists everything.
  const connected = visible.filter((p) => p.keySaved || p.enabled), unconnected = visible.filter((p) => !p.keySaved && !p.enabled);
  const [unfolded, setUnfolded] = useState(() => Boolean(preferred) && !providers.some((p) => p.id === preferred && (p.keySaved || p.enabled)));
  const folding = Boolean(unconnected.length && connected.length) && !query.trim() && filter === 'all';
  const row = (p: typeof providers[number]) => (
    <button type="button" key={p.id} data-provider={p.id} aria-current={active?.id === p.id ? 'true' : undefined} onClick={() => { setSelected(p.id); setDetail(true); }}>
      <span className="rc-initial" aria-hidden="true">{p.label.slice(0, 1)}</span>
      <span><strong>{p.label}</strong><small>{p.keySaved ? (p.enabled ? 'Key saved · enabled' : 'Key saved · permission off') : p.enabled ? 'No key saved · enabled' : 'No key saved'}</small><small className="rc-discovery">{discovery(p.status?.state)} · {p.models.length} models</small></span>
      <ChevronRight size={16} aria-hidden="true" />
    </button>
  );
  const change = (text: string, scope: typeof filter) => {
    setQuery(text); setFilter(scope);
    if (!providers.some((p) => p.id === selected && matches(p, text, scope))) { setSelected(null); setDetail(false); }
  };
  const discovery = (state?: string) => (state === 'ready' ? 'Catalog ready' : state === 'stale' ? 'Cached catalog' : state === 'error' ? 'Discovery failed' : 'Not checked');
  const back = () => { setDetail(false); requestAnimationFrame(() => list.current?.querySelector<HTMLButtonElement>(`[data-provider="${selected}"]`)?.focus({ preventScroll: true })); };
  const observed = Object.values(usage?.models || {}).filter((m) => m.id.split(':')[0] === active?.id);
  const requests = observed.reduce((n, m) => n + m.requests, 0), tokens = observed.reduce((n, m) => n + m.input + m.output, 0);
  const knownLimits = observed.filter((m) => m.quota !== null);
  const sharedLeft = active?.id === 'openrouter' && usage?.openrouter.limit != null ? Math.max(0, usage.openrouter.limit - usage.openrouter.used) : null;
  const problem = active?.status?.errorKind === 'auth' ? 'Connection refused. Update the saved key.' : active?.status?.state === 'stale' ? 'Cached models; discovery has not refreshed.' : active?.status?.state === 'error' ? 'Discovery did not complete. Check connection settings.' : null;
  return (
    <section className={`rc-providers${active && detail ? ' has-detail' : ''}`} aria-label="Provider browser">
      <div className="rc-provider-list" ref={list}>
        <div className="rc-panel-title">
          <div><h2>Providers</h2><p className="rc-muted">{saved} {saved === 1 ? 'key' : 'keys'} saved · {enabled} enabled</p></div>
          <FilterMenu<typeof filter> label="Filter providers" value={filter} onChange={(scope) => change(query, scope)} options={[{ value: 'all', label: 'All providers', count: providers.length }, { value: 'saved', label: 'Saved connections', count: saved }, { value: 'enabled', label: 'Enabled providers', count: enabled }]} />
        </div>
        <div className="rc-search"><Search size={16} aria-hidden="true" /><input ref={input} type="search" aria-label="Find a provider" placeholder="Find a provider" value={query} onChange={(e) => change(e.target.value, filter)} />{query && <button type="button" aria-label="Clear provider search" onClick={() => { change('', filter); input.current?.focus(); }}><X size={16} /></button>}</div>
        <p className="rc-count" role="status">{visible.length} of {providers.length} providers</p>
        <div className="rc-provider-scroll">
          {folding ? connected.map(row) : visible.map(row)}
          {folding && (
            <div className="rc-fold">
              <button type="button" aria-expanded={unfolded} aria-controls="rc-unconnected" onClick={() => setUnfolded(!unfolded)}>
                <span><strong>Not connected</strong><small>{unconnected.length} {unconnected.length === 1 ? 'provider' : 'providers'} · no key saved</small></span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
            </div>
          )}
          {folding && <div id="rc-unconnected" className="rc-folded" hidden={!unfolded}>{unconnected.map(row)}</div>}
          {!visible.length && <div className="rc-empty"><p>No providers match.</p><button type="button" className="rc-link" onClick={() => { change('', 'all'); input.current?.focus(); }}>Reset provider filters</button></div>}
        </div>
      </div>
      {active ? (
        <section className="rc-provider-detail" aria-label="Provider detail">
          <button type="button" className="rc-link rc-back" onClick={back}><ArrowLeft size={16} /> Back to providers</button>
          <header className="rc-detail-head">
            <div><span className="rc-label">Provider · {active.id}</span><h2 tabIndex={-1} ref={title}>{active.label}</h2></div>
            <button type="button" className="rc-primary" aria-label={`Manage ${active.label} connection`} onClick={() => openSettings('keys')}>Manage <ArrowUpRight size={15} /></button>
          </header>
          <dl className="rc-facts">
            <div><dt>Connection</dt><dd>{active.keySaved ? 'Key saved' : 'No key saved'} · {active.enabled ? 'Enabled' : active.keySaved ? 'Permission off' : 'Not configured'}</dd></div>
            <div><dt>Discovery</dt><dd>{discovery(active.status?.state)}{active.status?.lastSuccess ? ` · ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(active.status.lastSuccess)}` : ''}</dd></div>
          </dl>
          <p className="rc-notice">{problem ? `${problem} ` : ''}Discovery does not verify successful replies.</p>
          {active.enabled && <Suspense fallback={null}><CheckConnection key={active.id} provider={active.id} /></Suspense>}
          <div className="rc-allowance"><span>Request allowance</span><strong>{sharedLeft !== null ? `${sharedLeft} requests remaining · shared free-model pool` : knownLimits.length ? 'Per-model limits below' : 'Unknown'}</strong></div>
          <ProviderModels key={active.id} models={active.models} />
          <details className="rc-provenance"><summary>Usage &amp; provenance</summary>
            <div className="rc-usage-pair"><div><span>Requests recorded in Lumen</span><strong>{usage ? `${requests} requests` : 'Unknown'}</strong></div><div><span>Tokens recorded in Lumen</span><strong>{usage ? formatTokens(tokens) : 'Unknown'}</strong></div></div>
            <p className="rc-muted">{sharedLeft !== null ? `One shared allowance for OpenRouter free models: ${usage!.openrouter.used} of ${usage!.openrouter.limit} requests recorded. Paid models are excluded.` : knownLimits.length ? 'Known limits belong to individual models; they are not a combined provider balance.' : 'No provider allowance is reported in this account’s current usage data.'} Counts reflect Lumen activity, not account-wide billing or proof of successful replies.</p>
          </details>
        </section>
      ) : <aside className="rc-provider-pick"><h3>Choose a provider</h3><p>Select a provider to inspect its connection, models and usage.</p></aside>}
    </section>
  );
}

function ProviderModels({ models }: { models: ModelInfo[] }) {
  const usage = useStore((s) => s.usage);
  const [query, setQuery] = useState(''), [page, setPage] = useState(0);
  const filtered = useMemo(() => models.filter((m) => `${m.label} ${m.name}`.toLowerCase().includes(query.trim().toLowerCase())), [models, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / 24)), current = Math.min(page, pages - 1);
  return (
    <section className="rc-provider-models" aria-label="Provider models">
      <div className="rc-panel-title"><h3>Models</h3><span className="rc-muted">{models.length} in catalog</span></div>
      {(models.length > 24 || query) && <div className="rc-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Find a model" placeholder="Find a model" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} /></div>}
      {filtered.slice(current * 24, (current + 1) * 24).map((m) => {
        const left = remaining(usage, m.id), seen = usage?.models[m.id];
        return (
          <article className="rc-model" key={m.id}>
            <div><h4>{m.label}</h4><code>{m.id}</code><p>{m.context ? `${formatTokens(m.context)} context` : 'Context unknown'}{m.metadata?.verification === 'unchecked' ? ' · Declared, unchecked' : ''}{m.metadata?.stale ? ' · Cached metadata' : ''}</p>
              <p>{left === null ? 'Allowance unknown' : `${left} requests remaining${m.id.startsWith('openrouter:') && m.id.endsWith(':free') ? ' · shared pool' : ' · model limit'}`}{seen?.blockedUntil && seen.blockedUntil > Date.now() ? ' · Temporarily limited' : ''}</p></div>
            <UseModel model={m} />
          </article>
        );
      })}
      {!filtered.length && <div className="rc-empty"><h4>{models.length ? 'No models match.' : 'No catalog models'}</h4><p>{models.length ? 'Clear your model search.' : 'Check the connection and permissions in Settings to discover models.'}</p></div>}
      {filtered.length > 24 && <nav className="rc-pages" aria-label="Model pages"><button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button><span role="status">{current * 24 + 1}–{Math.min(filtered.length, (current + 1) * 24)} of {filtered.length}</span><button type="button" disabled={current + 1 === pages} onClick={() => setPage(current + 1)}>Next</button></nav>}
    </section>
  );
}

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

/** Overview: the latest answer in each of your recent chats, which model gave it and why; and the providers your
 * catalog draws on right now. Read from this account's own chats, catalog and usage; nothing is estimated. */
function RecentDecisions() {
  const chats = useStore((s) => s.chats), catalog = useStore((s) => s.catalog), usage = useStore((s) => s.usage);
  const recent = useMemo(() => chats.filter((c) => !isTemporaryChat(c)).map((c) => {
    for (let i = c.messages.length - 1; i >= 0; i--) { const m = c.messages[i]; if (m.role === 'assistant' && m.model && m.status !== 'streaming') return { chat: c, m }; }
    return null;
  }).filter((x): x is NonNullable<typeof x> => Boolean(x)).sort((a, b) => b.m.createdAt - a.m.createdAt).slice(0, 5), [chats]);
  const providers = useMemo(() => {
    const now = Date.now(), by = new Map<string, { models: number; limited: number }>();
    for (const m of catalog?.models || []) {
      const p = by.get(m.provider) || { models: 0, limited: 0 };
      p.models++; if ((usage?.models[m.id]?.blockedUntil || 0) > now) p.limited++;
      by.set(m.provider, p);
    }
    return [...by].sort((a, b) => b[1].models - a[1].models);
  }, [catalog, usage]);
  const open = (id: string) => { closeRoutingCenter(); useStore.getState().selectChat(id); };
  return (
    <div className="rc-recent-grid">
      <section className="rc-card rc-recent">
        <span className="rc-label">Recent decisions</span>
        {recent.length ? <ul>{recent.map(({ chat, m }) => (
          <li key={chat.id}><button type="button" onClick={() => open(chat.id)}>
            <span className="rc-recent-model">{modelLabel(catalog, m.model!)}</span>
            <span className="rc-recent-why">{m.route ? routeWords(m.route) : 'No route recorded'}</span>
            <span className="rc-recent-chat" dir="auto">{chat.title}<span> · {ago(m.createdAt)}</span></span>
          </button></li>
        ))}</ul> : <p className="rc-muted">Answers you get will show which model gave them and why.</p>}
      </section>
      <section className="rc-card rc-recent">
        <span className="rc-label">Providers in your catalog</span>
        {providers.length ? <ul>{providers.slice(0, 6).map(([id, p]) => (
          <li key={id}><button type="button" onClick={() => showRoutingSection('providers')}>
            <span className="rc-recent-model">{PROVIDER_NAMES[id as keyof typeof PROVIDER_NAMES] || id}</span>
            <span className="rc-recent-why">{p.models} model{p.models === 1 ? '' : 's'}{p.limited ? ` · ${p.limited} temporarily limited` : ' · available'}</span>
          </button></li>
        ))}</ul> : <p className="rc-muted">No provider models yet. Connect a provider to fill your catalog.</p>}
      </section>
    </div>
  );
}

export default function RoutingCenter() {
  const { open, section } = useRoutingCenter();
  const chat = useStore(selectCurrentChat), model = useStore(selectCurrentModel);
  const catalog = useStore((s) => s.catalog), config = useStore((s) => s.settings), usage = useStore((s) => s.usage);
  const owner = useStore((s) => s.user?.uid), currentId = useStore((s) => s.currentId);
  const covered = useStore((s) => s.settingsOpen || Boolean(s.page));
  const [editing, setEditing] = useState<Layout | null>(null);
  const [query, setQuery] = useState('');
  const page = useRef<HTMLElement>(null), heading = useRef<HTMLHeadingElement>(null);
  // Another conversation or account is another context: the Routing Center closes.
  const opened = useRef({ owner, currentId });
  useEffect(() => { if (open) opened.current = { owner, currentId }; }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && (opened.current.owner !== owner || opened.current.currentId !== currentId)) closeRoutingCenter(); }, [open, owner, currentId]);
  useEffect(() => { if (open) heading.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => { setEditing(null); if (page.current) page.current.scrollTop = 0; }, [section]);
  if (!open) return null;

  const last = chat?.messages.findLast((m) => m.role === 'assistant' && m.model);
  const routed = model === 'auto' || model.startsWith('layout:');
  const current = routed ? last?.model : model;
  const left = current ? remaining(usage, current) : null;
  const models = catalog?.models || [], layouts = config.layouts || [];
  const q = query.trim().toLowerCase();
  const inventory = models.filter((m) => `${m.label} ${m.name} ${m.provider}`.toLowerCase().includes(q));

  return (
    <section ref={page} className="rc-page" hidden={covered} aria-labelledby="rc-title"
      onKeyDown={(e) => { if (e.key === 'Escape' && !e.defaultPrevented && !(e.target as Element).closest('[role="dialog"], [role="menu"], [role="listbox"], input, textarea, select')) { e.preventDefault(); closeRoutingCenter(); } }}>
      <header className="rc-head">
        <button type="button" className="rc-close" aria-label="Back to chat" onClick={closeRoutingCenter}><ArrowLeft size={18} /><span>Chat</span></button>
        <div className="rc-title">
          <span className="rc-label">Providers · Models · Policies</span>
          <h1 id="rc-title" tabIndex={-1} ref={heading}>Routing Center</h1>
          <p>Your providers, models and routing rules.</p>
        </div>
        <button type="button" className="rc-primary" aria-label="Connect a provider" onClick={() => openSettings('keys')}><Plus size={16} /><span>Connect<span className="rc-wide"> a provider</span></span></button>
      </header>
      <nav className="rc-tabs" aria-label="Routing sections">
        {SECTIONS.map(([id, label]) => <button type="button" key={id} aria-current={section === id ? 'page' : undefined} onClick={() => showRoutingSection(id)}>{label}</button>)}
      </nav>

      {section === 'overview' && (
        <div className="rc-body">
          <div className="rc-summary">
            <div><span>Models in this catalog</span><strong>{models.length}<small> models</small></strong><p>{config.enabledModels.length} enabled for selection</p></div>
            <div><span>Saved routing policies</span><strong>{layouts.length}<small> Layout{layouts.length === 1 ? '' : 's'}</small></strong><p>Auto-ranked or ordered, with explicit fallback scope</p></div>
            <div><span>{routed ? 'Last answer allowance' : 'Selected model allowance'}</span>{left === null ? <strong className="rc-unknown">Unknown</strong> : <strong>{left}<small> requests left</small></strong>}<p>{left === null ? 'No request allowance is reported for this route.' : `For ${modelLabel(catalog, current)} only.${routed ? ' Auto and Layouts may choose another model.' : ''}`}</p></div>
          </div>
          <section className="rc-card">
            <span className="rc-label">This conversation</span>
            <h2>{modelLabel(catalog, model)}</h2>
            <p className="rc-muted">{model === 'auto' ? 'Task-aware choice at send.' : model.startsWith('layout:') ? 'Your saved routing policy.' : 'Fixed manual selection.'}</p>
            {last?.route ? <RouteWhy message={last} /> : <p className="rc-muted">No completed answer with a route record yet.</p>}
          </section>
          <RecentDecisions />
          <div className="rc-actions">
            <button type="button" className="rc-row-link" onClick={() => showRoutingSection('providers')}>Browse providers<ArrowRight size={16} /></button>
            <button type="button" className="rc-row-link" onClick={() => showRoutingSection('policies')}>Policies &amp; fallbacks<ArrowRight size={16} /></button>
            <button type="button" className="rc-row-link" onClick={() => showRoutingSection('usage')}>Usage &amp; quotas<ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {section === 'providers' && <div className="rc-body"><Providers key={owner || 'signed-out'} preferred={current?.split(':')[0]} /></div>}

      {section === 'models' && (
        <div className="rc-body">
          <div className="rc-panel-title"><div><h2>Model inventory</h2><p className="rc-muted">Context limits and capabilities from your catalog.</p></div><button type="button" className="rc-link" onClick={() => openSettings('models')}>Manage models <ArrowUpRight size={14} /></button></div>
          <div className="rc-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search models" placeholder="Search models or providers" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          {inventory.map((m) => <article className="rc-model" key={m.id}><div><h4>{m.label}</h4><code>{m.id}</code><p>{m.context ? `${formatTokens(m.context)} context` : 'Context unknown'}</p></div><UseModel model={m} /></article>)}
          {!inventory.length && <p className="rc-muted" role="status">No models match.</p>}
        </div>
      )}

      {section === 'policies' && (
        <div className="rc-body">
          <div className="rc-panel-title"><div><h2>Policies &amp; fallback order</h2><p className="rc-muted">Layouts are Lumen’s named routing policies. Existing recovery and consent rules still apply.</p></div>
            {!editing && <button type="button" className="rc-primary" onClick={() => setEditing({ id: crypto.randomUUID(), name: '', icon: 'layers', description: '', models: [], mode: 'order', fallback: 'layout' })}><Plus size={15} />New policy</button>}</div>
          {editing ? <div className="rc-editor"><LayoutEditor key={editing.id} start={editing} onDone={() => setEditing(null)} /></div> : layouts.map((l) => (
            <article className="rc-policy" key={l.id}>
              <div><span className="rc-label">{l.mode === 'order' ? 'Ordered fallback' : 'Task-aware set'}</span><h3>{l.name}</h3>{l.description && <p className="rc-muted">{l.description}</p>}</div>
              <ol>{l.models.map((id) => <li key={id}>{modelLabel(catalog, id)}</li>)}</ol>
              <span className="rc-muted">Fallback: {l.fallback === 'none' ? 'None' : l.fallback === 'layout' ? 'Within this Layout' : 'Enabled models permitted'}</span>
              <button type="button" className="rc-link" onClick={() => setEditing(l)}>Edit {l.name} <SlidersHorizontal size={15} /></button>
            </article>
          ))}
          {!editing && !layouts.length && <p className="rc-muted">No saved policies yet. Auto chooses for each task until you add one.</p>}
          {!editing && <Suspense fallback={null}><RoutingFile /></Suspense>}
        </div>
      )}

      {section === 'usage' && <div className="rc-body"><h2 className="rc-h2">Usage &amp; quotas</h2><p className="rc-muted">Local account counters and provider-reported limits where available. Unknown values remain unknown.</p><Suspense fallback={null}><UsageHistory /></Suspense><UsageTab /></div>}

      {section === 'diagnostics' && (
        <div className="rc-body">
          <h2 className="rc-h2">Routing, without hidden assumptions</h2>
          <p className="rc-muted">Existing decision evidence only. No request logger or health probes are added.</p>
          <div className="rc-grid">
            <section className="rc-card"><h3>Latest model choice</h3>{last?.route ? <RouteWhy message={last} /> : <p className="rc-muted">No route explanation is recorded.</p>}</section>
            <Suspense fallback={null}><RequestLog /></Suspense>
            <section className="rc-card"><h3><Shield size={16} /> Privacy boundary</h3><p className="rc-muted">Provider credentials stay in Lumen’s existing account scope. No prompt bodies or credentials are added to a diagnostic history.</p></section>
            <section className="rc-card"><h3>Developer endpoint</h3><p className="rc-muted">Not available in browser Lumen. A local or server gateway would need a separately approved trust and deployment architecture.</p></section>
          </div>
        </div>
      )}
    </section>
  );
}
