// CP04 Canvas Routing Center (approved Canvas direction; content from the verified provider proof). Loaded lazily
// and only while CANVAS_SHELL is on (src/lib/canvas-presentation.ts); the ordinary build never reaches it.
// Presentation only: it reads Lumen's existing catalog, keys, settings and usage and reuses its owners — manual
// selection through setChatModel, Layouts through LayoutEditor, usage through UsageTab, decisions through RouteWhy,
// connections through Settings → Keys. Send-time routing, eligibility and recovery are unchanged.
import '../styles/canvas-routing.css';
import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Menu, Plus, Search, Shield, SlidersHorizontal, X } from 'lucide-react';
import { useBackLayer } from '../lib/back-stack';
import { modelLabel, selectCurrentChat, selectCurrentModel, useStore } from '../store';
import { AI_PROVIDERS, providerEnabled } from '../lib/ai/provider-config.js';
import { modelProblem } from '../lib/ai/eligibility.js';
import { PROVIDER_NAMES, providerOfId } from '../lib/util';
import { formatTokens, remaining } from '../lib/usage';
import { installSwipeBack } from '../lib/swipe-back';
import { closeRoutingCenter, showRoutingSection, useRoutingCenter, type RoutingSection } from '../lib/routing-center';
import type { Layout } from '../lib/layouts';
import type { ModelInfo } from '../types';
import { LayoutEditor } from './LayoutsTab';
import UsageTab from './UsageTab';
import RouteWhy from './RouteWhy';
import { providerPresentation } from '../lib/provider-presentation';
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

/** One status vocabulary for providers, everywhere: a light (lit, cached, failed or off) and one line of words. */
type Light = 'on' | 'stale' | 'fail' | 'off';
type ProviderRow = { id: string; label: string; keySaved: boolean; enabled: boolean; models: ModelInfo[]; status?: NonNullable<NonNullable<State['catalog']>['providerStatus']>[string]; presentation: ReturnType<typeof providerPresentation> };
const lightOf = (p: ProviderRow): Light => !(p.keySaved && p.enabled) ? 'off' : p.status?.state === 'ready' ? 'on' : p.status?.state === 'stale' ? 'stale' : p.status?.state === 'error' ? 'fail' : 'off';
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Saved key, permission and discovery stay distinct: setup words until both are in place, then the catalog's state. */
const statusLine = (p: ProviderRow) => !p.keySaved && !p.enabled ? 'No key saved' : !p.enabled ? 'Key saved · permission off'
  : !p.keySaved ? 'Enabled · no key saved' : `${p.presentation.catalogLabel}${p.models.length ? ` · ${plural(p.models.length, 'model')}` : ''}`;
const LightDot = ({ p }: { p: ProviderRow }) => <span className={`rc-light rc-light-${lightOf(p)}`} aria-hidden="true" />;
const when = (t: number) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(t);

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
function usePhone() {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches);
  useEffect(() => { const m = window.matchMedia(PHONE), sync = () => setPhone(m.matches); m.addEventListener('change', sync); return () => m.removeEventListener('change', sync); }, []);
  return phone;
}

function Providers({ preferred, openDetail, phone, detailBack, onDetail }: { preferred?: string; openDetail?: boolean; phone: boolean; detailBack: React.MutableRefObject<(() => boolean) | null>; onDetail: (open: boolean) => void }) {
  const usage = useStore((s) => s.usage);
  const providers = useProviderRows();
  const [selected, setSelected] = useState<string | null>(preferred || null), [detail, setDetail] = useState(Boolean(openDetail && preferred));
  const [query, setQuery] = useState(''), [filter, setFilter] = useState<'all' | 'saved' | 'enabled' | 'attention'>('all');
  const input = useRef<HTMLInputElement>(null), title = useRef<HTMLHeadingElement>(null), list = useRef<HTMLDivElement>(null);
  // Phones: a provider opens as its own page, from the top.
  useEffect(() => { if (!detail) return; if (phone) title.current?.closest('.rc-page')?.scrollTo(0, 0); title.current?.focus({ preventScroll: true }); }, [selected, detail, phone]);
  const enabled = providers.filter((p) => p.enabled).length, saved = providers.filter((p) => p.keySaved).length;
  const matches = (p: ProviderRow, text: string, scope: typeof filter) => (scope === 'all' || (scope === 'saved' ? p.keySaved : scope === 'attention' ? p.presentation.attention : p.enabled)) && `${p.label} ${p.id}`.toLowerCase().includes(text.trim().toLowerCase());
  const visible = providers.filter((p) => matches(p, query, filter));
  // Computers show a provider beside the list from the start (the first of yours); phones open one on request.
  const active = visible.find((p) => p.id === selected) || (!phone && !selected ? visible.find((p) => p.keySaved || p.enabled) : undefined);
  // Providers with neither a saved key nor permission fold under one row, closed unless the current model's provider is
  // among them; a search or a filter lists everything.
  const connected = visible.filter((p) => p.keySaved || p.enabled), unconnected = visible.filter((p) => !p.keySaved && !p.enabled);
  const [unfolded, setUnfolded] = useState(() => Boolean(preferred) && !providers.some((p) => p.id === preferred && (p.keySaved || p.enabled)));
  const folding = Boolean(unconnected.length && connected.length) && !query.trim() && filter === 'all';
  const row = (p: ProviderRow) => (
    <button type="button" key={p.id} data-provider={p.id} aria-current={active?.id === p.id ? 'true' : undefined} onClick={() => { setSelected(p.id); setDetail(true); }}>
      <LightDot p={p} />
      <span><strong>{p.label}</strong><small>{statusLine(p)}</small></span>
      <ChevronRight size={16} aria-hidden="true" />
    </button>
  );
  const change = (text: string, scope: typeof filter) => {
    setQuery(text); setFilter(scope);
    if (!providers.some((p) => p.id === selected && matches(p, text, scope))) { setSelected(null); setDetail(false); }
  };
  const back = () => { const id = active?.id; setDetail(false); requestAnimationFrame(() => list.current?.querySelector<HTMLButtonElement>(`[data-provider="${id}"]`)?.focus({ preventScroll: !phone })); };
  // Phones: Back (or Safari's edge swipe) closes the provider first.
  detailBack.current = () => { if (!(phone && detail && active)) return false; back(); return true; };
  // Phones: the bar's back button leads to the list while a provider is open.
  const showing = phone && detail && Boolean(active);
  useEffect(() => { onDetail(showing); }, [showing, onDetail]);
  const observed = Object.values(usage?.models || {}).filter((m) => m.id.split(':')[0] === active?.id);
  const requests = observed.reduce((n, m) => n + m.requests, 0), tokens = observed.reduce((n, m) => n + m.input + m.output, 0);
  const knownLimits = observed.filter((m) => m.quota !== null);
  const sharedLeft = active?.id === 'openrouter' && usage?.openrouter.limit != null ? Math.max(0, usage.openrouter.limit - usage.openrouter.used) : null;
  const state = active?.status?.state;
  const path: [string, string, string][] = active ? [
    ['Key', active.keySaved ? 'Saved' : 'Not saved', active.keySaved ? 'done' : 'todo'],
    ['Permission', active.enabled ? 'Enabled' : active.keySaved ? 'Permission off' : 'Not configured', active.enabled ? 'done' : active.keySaved ? 'blocked' : 'todo'],
    ['Model discovery', `${active.presentation.catalogLabel}${active.status?.lastSuccess ? ` · ${when(active.status.lastSuccess)}` : ''}`, state === 'ready' ? 'done' : state === 'stale' ? 'warn' : state === 'error' ? 'blocked' : 'todo'],
    ['Replies', active.presentation.replyLabel, 'untested'],
  ] : [];
  const fixFirst = active && active.presentation.tone !== 'ready';

  return (
    <section className={`rc-providers${active && detail ? ' has-detail' : ''}`} aria-label="Provider browser">
      <div className="rc-provider-list" ref={list}>
        <div className="rc-list-head">
          <h2>Providers</h2>
          <button type="button" className="rc-add" aria-label="Connect a provider" onClick={() => openSettings('keys')}><Plus size={16} aria-hidden="true" /><span>Connect</span></button>
        </div>
        <div className="rc-find">
          <div className="rc-search"><Search size={16} aria-hidden="true" /><input ref={input} type="search" aria-label="Find a provider" placeholder="Find a provider" value={query} onChange={(e) => change(e.target.value, filter)} />{query && <button type="button" aria-label="Clear provider search" onClick={() => { change('', filter); input.current?.focus(); }}><X size={16} /></button>}</div>
          <FilterMenu<typeof filter> label="Filter providers" value={filter} onChange={(scope) => change(query, scope)} options={[{ value: 'all', label: 'All providers', count: providers.length }, { value: 'saved', label: 'Saved connections', count: saved }, { value: 'enabled', label: 'Enabled providers', count: enabled }, { value: 'attention', label: 'Needs attention', count: providers.filter((p) => p.presentation.attention).length }]} />
        </div>
        <p className="rc-count" role="status">{visible.length} of {providers.length} providers</p>
        <div className="rc-provider-scroll">
          {folding && <h3 className="rc-group-label">Your connections <span>{saved} saved · {enabled} enabled</span></h3>}
          {visible.length > 0 && <div className="rc-group">{(folding ? connected : visible).map(row)}</div>}
          {folding && (
            <div className="rc-fold">
              <button type="button" aria-expanded={unfolded} aria-controls="rc-unconnected" onClick={() => setUnfolded(!unfolded)}>
                <span><strong>Explore providers</strong><small>{unconnected.length} {unconnected.length === 1 ? 'provider' : 'providers'} · no key saved</small></span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
            </div>
          )}
          {folding && <div id="rc-unconnected" className="rc-group rc-folded" hidden={!unfolded}>{unconnected.map(row)}</div>}
          {!visible.length && <div className="rc-empty"><p>No providers match.</p><button type="button" className="rc-link" onClick={() => { change('', 'all'); input.current?.focus(); }}>Reset provider filters</button></div>}
        </div>
      </div>
      {active ? (
        <section className="rc-provider-detail" aria-label="Provider detail">
          <header className="rc-detail-head">
            <h2 tabIndex={-1} ref={title}>{active.label}</h2>
            <p className="rc-detail-status"><LightDot p={active} />{statusLine(active)}</p>
          </header>
          <div className="rc-detail-actions">
            {active.enabled && <Suspense fallback={null}><CheckConnection key={active.id} provider={active.id} /></Suspense>}
            <button type="button" className={fixFirst ? 'rc-primary' : 'rc-secondary'} aria-label={`Connection settings for ${active.label}`} onClick={() => openSettings('keys')}>Connection settings <ArrowUpRight size={15} aria-hidden="true" /></button>
          </div>
          <ol className="rc-path" aria-label="Connection path">
            {path.map(([step, value, mark]) => <li key={step} data-step={mark}><span className="rc-path-mark" aria-hidden="true" /><strong>{step}</strong><span>{value}</span></li>)}
          </ol>
          {active.presentation.tone !== 'ready' && <div className={`rc-recovery rc-recovery-${active.presentation.tone}`} role={active.presentation.attention ? 'status' : undefined}><strong>{active.presentation.attention ? 'Needs attention' : active.presentation.catalogLabel}</strong><p>{active.presentation.guidance}</p></div>}
          <div className="rc-allowance"><span>Request allowance</span><strong>{sharedLeft !== null ? `${sharedLeft} requests remaining · shared free-model pool` : knownLimits.length ? 'Per-model limits below' : 'Unknown'}</strong></div>
          <ProviderModels key={active.id} models={active.models} />
          <details className="rc-provenance"><summary>Usage &amp; provenance</summary>
            <div className="rc-usage-pair"><div><span>Requests recorded in Lumen</span><strong>{usage ? `${requests} requests` : 'Unknown'}</strong></div><div><span>Tokens recorded in Lumen</span><strong>{usage ? formatTokens(tokens) : 'Unknown'}</strong></div></div>
            <p className="rc-muted">{sharedLeft !== null ? `One shared allowance for OpenRouter free models: ${usage!.openrouter.used} of ${usage!.openrouter.limit} requests recorded. Paid models are excluded.` : knownLimits.length ? 'Known limits belong to individual models; they are not a combined provider balance.' : 'No provider allowance is reported in this account’s current usage data.'} Counts reflect Lumen activity, not account-wide billing or proof of successful replies.</p>
          </details>
        </section>
      ) : !phone && (
        <aside className="rc-provider-pick">
          <h3>{connected.length ? 'Choose a provider' : 'Connect your first provider'}</h3>
          <p>{connected.length ? 'See its key, permission and model discovery, step by step.' : 'Save a provider key, allow the provider, and Lumen lists its models for Auto and for you.'}</p>
          {!connected.length && <button type="button" className="rc-primary" onClick={() => openSettings('keys')}><Plus size={16} aria-hidden="true" />Connect a provider</button>}
        </aside>
      )}
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
      <h3 className="rc-group-label">Models <span>{models.length} in catalog</span></h3>
      {(models.length > 24 || query) && <div className="rc-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Find a model" placeholder="Find a model" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} /></div>}
      <div className="rc-group">
        {filtered.slice(current * 24, (current + 1) * 24).map((m) => {
          const left = remaining(usage, m.id), seen = usage?.models[m.id];
          return (
            <article className="rc-model" key={m.id}>
              <div><h4>{m.label}</h4>
                <p>{m.context ? `${formatTokens(m.context)} context` : 'Context unknown'}{m.metadata?.verification === 'unchecked' ? ' · Declared, unchecked' : ''}{m.metadata?.stale ? ' · Cached metadata' : ''} · {left === null ? 'Allowance unknown' : `${left} requests remaining${m.id.startsWith('openrouter:') && m.id.endsWith(':free') ? ' · shared pool' : ' · model limit'}`}{seen?.blockedUntil && seen.blockedUntil > Date.now() ? ' · Temporarily limited' : ''}</p>
                <code>{m.id}</code></div>
              <UseModel model={m} />
            </article>
          );
        })}
        {!filtered.length && <div className="rc-empty"><h4>{models.length ? 'No models match.' : 'No catalog models'}</h4><p>{models.length ? 'Clear your model search.' : 'Check the connection and permissions in Settings to discover models.'}</p></div>}
      </div>
      {filtered.length > 24 && <nav className="rc-pages" aria-label="Model pages"><button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button><span role="status">{current * 24 + 1}–{Math.min(filtered.length, (current + 1) * 24)} of {filtered.length}</span><button type="button" disabled={current + 1 === pages} onClick={() => setPage(current + 1)}>Next</button></nav>}
    </section>
  );
}

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

/** Recent answers: the latest answer in each of your recent chats, which model gave it and why. Read from this account's
 * own chats; nothing is estimated. */
function RecentAnswers() {
  const chats = useStore((s) => s.chats), catalog = useStore((s) => s.catalog);
  const recent = useMemo(() => chats.filter((c) => !isTemporaryChat(c)).map((c) => {
    for (let i = c.messages.length - 1; i >= 0; i--) { const m = c.messages[i]; if (m.role === 'assistant' && m.model && m.status !== 'streaming') return { chat: c, m }; }
    return null;
  }).filter((x): x is NonNullable<typeof x> => Boolean(x)).sort((a, b) => b.m.createdAt - a.m.createdAt).slice(0, 4), [chats]);
  const open = (id: string) => { closeRoutingCenter(); useStore.getState().selectChat(id); };
  return (
    <section className="rc-block rc-answers" aria-labelledby="rc-answers-title">
      <h3 className="rc-group-label" id="rc-answers-title">Recent answers</h3>
      {recent.length ? <ol className="rc-trail">{recent.map(({ chat, m }) => (
        <li key={chat.id}><button type="button" onClick={() => open(chat.id)}>
          <span className="rc-trail-model">{modelLabel(catalog, m.model!)}</span>
          <span className="rc-trail-why">{m.route ? routeWords(m.route) : 'No route recorded'}</span>
          <span className="rc-trail-chat" dir="auto">{chat.title}<span> · {ago(m.createdAt)}</span></span>
        </button></li>
      ))}</ol> : <p className="rc-muted">Each answer will show here with the model that gave it and why.</p>}
    </section>
  );
}

export default function RoutingCenter() {
  const { open, section } = useRoutingCenter();
  const chat = useStore(selectCurrentChat), model = useStore(selectCurrentModel);
  const catalog = useStore((s) => s.catalog), config = useStore((s) => s.settings), usage = useStore((s) => s.usage);
  const owner = useStore((s) => s.user?.uid), currentId = useStore((s) => s.currentId);
  const covered = useStore((s) => s.settingsOpen || Boolean(s.page));
  const providers = useProviderRows();
  const phone = usePhone();
  const [editing, setEditing] = useState<Layout | null>(null);
  const [query, setQuery] = useState('');
  // A provider opened from the overview: the Providers page opens on it.
  const [focusProvider, setFocusProvider] = useState<string | null>(null);
  const page = useRef<HTMLElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const detailBack = useRef<(() => boolean) | null>(null), came = useRef<RoutingSection>('overview');
  const [providerOpen, setProviderOpen] = useState(false);
  // Another conversation or account is another context: the Routing Center closes.
  const opened = useRef({ owner, currentId });
  useEffect(() => { if (open) opened.current = { owner, currentId }; }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && (opened.current.owner !== owner || opened.current.currentId !== currentId)) closeRoutingCenter(); }, [open, owner, currentId]);
  useEffect(() => { if (open) heading.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => {
    setEditing(null); if (page.current) page.current.scrollTop = 0;
    if (section !== 'providers') setFocusProvider(null);
    // Phones show one section at a time: its heading takes focus; back on the overview, the row you came from does.
    if (!phone || !open) return;
    if (section === 'overview') page.current?.querySelector<HTMLElement>(`.rc-sections [data-section="${came.current}"]`)?.focus();
    else { came.current = section; page.current?.querySelector<HTMLElement>('.rc-body h2')?.focus({ preventScroll: true }); }
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps
  // Phones: a section is a page over the overview. Back (or Safari's edge swipe) closes an open provider, then the section.
  useBackLayer(open && phone && section !== 'overview', () => { if (!detailBack.current?.()) showRoutingSection('overview'); });
  // Phones: on the overview, swipe right to go back to the chat, as from the other pages shown in its place.
  useEffect(() => {
    const el = page.current;
    if (!open || !el) return;
    return installSwipeBack(el, () => window.matchMedia(PHONE).matches && !el.querySelector('.rc-sections-page, .rc-provider-detail, [role="dialog"]'), () => {}, closeRoutingCenter, { reveal: () => document.querySelector<HTMLElement>('.app > .main') });
  }, [open]);
  if (!open) return null;

  const last = chat?.messages.findLast((m) => m.role === 'assistant' && m.model && m.status === 'done');
  const routed = model === 'auto' || model.startsWith('layout:');
  const current = routed ? last?.model : model;
  const left = current ? remaining(usage, current) : null;
  const models = catalog?.models || [], layouts = config.layouts || [];
  const mine = providers.filter((p) => p.keySaved || p.enabled);
  const ready = providers.filter((p) => lightOf(p) === 'on').length;
  const attention = providers.filter((p) => p.presentation.attention).length;
  const q = query.trim().toLowerCase();
  const inventory = models.filter((m) => `${m.label} ${m.name} ${m.provider}`.toLowerCase().includes(q));
  const choices = config.enabledModels.filter((id) => models.some((m) => m.id === id)).length;
  const layout = model.startsWith('layout:') ? layouts.find((l) => `layout:${l.id}` === model) : undefined;
  const sentence = model === 'auto'
    ? (choices && ready ? `Chooses a model for each message from your ${plural(choices, 'enabled model')} across ${plural(ready, 'ready provider')}.` : 'Connect a provider so Auto has models to choose from.')
    : layout ? `Your Layout ${layout.name} sets which models answer, in order, with its fallback rule.` : 'This conversation always uses this model.';
  const values: Record<Exclude<RoutingSection, 'overview'>, string> = {
    providers: mine.length ? `${ready} ready${attention ? ` · ${attention} need attention` : ''}${mine.length - ready - attention > 0 ? ` · ${mine.length - ready - attention} off` : ''}` : 'None connected',
    models: `${plural(models.length, 'model')} · ${choices} enabled`,
    policies: plural(layouts.length, 'Layout'),
    usage: left === null ? 'Allowance · Unknown' : `${left} requests left`,
    diagnostics: last?.route ? 'Latest decision recorded' : 'Decision evidence',
  };
  const go = (id: RoutingSection) => showRoutingSection(id);
  const openProvider = (id: string) => { setFocusProvider(id); go('providers'); };
  const sub = phone && section !== 'overview';

  return (
    <section ref={page} className={`rc-page${sub ? ' rc-sections-page' : ''}`} hidden={covered} aria-labelledby="rc-title"
      onKeyDown={(e) => { if (e.key === 'Escape' && !e.defaultPrevented && !(e.target as Element).closest('[role="dialog"], [role="menu"], [role="listbox"], input, textarea, select')) { e.preventDefault(); closeRoutingCenter(); } }}>
      {/* The same bar as Library, Tools and Projects: the drawer on phones, Chat at the end. In a section on phones, the
          way back to the overview leads instead. */}
      <div className="rc-topbar">
        <button type="button" className="rc-menu" aria-label="Open sidebar" onClick={() => useStore.getState().setUi({ sidebarOpen: true })}><Menu size={20} /></button>
        {sub && (providerOpen && section === 'providers'
          ? <button type="button" className="rc-up" aria-label="Back to providers" onClick={() => detailBack.current?.()}><ChevronLeft size={18} aria-hidden="true" />Providers</button>
          : <button type="button" className="rc-up" onClick={() => go('overview')}><ChevronLeft size={18} aria-hidden="true" />Routing Center</button>)}
        <button type="button" className="rc-close" aria-label="Back to chat" onClick={closeRoutingCenter}><ArrowLeft size={18} /><span>Chat</span></button>
      </div>
      <header className={`rc-head${sub ? ' rc-head-sub' : ''}`}>
        <h1 id="rc-title" tabIndex={-1} ref={heading}>Routing Center</h1>
        {!phone && <p>Your providers, models and the rules that choose between them.</p>}
      </header>
      {!phone && (
        <nav className="rc-tabs" aria-label="Routing sections">
          {SECTIONS.map(([id, label]) => <button type="button" key={id} aria-current={section === id ? 'page' : undefined} onClick={() => go(id)}>{label}</button>)}
        </nav>
      )}

      {section === 'overview' && (
        <div className="rc-body rc-overview">
          <div className="rc-col">
            <section className="rc-route" aria-label="Current routing mode">
              <p className="rc-kicker">Your next message</p>
              <h2>{modelLabel(catalog, model)}</h2>
              <p className="rc-route-line">{sentence}</p>
              {last?.model && <p className="rc-route-last">In this chat, {modelLabel(catalog, last.model)} answered last{last.route ? <> · <RouteWhy message={last} /></> : '.'}</p>}
              <button type="button" className="rc-link" onClick={() => go(routed ? 'policies' : 'models')}>{routed ? 'Review routing policies' : 'Browse models'}<ArrowRight size={15} aria-hidden="true" /></button>
            </section>
            <RecentAnswers />
          </div>
          <div className="rc-col">
            <section className="rc-block" aria-labelledby="rc-conn-title">
              <h3 className="rc-group-label" id="rc-conn-title">Connections</h3>
              <div className="rc-group">
                {mine.map((p) => (
                  <button type="button" key={p.id} className="rc-conn" onClick={() => openProvider(p.id)}>
                    <LightDot p={p} /><span><strong>{p.label}</strong><small>{statusLine(p)}</small></span><ChevronRight size={16} aria-hidden="true" />
                  </button>
                ))}
                <button type="button" className={`rc-conn rc-conn-add${mine.length ? '' : ' rc-conn-first'}`} onClick={() => openSettings('keys')}>
                  <span className="rc-plus" aria-hidden="true"><Plus size={15} /></span><span><strong>{mine.length ? 'Connect a provider' : 'Connect your first provider'}</strong>{!mine.length && <small>Save a key and allow it; Lumen lists its models.</small>}</span><ArrowUpRight size={16} aria-hidden="true" />
                </button>
              </div>
              {mine.length > 0 && <p className="rc-footnote">Discovery lists models; it doesn’t send a message or test replies.</p>}
            </section>
            {phone ? (
              <nav className="rc-block rc-sections" aria-label="Routing sections">
                <h3 className="rc-group-label">Manage</h3>
                <div className="rc-group rc-summary">
                  {SECTIONS.slice(1).map(([id, label]) => (
                    <button type="button" key={id} data-section={id} onClick={() => go(id)}><strong>{label}</strong><span>{values[id as Exclude<RoutingSection, 'overview'>]}</span><ChevronRight size={16} aria-hidden="true" /></button>
                  ))}
                </div>
              </nav>
            ) : (
              <section className="rc-block" aria-labelledby="rc-glance-title">
                <h3 className="rc-group-label" id="rc-glance-title">At a glance</h3>
                <div className="rc-group rc-summary">
                  {(['models', 'policies', 'usage'] as const).map((id) => (
                    <button type="button" key={id} data-section={id} onClick={() => go(id)}><strong>{id === 'usage' ? (routed ? 'Last answer allowance' : 'Selected model allowance') : SECTIONS.find(([s]) => s === id)![1]}</strong><span>{id === 'usage' ? (left === null ? 'Unknown' : values.usage) : values[id]}</span><ChevronRight size={16} aria-hidden="true" /></button>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {section === 'providers' && <div className="rc-body"><Providers key={`${owner || 'signed-out'}:${focusProvider || ''}`} preferred={focusProvider || current?.split(':')[0]} openDetail={Boolean(focusProvider)} phone={phone} detailBack={detailBack} onDetail={setProviderOpen} /></div>}

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
