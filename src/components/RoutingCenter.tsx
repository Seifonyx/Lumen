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
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, ChevronRight, Plus, Search, Shield, X } from 'lucide-react';
import { modelLabel, selectCurrentChat, selectCurrentModel, useStore } from '../store';
import { AI_PROVIDERS, providerEnabled } from '../lib/ai/provider-config.js';
import { PROVIDER_NAMES, providerOfId } from '../lib/util';
import { formatTokens } from '../lib/usage';
import { installSwipeBack } from '../lib/swipe-back';
import { closeRoutingCenter, showRoutingSection, showRoutingProvider, useRoutingCenter, type RoutingSection } from '../lib/routing-center';
import { findLayout } from '../lib/layouts';
import type { ModelInfo } from '../types';
import UsageTab from './UsageTab';
import RouteWhy from './RouteWhy';
import { providerPresentation } from '../lib/provider-presentation';
import { requestProviderSettings } from '../lib/provider-settings-target';
import FilterMenu from './FilterMenu';
import { currentRoutingPresentation } from '../lib/routing-presentation';
import { selectionProblem, withCurrentModel } from '../lib/model-discovery';
// Tier 5 panels (usage history, request log, routing file, connection check) load on first use, in their own chunk.
const ScreenActions = lazy(() => import('./ScreenActions'));
const extras = () => import('./RoutingExtras');
const CheckConnection = lazy(() => extras().then((m) => ({ default: m.CheckConnection })));
const UsageHistory = lazy(() => extras().then((m) => ({ default: m.UsageHistory })));
const RequestLog = lazy(() => extras().then((m) => ({ default: m.RequestLog })));
const PrismLayouts = lazy(() => import('./PrismLayouts'));
const RoutingInsight = lazy(() => import('./RoutingInsight'));
const RecentAnswers = lazy(() => extras().then((m) => ({ default: m.RecentAnswers })));

const PrismModels = lazy(() => import('./PrismModels'));
const ProviderModels = lazy(() => import('./PrismModels').then(m => ({ default: m.ProviderModels })));

const SECTIONS: [RoutingSection, string][] = [['models', 'Models'], ['providers', 'Providers'], ['policies', 'Layouts'], ['usage', 'Usage'], ['diagnostics', 'Diagnostics']];
// Phones use a feature index and pushed screens; canonical UI history owns every Back path.
const providerId = (model: ModelInfo) => (model.provider === 'google' ? 'gemini' : model.provider);
const providerLabel = (id: string) => (id === 'gemini' ? 'Google AI Studio' : PROVIDER_NAMES[providerOfId(id + ':')] || id);
const openSettings = (tab: string) => useStore.getState().setUi({ settingsOpen: true, settingsTab: tab, sidebarOpen: false });
const openProviderSettings = (provider: string) => {
  navigateScreen(() => { if (requestProviderSettings(provider, useStore.getState().user?.uid)) openSettings('keys'); });
};
type State = ReturnType<typeof useStore.getState>;

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
      <Suspense fallback={<p className="rc-muted" role="status">Loading models…</p>}><ProviderModels searchHost={searchHost} models={p.models} /></Suspense>
      <details className="rc-provenance"><summary>Connection details &amp; usage</summary>
        <dl className="rc-facts">{facts.map(([k, value, light]) => <div key={k} data-fact={k} data-light={light}><dt>{k}</dt><dd>{value}</dd></div>)}</dl>
        <div className="rc-usage-pair"><div><span>Requests recorded in Lumen</span><strong>{usage ? `${requests} requests` : 'Unknown'}</strong></div><div><span>Tokens recorded in Lumen</span><strong>{usage ? formatTokens(tokens) : 'Unknown'}</strong></div></div>
        <p className="rc-muted">{sharedLeft !== null ? `One shared allowance for OpenRouter free models: ${usage!.openrouter.used} of ${usage!.openrouter.limit} requests recorded. Paid models are excluded.` : knownLimits.length ? 'Known limits belong to individual models; they are not a combined provider balance.' : 'No provider allowance is reported in this account’s current usage data.'} Counts reflect Lumen activity, not account-wide billing or proof of successful replies.</p>
      </details>
    </section>
  );
}

export default function RoutingCenter() {
  const { open, section, provider } = useRoutingCenter();
  const chat = useStore(selectCurrentChat), model = useStore(selectCurrentModel);
  const catalog = useStore((s) => s.catalog), config = useStore((s) => s.settings);
  const owner = useStore((s) => s.user?.uid), currentId = useStore((s) => s.currentId);
  const authed = useStore(s => s.authed), user = useStore(s => s.user), keys = useStore(s => s.keys);
  const covered = useStore((s) => s.settingsOpen || Boolean(s.page));
  const providers = useProviderRows();
  const phone = usePhoneLayout();
  const [insightOpen, setInsightOpen] = useState(false);
  useEffect(() => { if (!open) setInsightOpen(false); }, [open]);
  const [searchHost, setSearchHost] = useState<HTMLElement | null>(null);

  const page = useRef<HTMLElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const providerOpen = Boolean(provider);
  // Another conversation or account is another context: the Routing Center closes.
  const opened = useRef({ owner, currentId });
  useEffect(() => { if (open) opened.current = { owner, currentId }; }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && (opened.current.owner !== owner || opened.current.currentId !== currentId)) closeRoutingCenter(); }, [open, owner, currentId]);
  useEffect(() => { if (open) heading.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => {
    if (page.current) { page.current.scrollTop = 0; page.current.querySelector('.rc-scroll')?.scrollTo(0,0); }
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
  const models = catalog?.models || [];
  const mine = providers.filter((p) => p.keySaved || p.enabled);
  const layout = model.startsWith('layout:') ? findLayout(model, models, config.layouts, config.hiddenLayouts) : undefined;
  const picked = !routed ? withCurrentModel(models, model, modelLabel(catalog, model)).find(m => m.id === model) : undefined;
  const currentProblem = picked ? selectionProblem({ authed, user, keys, catalog, settings: config }, picked) : null;
  const recovery = currentProblem && <p className="rc-muted">{currentProblem} <button type="button" className="rc-link" onClick={() => currentProblem.includes('provider') || currentProblem.includes('connection') ? openProviderSettings(providerId(picked!)) : openSettings('models')}>Review model settings</button></p>;
  const sentence = currentRoutingPresentation(model, config, catalog).description;
  // Who the route can reach, in words: Auto's enabled models, a Layout's models in order, or a chosen model's provider.
  const pool = model === 'auto' ? models.filter((m) => config.enabledModels.includes(m.id)).map((m) => m.label) : layout ? layout.models.map((id) => modelLabel(catalog, id)) : [];
  const reach = pool.length ? `${pool.slice(0, 3).join(layout?.mode === 'order' ? ' → ' : ' · ')}${pool.length > 3 ? ` +${pool.length - 3} more` : ''}`
    : picked ? `${providerLabel(providerId(picked))}${picked.context ? ` · ${formatTokens(picked.context)} context` : ''}` : '';
  const go = (id: RoutingSection) => showRoutingSection(id);
  const sub = phone && section !== 'models';




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
              <details className="rc-current-disclosure" open={insightOpen} onToggle={e => setInsightOpen(e.currentTarget.open)}>
                <summary>
                  <span className="rc-current-identity"><span className="rc-kicker">{currentProblem ? 'Current choice · Needs setup' : 'Next message in this chat'}</span><strong className="rc-current-model">{modelLabel(catalog, model)}</strong></span>
                  <span className="rc-current-more-label">Details <ChevronRight size={15} aria-hidden="true" /></span>
                </summary>
                <div className="rc-current-explanation">{recovery}<p className="rc-muted">{sentence}</p>{reach && <p className="rc-muted rc-current-reach">{reach}</p>}{insightOpen && <Suspense fallback={<p className="rc-muted">Loading routing details…</p>}><RoutingInsight /></Suspense>}</div>
              </details>
            ) : (
              <>
                <p className="rc-kicker">Next message in this chat</p>
                <h2>{modelLabel(catalog, model)}</h2>
                {recovery}
                <p className="rc-muted">{sentence}</p>
                {reach && <p className="rc-muted rc-current-reach">{reach}</p>}
                <details open={insightOpen} onToggle={e => setInsightOpen(e.currentTarget.open)}><summary>Routing details</summary>{insightOpen && <Suspense fallback={<p className="rc-muted">Loading routing details…</p>}><RoutingInsight /></Suspense>}</details>
              </>
            )}
            {!mine.length && <button type="button" className="rc-primary" onClick={() => openSettings('keys')}><Plus size={15} aria-hidden="true" />Connect a provider</button>}
          </section>
          <Suspense fallback={<p className="rc-muted" role="status">Loading models…</p>}><PrismModels models={models} searchHost={phone ? searchHost : null} /></Suspense>
        </div>
      )}

      {section === 'policies' && <Suspense fallback={<p className="rc-muted" role="status">Loading Layouts…</p>}><PrismLayouts /></Suspense>}

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
