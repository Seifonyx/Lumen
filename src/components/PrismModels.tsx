// Lazy Prism model ledger: canonical catalog/settings only. No independent selection or eligibility owner.
import { useMemo, useRef } from 'react';
import './router-models.css';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { useBackLayer } from '../lib/back-stack';
import { screenBack } from '../lib/screen-history';
import { usePhoneLayout } from '../lib/phone-layout';
import { allLayouts, findLayout, LAYOUT_PREFIX } from '../lib/layouts';
import { currentRoutingPresentation, layoutPreview } from '../lib/routing-presentation';
import { showRoutingSection } from '../lib/routing-center';
import { BrandMark } from '../lib/canvas-presentation';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { modelLabel, selectCurrentModel, useStore } from '../store';
import { formatTokens, remaining } from '../lib/usage';
import { modelCapabilities, selectionIndex, selectionProblem, withCurrentModel } from '../lib/model-discovery';
import { matchesModel, modelProvider, modelProviderLabel } from '../lib/model-search';
import { useScreenMemory } from '../lib/screen-memory';
import { navigateScreen } from '../lib/screen-history';
import { closeRoutingCenter } from '../lib/routing-center';
import { requestProviderSettings } from '../lib/provider-settings-target';
import FilterMenu from './FilterMenu';
import type { ModelInfo } from '../types';

type Filter = 'all' | 'selectable' | 'selected' | 'vision' | 'pdf' | 'search' | 'thinking';
const PAGE = 24, FEW = 8;

function UseModel({ model, problem, onChosen }: { model: ModelInfo; problem: string | null; onChosen?: () => void }) {
  const owner = useStore(s => s.user?.uid), conversation = useStore(s => s.currentId);
  const recover = () => navigateScreen(() => {
    const fresh = useStore.getState();
    if (fresh.user?.uid !== owner || fresh.currentId !== conversation) return;
    const provider = modelProvider(model);
    const connection = !fresh.keys[provider as keyof typeof fresh.keys] || problem?.includes('provider') || problem?.includes('connection');
    if (connection && requestProviderSettings(provider, owner)) fresh.setUi({ settingsOpen: true, settingsTab: 'keys' });
    else fresh.setUi({ settingsOpen: true, settingsTab: 'models' });
  });
  return <div className="rc-use">
    <button type="button" disabled={Boolean(problem)} aria-label={`Use ${model.label}`} aria-describedby={problem ? `rc-why-${model.id}` : undefined} onClick={() => {
      const fresh = useStore.getState();
      if (fresh.user?.uid !== owner || fresh.currentId !== conversation || selectionProblem(fresh, model)) return;
      onChosen?.();
      fresh.setChatModel(model.id);
      closeRoutingCenter();
      fresh.toast(`Now using ${model.label} in this chat`);
      // The real composer remained mounted. Focus without rewriting its draft, selection, undo or attachments.
      requestAnimationFrame(() => {
        const now = useStore.getState();
        if (now.user?.uid === owner && now.currentId === conversation && !now.settingsOpen && !now.page)
          document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus({ preventScroll: true });
      });
    }}>Use</button>
    {problem && <button type="button" className="rc-model-recover" onClick={recover}>{problem.includes('provider') || problem.includes('connection') ? 'Provider settings' : 'Manage model'}</button>}
  </div>;
}

function ModelRow({ model: m, problem, selected }: { model: ModelInfo; problem: string | null; selected: boolean }) {
  const usage = useStore(s => s.usage);
  const left = remaining(usage, m.id), seen = usage?.models[m.id];
  const flags = [m.metadata?.verification === 'unchecked' && 'Declared, unchecked', m.metadata?.stale && 'Cached metadata', seen?.blockedUntil && seen.blockedUntil > Date.now() && 'Temporarily limited'].filter(Boolean);
  const capabilities = modelCapabilities(m);
  return <article className="rc-model" data-model={m.id} aria-label={m.label} aria-current={selected ? 'true' : undefined}>
    <div><h4>{m.label}{selected && <small className="rc-selected">Selected</small>}</h4><small>{modelProviderLabel(m)}</small>{m.metadata?.verification === 'unchecked' && <small>Declared, unchecked</small>}{m.metadata?.stale && <small>Cached metadata</small>}</div>
    <p><span>{m.context ? `${formatTokens(m.context)} context` : 'Context unknown'}</span>{left !== null && <span>{left} requests left{m.id.startsWith('openrouter:') && m.id.endsWith(':free') ? ' · shared pool' : ''}</span>}</p>
    <UseModel model={m} problem={problem} />
    {problem && <small className="rc-model-note" id={`rc-why-${m.id}`}>{problem}</small>}
    <details className="rc-model-details"><summary>Model details</summary><div><code>{m.id}</code><p>{capabilities.length ? capabilities.join(' · ') : 'Capabilities not reported'}</p><p>{flags.join(' · ') || 'Catalog metadata; replies not tested here.'}</p>{left === null && <p>Allowance unknown</p>}</div></details>
  </article>;
}

/** Shared bounded inventory: the provider detail retains its own concise model heading and search slot. */
export function ProviderModels({ models, searchHost }: { models: ModelInfo[]; searchHost: HTMLElement | null }) {
  return <section className="rc-provider-models" aria-label="Provider models"><h3 className="rc-group-label">Models <span>{models.length} in catalog</span></h3><Inventory models={models} searchHost={searchHost} providerOnly /></section>;
}

export default function PrismModels({ models, searchHost }: { models: ModelInfo[]; searchHost: HTMLElement | null }) {
  return <ModelsConsole models={models} searchHost={searchHost} />;
}
function Inventory({ models, searchHost, providerOnly = false }: { models: ModelInfo[]; searchHost: HTMLElement | null; providerOnly?: boolean }) {
  const conversation = useStore(s => s.currentId);
  const scope = providerOnly ? `prism-provider-models:${models[0] ? modelProvider(models[0]) : 'empty'}` : `prism-models:${conversation || 'new'}`;
  const [browse, setBrowse] = useScreenMemory(scope, { query: '', filter: 'all' as Filter, page: 0 });
  const { query, filter, page } = browse;
  const setPage = (value: number) => setBrowse(s => ({ ...s, page: value }));
  const setQuery = (value: string) => setBrowse(s => ({ ...s, query: value }));
  const setFilter = (value: Filter) => setBrowse(s => ({ ...s, filter: value }));
  const input = useRef<HTMLInputElement>(null), list = useRef<HTMLDivElement>(null);
  const keys = useStore(s => s.keys), catalog = useStore(s => s.catalog), settings = useStore(s => s.settings), authed = useStore(s => s.authed), user = useStore(s => s.user);
  const current = useStore(selectCurrentModel);
  const entries = useMemo(() => {
    const context = { keys, catalog, settings, authed, user };
    // Compute the unchanged manual gates once per inventory change, not once per unrelated store update.
    const index = selectionIndex(context);
    const inventory = providerOnly ? models : withCurrentModel(models, current, settings.unavailableInfo?.[current]?.label || modelLabel(catalog, current));
    return inventory.map(m => ({ model: m, problem: selectionProblem(context, m, index) }))
      .sort((a,b) => Number(!b.problem) - Number(!a.problem) || Number(b.model.id === current) - Number(a.model.id === current));
  }, [models, keys, catalog, settings, authed, user, current, providerOnly]);
  const matches = entries.filter(e => matchesModel(e.model, query));
  const accepts = (e: typeof entries[number], value: Filter) => value === 'all' || (value === 'selectable' ? !e.problem : value === 'selected' ? e.model.id === current : e.model[value] === true);
  const filtered = matches.filter(e => accepts(e, filter));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE)), index = Math.min(page, pages - 1);
  const options: {value:Filter;label:string}[] = [{value:'all',label:'All models'},{value:'selectable',label:'Selectable'},{value:'selected',label:'Selected'},...(['vision','pdf','search','thinking'] as const).filter(key => key === filter || models.some(m => m[key] === true)).map(key => ({value:key,label:{vision:'Reads images',pdf:'Reads PDFs',search:'Web search',thinking:'Reasoning'}[key]}))];
  const changePage = (value: number) => {
    setPage(value);
    requestAnimationFrame(() => { list.current?.scrollIntoView({ block: 'start' }); list.current?.focus({ preventScroll: true }); });
  };
  const changeQuery = (value: string) => { setQuery(value); setPage(0); };
  const search = <div className="rc-search"><Search size={16} aria-hidden="true" /><input ref={input} type="search" aria-label={providerOnly ? 'Find a model' : 'Search models'} placeholder="Search models or providers" value={query} onChange={e => changeQuery(e.target.value)} />{query && <button type="button" aria-label={providerOnly ? 'Clear provider model search' : 'Clear model search'} onClick={() => { changeQuery(''); input.current?.focus(); }}><X size={16} aria-hidden="true" /></button>}</div>;
  return <>
    {!providerOnly && <div className="rc-model-toolbar"><h2>Models <small className="rc-muted">{filtered.length}</small></h2><FilterMenu label="Filter models" value={filter} options={options.map(o => ({...o,count:matches.filter(e=>accepts(e,o.value)).length}))} onChange={value=>{setFilter(value);setPage(0);}} /></div>}
    {/* Search earns its place once there is a list to search. */}
    {(entries.length > FEW || query) && (!providerOnly || models.length > PAGE || query) && (searchHost ? createPortal(search, searchHost) : search)}
    {filtered.length ? <div className="rc-group" role="group" aria-label="Model results" tabIndex={-1} ref={list}>{filtered.slice(index*PAGE,(index+1)*PAGE).map(e=><ModelRow key={e.model.id} {...e} selected={current===e.model.id} />)}</div> : <div className="rc-empty" role="status"><p>{models.length ? 'No models match.' : 'No models listed yet. Connect a provider to discover models.'}</p>{(query || filter!=='all') && <button type="button" className="rc-link" onClick={()=>{changeQuery('');setFilter('all');input.current?.focus();}}>Reset model filters</button>}</div>}
    {pages>1 && <nav className="rc-pages" aria-label="Model pages"><button type="button" disabled={!index} onClick={()=>changePage(index-1)}>Previous</button><span role="status">{index*PAGE+1}–{Math.min(filtered.length,(index+1)*PAGE)} of {filtered.length}</span><button type="button" disabled={index+1===pages} onClick={()=>changePage(index+1)}>Next</button></nav>}
  </>;
}


/** Browse focus is presentation state. Canonical selection only changes through Use. */
function ModelsConsole({ models }: { models: ModelInfo[]; searchHost: HTMLElement | null }) {
  const conversation = useStore(s => s.currentId), owner = useStore(s => s.user?.uid);
  const keys = useStore(s => s.keys), catalog = useStore(s => s.catalog), settings = useStore(s => s.settings), authed = useStore(s => s.authed), user = useStore(s => s.user);
  const current = useStore(selectCurrentModel), phone = usePhoneLayout();
  const [browse, setBrowse] = useScreenMemory(`router-model-console:${conversation || 'new'}`, { query: '', filter: 'all' as Filter, page: 0, focus: '', pushed: false });
  const input = useRef<HTMLInputElement>(null), list = useRef<HTMLDivElement>(null), detail = useRef<HTMLElement>(null);
  const currentOwner = () => useStore.getState().user?.uid === owner && useStore.getState().currentId === conversation;
  const close = () => { if (currentOwner()) setBrowse(s => ({ ...s, pushed: false })); };
  useBackLayer(phone && browse.pushed, close, () => { if (currentOwner()) setBrowse(s => ({ ...s, pushed: true })); }, `router-model:${browse.focus}`);
  const entries = useMemo(() => {
    const state = { keys, catalog, settings, authed, user }, index = selectionIndex(state);
    return withCurrentModel(models, current, settings.unavailableInfo?.[current]?.label || modelLabel(catalog, current))
      .map(model => ({ model, problem: selectionProblem(state, model, index) }))
      .sort((a, b) => Number(!b.problem) - Number(!a.problem) || Number(b.model.id === current) - Number(a.model.id === current));
  }, [models, current, keys, catalog, settings, authed, user]);
  const layouts = useMemo(() => allLayouts(catalog?.models || [], settings.layouts, settings.hiddenLayouts).filter(l => l.models.length), [catalog, settings.layouts, settings.hiddenLayouts]);
  const matches = entries.filter(e => matchesModel(e.model, browse.query));
  const accepts = (e: typeof entries[number], filter: Filter) => filter === 'all' || (filter === 'selectable' ? !e.problem : filter === 'selected' ? e.model.id === current : e.model[filter] === true);
  const filtered = matches.filter(e => accepts(e, browse.filter));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE)), page = Math.min(browse.page, pages - 1);
  const options: {value: Filter; label: string}[] = [{ value: 'all', label: 'All models' }, { value: 'selectable', label: 'Selectable' }, { value: 'selected', label: 'Selected' }, ...(['vision', 'pdf', 'search', 'thinking'] as const).filter(key => key === browse.filter || models.some(m => m[key])).map(key => ({ value: key, label: {vision:'Reads images',pdf:'Reads PDFs',search:'Web search',thinking:'Reasoning'}[key] }))];
  const inspect = (id: string) => { setBrowse(s => ({ ...s, focus: id, pushed: phone })); requestAnimationFrame(() => detail.current?.focus({ preventScroll: true })); };
  const focus = browse.focus || current;
  const chosen = entries.find(e => e.model.id === focus);
  const layout = focus.startsWith(LAYOUT_PREFIX) ? findLayout(focus, catalog?.models || [], settings.layouts, settings.hiddenLayouts) : undefined;
  const route = currentRoutingPresentation(focus, settings, catalog);
  const changeQuery = (query: string) => setBrowse(s => ({ ...s, query, page: 0 }));
  const useChoice = () => {
    const fresh = useStore.getState();
    if (!currentOwner() || !fresh.authed || !fresh.user) return;
    const liveLayout = focus.startsWith(LAYOUT_PREFIX) ? findLayout(focus, fresh.catalog?.models || [], fresh.settings.layouts, fresh.settings.hiddenLayouts) : undefined;
    if (focus !== 'auto' && !liveLayout?.models.length) return;
    setBrowse(s => ({ ...s, pushed: false }));
    fresh.setChatModel(focus); closeRoutingCenter(); fresh.toast(`Now using ${liveLayout?.name || 'Auto'} in this chat`);
    requestAnimationFrame(() => { const now = useStore.getState(); if (currentOwner() && !now.settingsOpen && !now.page) document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus({ preventScroll: true }); });
  };
  const visible = filtered.slice(page * PAGE, (page + 1) * PAGE);
  const groups = [...new Set(visible.map(e => modelProvider(e.model)))];
  const choiceRow = (id: string, label: string, description: string) => <button type="button" key={id} className="rm-choice" data-inspected={focus === id} onClick={() => inspect(id)} aria-label={`Inspect ${label}`}><span className="rm-model-mark">{id === 'auto' && BrandMark ? <BrandMark height={21} decorative /> : <Layers size={18} aria-hidden="true" />}</span><span><strong>{label}{current === id && <small className="rc-selected">Selected</small>}</strong><small>{description}</small></span><ChevronRight size={16} aria-hidden="true" /></button>;
  return <div className="rm-console" data-detail={phone && browse.pushed || undefined} onKeyDown={e => { if (phone && browse.pushed && e.key === 'Escape' && !e.defaultPrevented && !e.nativeEvent.isComposing) { e.preventDefault(); e.stopPropagation(); screenBack(close); } }}>
    <section className="rm-browser" aria-label="Browse models">
      <header className="rm-browser-head"><div className="rm-browser-title"><h2>Browse models <small>{filtered.length}</small></h2><FilterMenu label="Filter models" value={browse.filter} options={options.map(o => ({ ...o, count: matches.filter(e => accepts(e, o.value)).length }))} onChange={filter => setBrowse(s => ({ ...s, filter, page: 0 }))} /></div>
        <div className="rc-search"><Search size={16} aria-hidden="true" /><input ref={input} type="search" aria-label="Search models" placeholder="Search models or providers" value={browse.query} onChange={e => changeQuery(e.target.value)} />{browse.query && <button type="button" aria-label="Clear model search" onClick={() => { changeQuery(''); input.current?.focus(); }}><X size={16} aria-hidden="true" /></button>}</div>
      </header>
      <div className="rm-browser-list" ref={list} tabIndex={-1}>
        {!browse.query && browse.filter === 'all' && choiceRow('auto', 'Auto', 'Lumen picks for each message')}
        {groups.map(provider => <section className="rm-provider-group" key={provider} aria-label={modelProviderLabel(visible.find(e => modelProvider(e.model) === provider)!.model)}><h3>{modelProviderLabel(visible.find(e => modelProvider(e.model) === provider)!.model)}</h3>{visible.filter(e => modelProvider(e.model) === provider).map(({ model, problem }) => <article key={model.id} className="rc-model rm-model" data-model={model.id} aria-label={model.label} aria-current={current === model.id ? 'true' : undefined}><button type="button" className="rm-choice" data-inspected={focus === model.id} onClick={() => inspect(model.id)} aria-label={`Inspect ${model.label}`}><span className="rm-model-mark" aria-hidden="true">{model.label.slice(0,1)}</span><span><strong>{model.label}{current === model.id && <small className="rc-selected">Selected</small>}</strong><small>{problem ? 'Needs attention' : model.metadata?.stale ? 'Cached listing' : 'Listed'}</small></span><ChevronRight size={16} aria-hidden="true" /></button></article>)}</section>)}
        {!filtered.length && <div className="rc-empty" role="status"><p>{models.length ? 'No models match.' : 'No models listed yet. Connect a provider to discover models.'}</p>{(browse.query || browse.filter !== 'all') && <button type="button" className="rc-link" onClick={() => { setBrowse(s => ({ ...s, query: '', filter: 'all', page: 0 })); input.current?.focus(); }}>Reset model filters</button>}</div>}
        {!browse.query && browse.filter === 'all' && layouts.length > 0 && <section className="rm-provider-group" aria-label="Model layouts"><h3>Layouts</h3>{layouts.map(l => choiceRow(LAYOUT_PREFIX + l.id, l.name, `${l.models.length} models · ${l.mode === 'order' ? 'In saved order' : 'Match each request'}`))}</section>}
      </div>
      {pages > 1 && <nav className="rc-pages" aria-label="Model pages"><button type="button" disabled={!page} onClick={() => setBrowse(s => ({ ...s, page: page - 1 }))}>Previous</button><span role="status">{page * PAGE + 1}–{Math.min(filtered.length, (page + 1) * PAGE)} of {filtered.length}</span><button type="button" disabled={page + 1 === pages} onClick={() => setBrowse(s => ({ ...s, page: page + 1 }))}>Next</button></nav>}
    </section>
    <section className="rm-detail" aria-label="Model detail" ref={detail} tabIndex={-1}>
      {phone && browse.pushed && <button type="button" className="rm-back" onClick={() => screenBack(close)}><ChevronLeft size={18} aria-hidden="true" />Browse models</button>}
      {chosen ? <ModelDetail model={chosen.model} problem={chosen.problem} selected={current === focus} onChosen={() => setBrowse(s => ({ ...s, pushed: false }))} /> : focus === 'auto' || layout ? <>
        <header className="rm-detail-head"><p className="rc-label">{current === focus ? 'Selected for this chat' : layout ? 'Model layout' : 'Automatic selection'}</p><h2>{!layout && BrandMark && <BrandMark height={34} decorative />}{layout?.name || 'Auto'}</h2>{layout?.description && <p>{layout.description}</p>}</header>
        <div className="rm-detail-content"><p>{route.description}</p><div className="rm-preference"><small>Current preference</small><strong>{route.priority} · {route.fallback.title}</strong></div>{layout && <details><summary>Models and requirements</summary><ol>{layout.models.map(id => <li key={id}>{modelLabel(catalog, id)}</li>)}</ol><p>{layoutPreview(layout, settings).requirements}</p></details>}<div className="rm-detail-actions"><button type="button" className="rc-primary" disabled={!authed || !user || current === focus} aria-label={`Use ${layout?.name || 'Auto'}`} onClick={useChoice}>{current === focus ? 'In use for this chat' : 'Use in this chat'}</button></div><button type="button" className="rc-link" onClick={() => showRoutingSection(layout ? 'policies' : 'routing')}>{layout ? 'Manage layouts' : 'Routing settings'}<ChevronRight size={16} aria-hidden="true" /></button></div>
      </> : <div className="rm-detail-content"><h2>Choose a model to inspect</h2><p>The previous listing is no longer in this catalog.</p></div>}
    </section>
  </div>;
}

function ModelDetail({ model, problem, selected, onChosen }: { model: ModelInfo; problem: string | null; selected: boolean; onChosen: () => void }) {
  const settings = useStore(s => s.settings), usage = useStore(s => s.usage);
  const excluded = settings.autoExcluded?.includes(model.id), position = settings.enabledModels.indexOf(model.id);
  const capabilities = modelCapabilities(model), left = remaining(usage, model.id);
  const limited = (usage?.models[model.id]?.blockedUntil || 0) > Date.now();
  return <><header className="rm-detail-head"><p className="rc-label">{modelProviderLabel(model)}</p><h2>{model.label}{selected && <small className="rc-selected">Selected</small>}</h2><code>{model.id}</code></header><div className="rm-detail-content">
    <dl className="rm-facts"><div><dt>Selection</dt><dd>{problem || 'Available to choose'}</dd></div><div><dt>Listing</dt><dd>{model.metadata?.stale ? 'Cached listing' : model.metadata?.verification === 'unchecked' ? 'Declared, unchecked' : 'In provider catalog'}</dd><small>A listing is not a tested reply.</small></div><div><dt>In Auto</dt><dd>{excluded ? 'Excluded by you' : 'Subject to request eligibility'}</dd><button type="button" className="rc-link" onClick={() => showRoutingSection('routing')}>Manage routing</button></div><div><dt>Saved order</dt><dd>{position < 0 ? 'Not enabled' : `Position ${position + 1}`}</dd><small>Request requirements still apply.</small></div></dl>
    <div className="rm-preference"><small>Reported capabilities</small><strong>{model.context ? `${formatTokens(model.context)} context` : 'Context unknown'}</strong><p>{capabilities.length ? capabilities.join(' · ') : 'Capabilities not reported'}</p>{model.metadata?.verification === 'unchecked' && <p>Declared, unchecked</p>}{limited && <p>Temporarily limited</p>}<p>{left === null ? 'Allowance unknown' : `${left} requests left${model.id.startsWith('openrouter:') && model.id.endsWith(':free') ? ' · shared pool' : ''}`}</p></div>
    {problem && <p className="rm-problem" id={`rc-why-${model.id}`}>{problem}</p>}<div className="rm-detail-actions"><UseModel model={model} problem={problem} onChosen={onChosen} /></div>
  </div></>;
}
