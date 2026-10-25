// CP04 Canvas Routing Center (approved Canvas direction; content from the verified provider proof). Loaded lazily
// and only while CANVAS_SHELL is on (src/lib/canvas-presentation.ts); the ordinary build never reaches it.
// Presentation only: it reads Lumen's existing catalog, keys, settings and usage and reuses its owners — manual
// selection through setChatModel, Layouts through LayoutEditor, usage through UsageTab, decisions through RouteWhy,
// connections through Settings → Keys. Send-time routing, eligibility and recovery are unchanged.
import '../styles/canvas-routing.css';
import PhoneNavigation from './PhoneNavigation';
import PhoneSections from './PhoneSections';
import { usePhoneLayout } from '../lib/phone-layout';
import { createPortal } from 'react-dom';
import { navigateScreen, screenBack } from '../lib/screen-history';
import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, ChevronRight, Plus, Search, Shield, SlidersHorizontal, X } from 'lucide-react';
import { modelLabel, selectCurrentChat, selectCurrentModel, useStore } from '../store';
import { AI_PROVIDERS, providerEnabled } from '../lib/ai/provider-config.js';
import { modelProblem } from '../lib/ai/eligibility.js';
import { PROVIDER_NAMES, providerOfId } from '../lib/util';
import { formatTokens, remaining } from '../lib/usage';
import { installSwipeBack } from '../lib/swipe-back';
import { closeRoutingCenter, showRoutingSection, showRoutingProvider, useRoutingCenter, type RoutingSection } from '../lib/routing-center';
import type { Layout } from '../lib/layouts';
import type { ModelInfo } from '../types';
import { LayoutEditor } from './LayoutsTab';
import UsageTab from './UsageTab';
import RouteWhy from './RouteWhy';
import { providerPresentation } from '../lib/provider-presentation';
import { requestProviderSettings } from '../lib/provider-settings-target';
import FilterMenu from './FilterMenu';
// Tier 5 panels (usage history, request log, routing file, connection check) load on first use, in their own chunk.
const ScreenActions = lazy(() => import('./ScreenActions'));
const extras = () => import('./RoutingExtras');
const CheckConnection = lazy(() => extras().then((m) => ({ default: m.CheckConnection })));
const UsageHistory = lazy(() => extras().then((m) => ({ default: m.UsageHistory })));
const RequestLog = lazy(() => extras().then((m) => ({ default: m.RequestLog })));
const RoutingFile = lazy(() => extras().then((m) => ({ default: m.RoutingFile })));
const RecentAnswers = lazy(() => extras().then((m) => ({ default: m.RecentAnswers })));

const SECTIONS: [RoutingSection, string][] = [['models', 'Models'], ['providers', 'Providers'], ['policies', 'Layouts'], ['usage', 'Usage'], ['diagnostics', 'Diagnostics']];
// Phones use a feature index and pushed screens; canonical UI history owns every Back path.
const providerId = (model: ModelInfo) => (model.provider === 'google' ? 'gemini' : model.provider);
const providerLabel = (id: string) => (id === 'gemini' ? 'Google AI Studio' : PROVIDER_NAMES[providerOfId(id + ':')] || id);
const openSettings = (tab: string) => useStore.getState().setUi({ settingsOpen: true, settingsTab: tab, sidebarOpen: false });
const openProviderSettings = (provider: string) => {
  navigateScreen(() => { if (requestProviderSettings(provider, useStore.getState().user?.uid)) openSettings('keys'); });
};
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

/** One status vocabulary for providers, everywhere: can Lumen choose this provider's models? A model list is the
 * evidence; replies are never tested by listing. A light (lit, cached, failed or off), a word and one line of fact. */
type Light = 'on' | 'stale' | 'fail' | 'off';
type ProviderRow = { id: string; label: string; keySaved: boolean; enabled: boolean; models: ModelInfo[]; status?: NonNullable<NonNullable<State['catalog']>['providerStatus']>[string]; presentation: ReturnType<typeof providerPresentation> };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
// Today: the time; earlier: the date.
const when = (t: number) => new Intl.DateTimeFormat(undefined, new Date(t).toDateString() === new Date().toDateString() ? { timeStyle: 'short' } : { dateStyle: 'medium' }).format(t);
function verdictOf(p: ProviderRow): { word: string; light: Light } {
  return { word: p.presentation.verdict, light: p.presentation.light };
}
const LightDot = ({ light }: { light: Light }) => <span className={`rc-light rc-light-${light}`} aria-hidden="true" />;

/** A provider in the ledger: its verdict and, on the right, how many models it lists. */
function ProviderLine({ p, current, onOpen }: { p: ProviderRow; current?: boolean; onOpen: () => void }) {
  const v = verdictOf(p), n = p.models.length;
  return (
    <button type="button" className="rc-prov" data-provider={p.id} data-light={v.light} aria-current={current ? 'true' : undefined} onClick={onOpen}>
      <LightDot light={v.light} />
      <span className="rc-prov-text"><strong>{p.label}</strong><small><b>{v.word}</b></small><small className="rc-provider-next">{p.presentation.nextStep}</small></span>
      {n > 0 && <span className="rc-prov-n"><b>{n}</b> {n === 1 ? 'model' : 'models'}</span>}
      <ChevronRight size={16} aria-hidden="true" />
    </button>
  );
}

function useProviderRows(): ProviderRow[] {
  const keys = useStore((s) => s.keys), catalog = useStore((s) => s.catalog);
  return useMemo(() => {
    const grouped = new Map<string, ModelInfo[]>();
    for (const m of catalog?.models || []) { const id = providerId(m); grouped.set(id, [...(grouped.get(id) || []), m]); }
    return AI_PROVIDERS.map((id) => {
      const raw = keys[id as keyof typeof keys];
      return { id, label: providerLabel(id), keySaved: typeof raw === 'string' && Boolean(raw.trim()), enabled: providerEnabled(id, keys), models: grouped.get(id) || [], status: catalog?.providerStatus?.[id] };
    }).map((p) => ({ ...p, presentation: providerPresentation({ ...p, modelCount: p.models.length }) })).sort((a, b) => Number(b.presentation.attention) - Number(a.presentation.attention) || Number(b.keySaved) - Number(a.keySaved) || a.label.localeCompare(b.label));
  }, [keys, catalog]);
}

const PHONE = '(max-width: 899px)';

const MANY = 8;

function Providers({ preferred, phone, searchHost }: { preferred?: string; openDetail?: boolean; phone: boolean; searchHost: HTMLElement | null }) {
  const usage = useStore((s) => s.usage), enabledModels = useStore((s) => s.settings.enabledModels);
  const providers = useProviderRows();
  const route = useRoutingCenter();
  const selected = route.provider ?? preferred ?? null, detail = Boolean(route.provider);
  const setSelected = (id: string | null) => showRoutingProvider(id);
  const setDetail = (value: boolean) => { if (!value) showRoutingProvider(null); };
  const [query, setQuery] = useState(''), [filter, setFilter] = useState<'all' | 'saved' | 'enabled' | 'attention'>('all');
  const input = useRef<HTMLInputElement>(null), title = useRef<HTMLHeadingElement>(null), list = useRef<HTMLDivElement>(null);
  // Phones: a provider opens as its own page, from the top.
  useEffect(() => { if (!detail) return; if (phone) title.current?.closest('.rc-scroll')?.scrollTo(0, 0); title.current?.focus({ preventScroll: true }); }, [selected, detail, phone]);
  const enabled = providers.filter((p) => p.enabled).length, saved = providers.filter((p) => p.keySaved).length;
  const matches = (p: ProviderRow, text: string, scope: typeof filter) => (scope === 'all' || (scope === 'saved' ? p.keySaved : scope === 'attention' ? p.presentation.attention : p.enabled)) && `${p.label} ${p.id}`.toLowerCase().includes(text.trim().toLowerCase());
  const visible = providers.filter((p) => matches(p, query, filter));
  // Computers show a provider beside the list from the start (the first of yours); phones open one on request.
  const active = visible.find((p) => p.id === selected);
  const shown = phone && !detail ? undefined : active;
  // Your providers form the ledger; the rest are a field of names to explore, the first few shown until you ask for all
  // (or search or filter, which shows every match).
  const connected = visible.filter((p) => p.keySaved || p.enabled), unconnected = visible.filter((p) => !p.keySaved && !p.enabled);
  const [all, setAll] = useState(() => Boolean(preferred) && !providers.some((p) => p.id === preferred && (p.keySaved || p.enabled)));
  const narrowed = Boolean(query.trim()) || filter !== 'all';
  const previewCount = phone ? 3 : MANY;
  const folds = !narrowed && unconnected.length > previewCount && (phone || connected.length > 0);
  const names = folds && !all ? unconnected.slice(0, previewCount) : unconnected;
  const open = (id: string) => { setSelected(id); setDetail(true); };
  const change = (text: string, scope: typeof filter) => {
    setQuery(text); setFilter(scope);
    if (!providers.some((p) => p.id === selected && matches(p, text, scope))) { setSelected(null); setDetail(false); }
  };


  const search = <div className="rc-search"><Search size={16} aria-hidden="true" /><input ref={input} type="search" aria-label="Find a provider" placeholder="Find a provider" value={query} onChange={(e) => change(e.target.value, filter)} />{query && <button type="button" aria-label="Clear provider search" onClick={() => { change('', filter); input.current?.focus(); }}><X size={16} /></button>}</div>;

  return (
    <section className={`rc-providers${shown ? ' has-detail' : ''}`} aria-label="Provider browser">
      <div className="rc-provider-list" ref={list}>
        <div className="rc-list-head">
          <h2>Providers</h2>
          <button type="button" className="rc-add" aria-label="Connect a provider" onClick={() => openSettings('keys')}><Plus size={16} aria-hidden="true" /><span>Connect</span></button>
        </div>
        <div className="rc-find">
          {phone ? !detail && searchHost && createPortal(search, searchHost) : search}
          <FilterMenu<typeof filter> label="Filter providers" value={filter} onChange={(scope) => change(query, scope)} options={[{ value: 'all', label: 'All providers', count: providers.length }, { value: 'saved', label: 'Saved keys', count: saved }, { value: 'enabled', label: 'Enabled providers', count: enabled }, { value: 'attention', label: 'Needs attention', count: providers.filter((p) => p.presentation.attention).length }]} />
        </div>
        <p className="rc-count" role="status">{visible.length} of {providers.length} providers</p>
        <div className="rc-provider-scroll">
          {connected.length > 0 && <>
            <h3 className="rc-group-label">Your providers <span>{saved} keys · {enabled} enabled</span></h3>
            <div className="rc-ledger">{connected.map((p) => <ProviderLine key={p.id} p={p} current={shown?.id === p.id} onOpen={() => open(p.id)} />)}</div>
          </>}
          {unconnected.length > 0 && (
            <section className="rc-explore" aria-labelledby="rc-explore-title">
              <h3 className="rc-group-label" id="rc-explore-title">{connected.length ? 'Add a provider' : 'Connect a provider'} <span>{plural(unconnected.length, 'provider')} · no key saved</span></h3>
              <div className="rc-chips" id="rc-unconnected">{names.map((p) => <button type="button" key={p.id} className="rc-chip" data-provider={p.id} aria-current={shown?.id === p.id ? 'true' : undefined} onClick={() => open(p.id)}>{p.label}</button>)}</div>
              {folds && <button type="button" className="rc-more" aria-expanded={all} aria-controls="rc-unconnected" onClick={() => setAll(!all)}>{all ? 'Show fewer providers' : `Show all ${unconnected.length} providers`}</button>}
            </section>
          )}
          {!visible.length && <div className="rc-empty"><p>No providers match.</p><button type="button" className="rc-link" onClick={() => { change('', 'all'); input.current?.focus(); }}>Reset provider filters</button></div>}
        </div>
      </div>
      {shown ? <ProviderDetail key={shown.id} searchHost={phone ? searchHost : null} p={shown} title={title} usage={usage} enabledHere={enabledModels.filter((id) => shown.models.some((m) => m.id === id)).length} />
        : !phone && (
          <aside className="rc-provider-pick">
            <h3>{connected.length ? 'Choose a provider' : 'Connect your first provider'}</h3>
            <p>{connected.length ? 'See whether Lumen can use it and what to do next.' : 'Save a key and turn it on; Lumen lists its models.'}</p>
            {!connected.length && <button type="button" className="rc-primary" onClick={() => openSettings('keys')}><Plus size={16} aria-hidden="true" />Connect a provider</button>}
          </aside>
        )}
    </section>
  );
}

/** A provider: the verdict, the one next step that matters, then the facts (independent of each other) and its models. */
function ProviderDetail({ p, title, usage, enabledHere, searchHost }: { searchHost: HTMLElement | null; p: ProviderRow; title: React.RefObject<HTMLHeadingElement | null>; usage: State['usage']; enabledHere: number }) {
  const v = verdictOf(p), s = p.status, n = p.models.length;
  const observed = Object.values(usage?.models || {}).filter((m) => m.id.split(':')[0] === p.id);
  const requests = observed.reduce((t, m) => t + m.requests, 0), tokens = observed.reduce((t, m) => t + m.input + m.output, 0);
  const knownLimits = observed.filter((m) => m.quota !== null);
  const sharedLeft = p.id === 'openrouter' && usage?.openrouter.limit != null ? Math.max(0, usage.openrouter.limit - usage.openrouter.used) : null;
  const listing = s?.state === 'ready' || s?.state === 'stale';
  const settings = (text: string, primary: boolean) => !primary && window.matchMedia(PHONE).matches ? null : <button type="button" className={primary ? 'rc-primary' : 'rc-quiet'} aria-label={primary ? undefined : `Connection settings for ${p.label}`} onClick={() => openProviderSettings(p.id)}>{text}<ArrowUpRight size={15} aria-hidden="true" /></button>;
  const refresh = (primary: boolean) => <Suspense fallback={null}><CheckConnection provider={p.id} primary={primary} /></Suspense>;
  // The next meaningful action, in plain words: fix what blocks the provider first; a refresh leads only when the model
  // list is missing or old; Settings stays one quiet step away.
  const actions = !p.keySaved ? settings('Add a key', true) : !p.enabled ? settings('Enable provider', true)
    : s?.errorKind === 'auth' ? <>{settings('Review key', true)}{refresh(false)}</>
    : <>{refresh(s?.state !== 'ready')}{settings('Connection settings', false)}</>;
  // Four independent facts: a saved key and permission don't depend on a model list, and a list says nothing of replies.
  const facts: [string, string, Light?][] = [
    ['Key · permission', `${p.keySaved ? 'Saved' : 'None'} · ${p.enabled ? 'on' : 'off'}`, p.keySaved && !p.enabled ? 'fail' : undefined],
    ['Models', s?.state === 'ready' ? `${n} listed · ${when(s.lastSuccess || s.lastAttempt)}` : s?.state === 'stale' ? `${n} cached${s.lastSuccess ? ` · ${when(s.lastSuccess)}` : ''}` : s?.state === 'error' ? 'Listing failed' : 'Not listed yet', s?.state === 'error' ? 'fail' : undefined],
    ['Replies', p.presentation.replyLabel],
    ['Allowance', sharedLeft !== null ? `${sharedLeft} requests left · shared pool` : knownLimits.length ? 'Per model, below' : 'Unknown'],
  ];
  return (
    <section className="rc-provider-detail" aria-label="Provider detail">
      <header className="rc-detail-head">
        <div>
          <h2 tabIndex={-1} ref={title}>{p.label}</h2>
          <p className="rc-verdict" data-light={v.light}><LightDot light={v.light} /><strong>{v.word}</strong><span>{listing && n ? `${plural(n, 'model')} ${s?.state === 'stale' ? 'cached' : 'listed'} · ${enabledHere} enabled in settings` : null}</span></p>
        </div>
        <div className="rc-detail-actions">{actions}</div>
      </header>
      {(p.presentation.attention || (p.keySaved && !p.enabled)) && <p className="rc-note" data-light={v.light} role="status">{p.presentation.guidance}</p>}
      <p className="rc-setup-line">{p.keySaved ? 'Key saved' : 'No saved key'} · {p.enabled ? 'Provider enabled' : 'Provider disabled'}<span>Catalog discovery does not test replies.</span></p>
      <ProviderModels searchHost={searchHost} models={p.models} />
      <details className="rc-provenance"><summary>Connection details &amp; usage</summary>
        <dl className="rc-facts">{facts.map(([k, value, light]) => <div key={k} data-fact={k} data-light={light}><dt>{k}</dt><dd>{value}</dd></div>)}</dl>
        <div className="rc-usage-pair"><div><span>Requests recorded in Lumen</span><strong>{usage ? `${requests} requests` : 'Unknown'}</strong></div><div><span>Tokens recorded in Lumen</span><strong>{usage ? formatTokens(tokens) : 'Unknown'}</strong></div></div>
        <p className="rc-muted">{sharedLeft !== null ? `One shared allowance for OpenRouter free models: ${usage!.openrouter.used} of ${usage!.openrouter.limit} requests recorded. Paid models are excluded.` : knownLimits.length ? 'Known limits belong to individual models; they are not a combined provider balance.' : 'No provider allowance is reported in this account’s current usage data.'} Counts reflect Lumen activity, not account-wide billing or proof of successful replies.</p>
      </details>
    </section>
  );
}

/** A model: name and id, then its context and allowance (columns on computers), and the canonical "Use model". */
function ModelRow({ m }: { m: ModelInfo }) {
  const usage = useStore((s) => s.usage);
  const left = remaining(usage, m.id), seen = usage?.models[m.id];
  const flags = [m.metadata?.verification === 'unchecked' && 'Declared, unchecked', m.metadata?.stale && 'Cached metadata', seen?.blockedUntil && seen.blockedUntil > Date.now() && 'Temporarily limited'].filter(Boolean).join(' · ');
  return (
    <article className="rc-model">
      <div><h4>{m.label}</h4><code>{m.id}</code>{flags && <small>{flags}</small>}</div>
      <p><span>{m.context ? `${formatTokens(m.context)} context` : 'Context unknown'}</span><span>{left === null ? 'Allowance unknown' : `${left} requests left${m.id.startsWith('openrouter:') && m.id.endsWith(':free') ? ' · shared pool' : ''}`}</span></p>
      <UseModel model={m} />
    </article>
  );
}

function ProviderModels({ models, searchHost }: { models: ModelInfo[]; searchHost: HTMLElement | null }) {
  const [query, setQuery] = useState(''), [page, setPage] = useState(0);
  const filtered = useMemo(() => models.filter((m) => `${m.label} ${m.name}`.toLowerCase().includes(query.trim().toLowerCase())), [models, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / 24)), current = Math.min(page, pages - 1);
  const search = <div className="rc-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Find a model" placeholder="Find a model" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} />{query && <button type="button" aria-label="Clear provider model search" onClick={e => { setQuery(''); setPage(0); e.currentTarget.parentElement?.querySelector('input')?.focus(); }}><X size={16}/></button>}</div>;

  return (
    <section className="rc-provider-models" aria-label="Provider models">
      <h3 className="rc-group-label">Models <span>{models.length} in catalog</span></h3>
      {(models.length > 24 || query) && (searchHost ? createPortal(search, searchHost) : search)}
      {filtered.length ? <div className="rc-group">{filtered.slice(current * 24, (current + 1) * 24).map((m) => <ModelRow key={m.id} m={m} />)}</div>
        : <p className="rc-empty">{models.length ? 'No models match.' : 'No models listed yet.'}</p>}
      {filtered.length > 24 && <nav className="rc-pages" aria-label="Model pages"><button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button><span role="status">{current * 24 + 1}–{Math.min(filtered.length, (current + 1) * 24)} of {filtered.length}</span><button type="button" disabled={current + 1 === pages} onClick={() => setPage(current + 1)}>Next</button></nav>}
    </section>
  );
}

export default function RoutingCenter() {
  const { open, section, provider } = useRoutingCenter();
  const chat = useStore(selectCurrentChat), model = useStore(selectCurrentModel);
  const catalog = useStore((s) => s.catalog), config = useStore((s) => s.settings);
  const owner = useStore((s) => s.user?.uid), currentId = useStore((s) => s.currentId);
  const covered = useStore((s) => s.settingsOpen || Boolean(s.page));
  const providers = useProviderRows();
  const phone = usePhoneLayout();
  const [editing, setEditing] = useState<Layout | null>(null);
  const [query, setQuery] = useState('');
  const [searchHost, setSearchHost] = useState<HTMLElement | null>(null);

  const page = useRef<HTMLElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const providerOpen = Boolean(provider);
  // Another conversation or account is another context: the Routing Center closes.
  const opened = useRef({ owner, currentId });
  useEffect(() => { if (open) opened.current = { owner, currentId }; }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && (opened.current.owner !== owner || opened.current.currentId !== currentId)) closeRoutingCenter(); }, [open, owner, currentId]);
  useEffect(() => { if (open) heading.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => {
    setEditing(null); if (page.current) { page.current.scrollTop = 0; page.current.querySelector('.rc-scroll')?.scrollTo(0,0); }
    // The shared phone title is stable across sections; direct entry never invents a Back target.
    if (phone && open) page.current?.querySelector<HTMLElement>('.phone-navigation h1')?.focus({ preventScroll: true });
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps
  // Phones: an open provider, Usage and Diagnostics are pages over their place. Back (or Safari's edge swipe) closes them.
  const drill = phone && (providerOpen || section !== 'models');
  // Every section/provider is represented in the shared history adapter; no competing local Back layer.
  // Phones: elsewhere, swipe right to go back to the chat, as from the other pages shown in its place.
  useEffect(() => {
    const el = page.current;
    if (!open || !el) return;
    return installSwipeBack(el, () => window.matchMedia(PHONE).matches && !el.querySelector('[role="dialog"]'), () => {}, () => screenBack(closeRoutingCenter), { reveal: () => document.querySelector<HTMLElement>('.app > .main') });
  }, [open]);
  if (!open) return null;

  const last = chat?.messages.findLast((m) => m.role === 'assistant' && m.model && m.status === 'done');
  const routed = model === 'auto' || model.startsWith('layout:');
  const current = routed ? last?.model : model;
  const models = catalog?.models || [], layouts = config.layouts || [];
  const mine = providers.filter((p) => p.keySaved || p.enabled);
  const q = query.trim().toLowerCase();
  const inventory = models.filter((m) => `${m.label} ${m.name} ${m.provider}`.toLowerCase().includes(q));
  const choices = config.enabledModels.filter((id) => models.some((m) => m.id === id)).length;
  const layout = model.startsWith('layout:') ? layouts.find((l) => `layout:${l.id}` === model) : undefined;
  const picked = !routed ? models.find((m) => m.id === model) : undefined;
  const sentence = model === 'auto'
    ? (!mine.length ? 'Connect a provider so Auto has models to choose from.' : !choices ? 'Enable models in Settings so Auto has a choice.' : `Picks a model for each message from your ${plural(choices, 'enabled model')}.`)
    : layout ? `Follows your Layout ${layout.name}, ${layout.mode === 'order' ? 'trying its models in order' : 'choosing by task within its set'}.` : 'Every message in this chat uses this model.';
  // Who the route can reach, in words: Auto's enabled models, a Layout's models in order, or a chosen model's provider.
  const pool = model === 'auto' ? models.filter((m) => config.enabledModels.includes(m.id)).map((m) => m.label) : layout ? layout.models.map((id) => modelLabel(catalog, id)) : [];
  const reach = pool.length ? `${pool.slice(0, 3).join(layout?.mode === 'order' ? ' → ' : ' · ')}${pool.length > 3 ? ` +${pool.length - 3} more` : ''}`
    : picked ? `${providerLabel(providerId(picked))}${picked.context ? ` · ${formatTokens(picked.context)} context` : ''}` : '';
  const go = (id: RoutingSection) => showRoutingSection(id);
  const sub = phone && section !== 'models';

  const modelSearch = <div className="rc-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search models" placeholder="Search models or providers" value={query} onChange={e => setQuery(e.target.value)} />{query && <button type="button" aria-label="Clear model search" onClick={e => { setQuery(''); e.currentTarget.parentElement?.querySelector('input')?.focus(); }}><X size={16} /></button>}</div>;


  return (
    <section ref={page} className={`rc-page${sub ? ' rc-sections-page' : ''}${drill ? ' rc-drill' : ''}`} hidden={covered} aria-label="Prism — Models, providers & routing"
      onKeyDown={(e) => { if (e.key === 'Escape' && !e.defaultPrevented && !(e.target as Element).closest('[role="dialog"], [role="menu"], [role="listbox"], input, textarea, select')) { e.preventDefault(); screenBack(closeRoutingCenter); } }}>
      {/* Desktop retains split-view navigation; phone chrome is shared with Library, Tools and Settings. */}
      {phone ? <PhoneNavigation title={providerOpen && provider ? providerLabel(provider) : 'Prism'} actions={providerOpen ? <Suspense fallback={null}><ScreenActions actions={[{ label: 'Connection settings', run: () => openProviderSettings(provider!) }]} /></Suspense> : undefined} /> : (
      <header className={`rc-head${sub ? ' rc-head-sub' : ''}`}>
        <div className="rc-brand"><h1 id="rc-title" tabIndex={-1} ref={heading}>Prism</h1><p>Models, providers &amp; routing</p></div>
        {!phone && (
          <nav className="rc-tabs" aria-label="Prism sections">
            {SECTIONS.map(([id, label]) => <button type="button" key={id} aria-current={section === id ? 'page' : undefined} onClick={() => go(id)}>{label}</button>)}
          </nav>
        )}
        <button type="button" className="rc-close" aria-label="Back to chat" onClick={closeRoutingCenter}><ArrowLeft size={18} /><span>Chat</span></button>
      </header>)}



      {phone && !providerOpen && <PhoneSections label="Prism sections" active={section} items={SECTIONS.map(([id,label]) => ({ id, label }))} onSelect={id => go(id as RoutingSection)} />}
      <div className="rc-scroll">
      {section === 'providers' && <div className="rc-body"><Providers key={owner || 'signed-out'} preferred={current?.split(':')[0]} phone={phone} searchHost={searchHost} /></div>}

      {section === 'models' && (
        <div className="rc-body rc-models-body">
          <section className="rc-current" aria-label="Current routing mode">
            {phone ? (
              <details className="rc-current-disclosure">
                <summary>
                  <span className="rc-current-identity"><span className="rc-kicker">Next message in this chat</span><strong className="rc-current-model">{modelLabel(catalog, model)}</strong></span>
                  <span className="rc-current-more-label">Details <ChevronRight size={15} aria-hidden="true" /></span>
                </summary>
                <div className="rc-current-explanation"><p className="rc-muted">{sentence}</p>{reach && <p className="rc-muted rc-current-reach">{reach}</p>}</div>
              </details>
            ) : (
              <>
                <p className="rc-kicker">Next message in this chat</p>
                <h2>{modelLabel(catalog, model)}</h2>
                <p className="rc-muted">{sentence}</p>
                {reach && <p className="rc-muted rc-current-reach">{reach}</p>}
              </>
            )}
            {!mine.length && <button type="button" className="rc-primary" onClick={() => openSettings('keys')}><Plus size={15} aria-hidden="true" />Connect a provider</button>}
          </section>
          <div className="rc-panel-title"><div><h2>Model inventory</h2><p className="rc-muted">{phone ? 'Models, providers & routing · ' : ''}Context limits and allowances from your catalog.</p></div><button type="button" className="rc-add" aria-label="Manage models" onClick={() => openSettings('models')}><span>Manage<span className="rc-manage-noun"> models</span></span><ArrowUpRight size={15} aria-hidden="true" /></button></div>
          {phone ? searchHost && createPortal(modelSearch, searchHost) : modelSearch}
          {inventory.length ? <div className="rc-group">{inventory.map((m) => <ModelRow key={m.id} m={m} />)}</div> : <p className="rc-muted" role="status">No models match.</p>}
        </div>
      )}

      {section === 'policies' && (
        <div className="rc-body">
          <div className="rc-panel-title"><div><h2>{phone ? 'Layouts & policies' : 'Policies & fallback order'}</h2><p className="rc-muted">Layouts are Lumen’s named routing policies. Existing recovery and consent rules still apply.</p></div>
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
            <Suspense fallback={null}><RecentAnswers /></Suspense>
            <section className="rc-card"><h3><Shield size={16} /> Privacy boundary</h3><p className="rc-muted">Provider credentials stay in Lumen’s existing account scope. No prompt bodies or credentials are added to a diagnostic history.</p></section>
            <section className="rc-card"><h3>Developer endpoint</h3><p className="rc-muted">Not available in browser Lumen. A local or server gateway would need a separately approved trust and deployment architecture.</p></section>
          </div>
        </div>
      )}

      </div>
      {phone && <footer ref={setSearchHost} className="phone-page-search rc-search-footer" aria-label={section === 'providers' ? providerOpen ? 'Provider model search' : 'Provider search' : 'Model search'} />}
    </section>
  );
}
