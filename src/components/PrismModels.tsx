// Lazy Prism model ledger: canonical catalog/settings only. No independent selection or eligibility owner.
import { useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, Search, X } from 'lucide-react';
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
const PAGE = 24;

function UseModel({ model, problem }: { model: ModelInfo; problem: string | null }) {
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
      fresh.setChatModel(model.id);
      closeRoutingCenter();
      fresh.toast(`Now using ${model.label} in this chat`);
      // The real composer remained mounted. Focus without rewriting its draft, selection, undo or attachments.
      requestAnimationFrame(() => {
        const now = useStore.getState();
        if (now.user?.uid === owner && now.currentId === conversation && !now.settingsOpen && !now.page)
          document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus({ preventScroll: true });
      });
    }}>Use model <ArrowUpRight size={14} aria-hidden="true" /></button>
    {problem && <button type="button" className="rc-model-recover" onClick={recover}>{problem.includes('provider') || problem.includes('connection') ? 'Provider settings' : 'Manage model'}</button>}
  </div>;
}

function ModelRow({ model: m, problem, selected }: { model: ModelInfo; problem: string | null; selected: boolean }) {
  const usage = useStore(s => s.usage);
  const left = remaining(usage, m.id), seen = usage?.models[m.id];
  const flags = [m.metadata?.verification === 'unchecked' && 'Declared, unchecked', m.metadata?.stale && 'Cached metadata', seen?.blockedUntil && seen.blockedUntil > Date.now() && 'Temporarily limited'].filter(Boolean);
  const capabilities = modelCapabilities(m);
  return <article className="rc-model" data-model={m.id} aria-label={m.label} aria-current={selected ? 'true' : undefined}>
    <div><h4>{m.label}{selected && <small> · Selected</small>}</h4><small>{modelProviderLabel(m)}</small>{m.metadata?.verification === 'unchecked' && <small>Declared, unchecked</small>}{m.metadata?.stale && <small>Cached metadata</small>}</div>
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
  return <Inventory models={models} searchHost={searchHost} />;
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
    {!providerOnly && <div className="rc-model-toolbar"><h2>Models <small className="rc-muted">{filtered.length}</small></h2><FilterMenu label="Filter models" value={filter} options={options.map(o => ({...o,count:matches.filter(e=>accepts(e,o.value)).length}))} onChange={value=>{setFilter(value);setPage(0);}} /><button type="button" className="rc-add" aria-label="Manage models" onClick={()=>useStore.getState().setUi({settingsOpen:true,settingsTab:'models'})}><ArrowUpRight size={16} aria-hidden="true" /></button></div>}
    {(!providerOnly || models.length > PAGE || query) && (searchHost ? createPortal(search, searchHost) : search)}
    {filtered.length ? <div className="rc-group" role="group" aria-label="Model results" tabIndex={-1} ref={list}>{filtered.slice(index*PAGE,(index+1)*PAGE).map(e=><ModelRow key={e.model.id} {...e} selected={current===e.model.id} />)}</div> : <div className="rc-empty" role="status"><p>{models.length ? 'No models match.' : 'No models listed yet. Connect a provider to discover models.'}</p>{(query || filter!=='all') && <button type="button" className="rc-link" onClick={()=>{changeQuery('');setFilter('all');input.current?.focus();}}>Reset model filters</button>}</div>}
    {pages>1 && <nav className="rc-pages" aria-label="Model pages"><button type="button" disabled={!index} onClick={()=>changePage(index-1)}>Previous</button><span role="status">{index*PAGE+1}–{Math.min(filtered.length,(index+1)*PAGE)} of {filtered.length}</span><button type="button" disabled={index+1===pages} onClick={()=>changePage(index+1)}>Next</button></nav>}
  </>;
}
