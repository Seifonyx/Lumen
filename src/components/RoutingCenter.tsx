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
import { navigateScreen, screenBack, exitFeature, featureExitLabel } from '../lib/screen-history';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ArrowUpRight, ChevronRight, Plus, RefreshCw, Search, Shield, X } from 'lucide-react';
import { modelLabel, selectCurrentChat, selectCurrentModel, useStore } from '../store';
import { AI_PROVIDERS, EXTRA_PROVIDERS, providerEnabled } from '../lib/ai/provider-config.js';
import { PROVIDER_NAMES, providerOfId } from '../lib/util';
import { formatTokens } from '../lib/usage';
import { installSwipeBack } from '../lib/swipe-back';
import { closeRoutingCenter, showRoutingSection, showRoutingProvider, useRoutingCenter, type RoutingSection } from '../lib/routing-center';
import { findLayout } from '../lib/layouts';
import type { ModelInfo } from '../types';
import UsageTab from './UsageTab';
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
const LatestOutcome = lazy(() => extras().then((m) => ({ default: m.LatestOutcome })));
const PrismLayouts = lazy(() => import('./PrismLayouts'));
const RoutingInsight = lazy(() => import('./RoutingInsight'));

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

// Free tiers or free models, from the provider registry; the rest bill your own provider account.
const FREE_TIER = new Set(['gemini', 'openrouter', 'groq', 'cerebras', ...Object.entries(EXTRA_PROVIDERS).filter(([, v]) => (v as { free?: boolean }).free).map(([id]) => id)]);
const monogram = (label: string) => label.replace(/[^A-Za-z0-9 ]/g, ' ').trim().charAt(0).toUpperCase();
// Provider marks load in their own chunk the first time Providers shows; the letter stands in until then.
type IconSet = typeof import('../lib/provider-icons').PROVIDER_ICONS;
let iconSet: IconSet | null = null, iconLoad: Promise<IconSet> | null = null;
function useProviderIcons() {
  const [icons, setIcons] = useState(iconSet);
  useEffect(() => { if (icons) return; let live = true; (iconLoad ??= import('../lib/provider-icons').then((m) => (iconSet = m.PROVIDER_ICONS))).then((set) => { if (live) setIcons(set); }).catch(() => {}); return () => { live = false; }; }, [icons]);
  return icons;
}
function ProviderMark({ id, label }: { id: string; label: string }) {
  const paths = useProviderIcons()?.[id];
  return (
    <span className="sb-mono" aria-hidden="true">
      {paths ? <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" focusable="false">{paths.map(([d, evenodd, opacity], i) => <path key={i} d={d} fillRule={evenodd ? 'evenodd' : undefined} opacity={opacity} />)}</svg> : monogram(label)}
    </span>
  );
}

/** A provider tile: a neutral monogram, the name, and one line that says whether Lumen can use it. */
function ProviderTile({ p, onOpen }: { p: ProviderRow; onOpen: () => void }) {
  const v = verdictOf(p), n = p.models.length, connected = p.keySaved || p.enabled;
  const line = connected ? `${v.word}${n ? ` · ${plural(n, 'model')}` : ''}` : 'Not connected';
  return (
    <li>
      <button type="button" className="sb-tile" data-provider={p.id} data-light={connected ? v.light : 'none'} onClick={onOpen} aria-labelledby={`sb-${p.id}-name`} aria-describedby={`sb-${p.id}-state`}>
        <ProviderMark id={p.id} label={p.label} />
        <span className="sb-tile-text"><strong id={`sb-${p.id}-name`}>{p.label}</strong><small id={`sb-${p.id}-state`}>{connected && <LightDot light={v.light} />}{line}</small></span>
      </button>
    </li>
  );
}

function Providers({ preferred, phone, searchHost }: { preferred?: string; openDetail?: boolean; phone: boolean; searchHost: HTMLElement | null }) {
  const usage = useStore((s) => s.usage), enabledModels = useStore((s) => s.settings.enabledModels);
  const providers = useProviderRows();
  const route = useRoutingCenter();
  const detail = Boolean(route.provider);
  const [query, setQuery] = useState(''), [filter, setFilter] = useState<'all' | 'saved' | 'enabled' | 'attention'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const input = useRef<HTMLInputElement>(null), title = useRef<HTMLHeadingElement>(null);
  // A provider opens as its own page, from the top.
  useEffect(() => { if (!detail) return; title.current?.closest('.rc-scroll')?.scrollTo(0, 0); title.current?.focus({ preventScroll: true }); }, [route.provider, detail]);
  const enabled = providers.filter((p) => p.enabled).length, saved = providers.filter((p) => p.keySaved).length;
  const matches = (p: ProviderRow) => (filter === 'all' || (filter === 'saved' ? p.keySaved : filter === 'attention' ? p.presentation.attention : p.enabled)) && `${p.label} ${p.id}`.toLowerCase().includes(query.trim().toLowerCase());
  const visible = providers.filter(matches);
  const shown = detail ? providers.find((p) => p.id === route.provider) : undefined;
  const connected = visible.filter((p) => p.keySaved || p.enabled);
  const rest = visible.filter((p) => !p.keySaved && !p.enabled).sort((a, b) => a.label.localeCompare(b.label));
  const groups: [string, string, ProviderRow[]][] = [
    ['connected', 'Connected', connected],
    ['free', 'Free to start', rest.filter((p) => FREE_TIER.has(p.id))],
    ['paid', 'Uses your provider credits', rest.filter((p) => !FREE_TIER.has(p.id))],
  ];
  const open = (id: string) => showRoutingProvider(id);
  // The same catalog refresh as each provider's "Refresh model list": it lists models and sends no message.
  const refreshAll = async () => { setRefreshing(true); try { await useStore.getState().loadCatalog(true); } catch { /* each provider keeps its own status */ } finally { setRefreshing(false); } };
  void preferred;

  if (shown) return (
    <section className="rc-providers sb-detail-page" aria-label="Provider detail page">
      {!phone && <button type="button" className="sb-back" onClick={() => screenBack(() => showRoutingProvider(null))}><ChevronLeft size={16} aria-hidden="true" />All providers</button>}
      <ProviderDetail key={shown.id} searchHost={phone ? searchHost : null} p={shown} title={title} usage={usage} enabledHere={enabledModels.filter((id) => shown.models.some((m) => m.id === id)).length} />
    </section>
  );

  const search = <div className="rc-search"><Search size={16} aria-hidden="true" /><input ref={input} type="search" aria-label="Find a provider" placeholder="Find a provider" value={query} onChange={(e) => setQuery(e.target.value)} />{query && <button type="button" aria-label="Clear provider search" onClick={() => { setQuery(''); input.current?.focus(); }}><X size={16} /></button>}</div>;

  return (
    <section className="rc-providers sb-providers" aria-label="Provider browser">
      <header className="sb-head">
        <div className="sb-head-title"><h2>Providers</h2><p className="rc-count" role="status">{saved} {saved === 1 ? 'key' : 'keys'} saved · {enabled} enabled · {providers.length} available</p></div>
        <div className="sb-head-tools">
          {!phone && search}
          <FilterMenu<typeof filter> label="Filter providers" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All providers', count: providers.length }, { value: 'saved', label: 'Saved keys', count: saved }, { value: 'enabled', label: 'Enabled providers', count: enabled }, { value: 'attention', label: 'Needs attention', count: providers.filter((p) => p.presentation.attention).length }]} />
          <button type="button" className="rc-add" aria-label="Connect a provider" onClick={() => openSettings('keys')}><Plus size={16} aria-hidden="true" /><span>Connect</span></button>
        </div>
      </header>
      {phone && !detail && searchHost && createPortal(search, searchHost)}
      {groups.map(([id, label, rows]) => rows.length > 0 && (
        <section key={id} className="sb-group" aria-labelledby={`sb-group-${id}`}>
          <div className="sb-group-head">
            <h3 id={`sb-group-${id}`}>{label} <span>{rows.length}</span></h3>
            {id === 'connected' && enabled > 0 && <button type="button" className="sb-refresh" disabled={refreshing} onClick={() => void refreshAll()}><RefreshCw size={14} className={refreshing ? 'spin' : undefined} aria-hidden="true" />{refreshing ? 'Refreshing…' : 'Refresh model lists'}</button>}
          </div>
          <ul className="sb-grid">{rows.map((p) => <ProviderTile key={p.id} p={p} onOpen={() => open(p.id)} />)}</ul>
        </section>
      ))}
      {!visible.length && <div className="rc-empty"><p>No providers match.</p><button type="button" className="rc-link" onClick={() => { setQuery(''); setFilter('all'); input.current?.focus(); }}>Reset provider filters</button></div>}
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
          <div className="sb-detail-title"><ProviderMark id={p.id} label={p.label} /><h2 tabIndex={-1} ref={title}>{p.label}</h2></div>
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
    <section ref={page} className={`rc-page${sub ? ' rc-sections-page' : ''}${drill ? ' rc-drill' : ''}`} hidden={covered} aria-label="Router — Models, providers & routing"
      onKeyDown={(e) => { if (e.key === 'Escape' && !e.defaultPrevented && !(e.target as Element).closest('[role="dialog"], [role="menu"], [role="listbox"], input, textarea, select')) { e.preventDefault(); screenBack(closeRoutingCenter); } }}>
      {/* Desktop retains split-view navigation; phone chrome is shared with Library, Tools and Settings. */}
      {phone ? <PhoneNavigation title={providerOpen && provider ? providerLabel(provider) : 'Router'} onBack={closeRoutingCenter} actions={providerOpen ? <Suspense fallback={null}><ScreenActions actions={[{ label: 'Connection settings', run: () => openProviderSettings(provider!) }]} /></Suspense> : undefined} /> : (
      <header className={`rc-head${sub ? ' rc-head-sub' : ''}`}>
        <button type="button" className="icon-btn feature-exit" aria-label={featureExitLabel()} onClick={() => exitFeature()}><ChevronLeft size={26} /></button>
        <div className="rc-brand"><h1 id="rc-title" tabIndex={-1} ref={heading}>Router</h1><p>Models, providers &amp; routing</p></div>
        {!phone && (
          <nav className="rc-tabs" aria-label="Router sections">
            {SECTIONS.map(([id, label]) => <button type="button" key={id} aria-current={section === id ? 'page' : undefined} onClick={() => go(id)}>{label}</button>)}
          </nav>
        )}
      </header>)}



      {phone && !providerOpen && <PhoneSections label="Router sections" active={section} items={SECTIONS.map(([id,label]) => ({ id, label }))} onSelect={id => go(id as RoutingSection)} />}
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

      {section === 'usage' && <div className="rc-body rc-usage"><div className="rc-page-intro"><p className="rc-kicker">Evidence from separate sources</p><h2 className="rc-h2">Usage</h2><p className="rc-muted">Lumen’s synced daily counters and history reconstructed from saved chats answer different questions. Provider limits appear only when known.</p></div><UsageTab context="prism" /><Suspense fallback={<p className="rc-muted" role="status">Loading saved-chat history…</p>}><UsageHistory /></Suspense></div>}

      {section === 'diagnostics' && (
        <div className="rc-body">
          <div className="rc-page-intro"><p className="rc-kicker">Saved evidence, kept private</p><h2 className="rc-h2">Diagnostics</h2><p className="rc-muted">See how recorded requests ended and what routing evidence exists. Lumen does not add probes or expose message content here.</p></div>
          <div className="rc-grid rc-diagnostics">
            <Suspense fallback={<p className="rc-muted" role="status">Loading latest outcome…</p>}><LatestOutcome /></Suspense>
            <Suspense fallback={<p className="rc-muted" role="status">Loading request history…</p>}><RequestLog /></Suspense>
            <section className="rc-card"><h3><Shield size={16} /> Privacy boundary</h3><p className="rc-muted">Provider credentials stay in Lumen’s existing account scope. No prompt bodies or credentials are added to a diagnostic history.</p></section>
          </div>
        </div>
      )}

      </div>
      {phone && <footer ref={setSearchHost} className="phone-page-search rc-search-footer" aria-label={section === 'providers' ? providerOpen ? 'Provider model search' : 'Provider search' : 'Model search'} />}
    </section>
  );
}
