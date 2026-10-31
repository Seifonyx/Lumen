// Canvas Tools workspace: one searchable list of what Lumen can do, filtered by area, with each tool's readiness
// and where it takes you stated up front. Launching, toggling and editing reuse ToolsPage's actions unchanged.
import { ArrowUpRight, ChevronRight, KeyRound, Pencil, Plus, Search, Sparkles, X } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import type { SavedAssistant } from '../types';
import './tools-workspace.css';

export type ToolArea = 'research' | 'create' | 'analyze' | 'learn' | 'assistants';
export interface WorkspaceTool {
  id: string; section: ToolArea; name: string; text: string; icon: ReactNode;
  /** The key a tool depends on, and whether it is saved. */
  needs?: string; ready?: boolean;
  /** Where the tool takes you, in a few words. */
  lands: string;
  /** A setting switched here rather than a tool that opens. */
  toggle?: { on: boolean };
  /** Used from somewhere else (e.g. selected reply text), so there is nothing to open here. Ready tools show no
   *  badge: only a missing key is called out, and the summary above says which tools each key powers. */
  contextual?: boolean;
  run?: () => void;
}
export interface ToolKey { name: string; ready: boolean; uses: string[]; /** Saved, but the provider refused it. */ rejected?: boolean }

export const AREAS: { id: ToolArea; label: string; blurb: string }[] = [
  { id: 'research', label: 'Research', blurb: 'Find things out on the web and in your history.' },
  { id: 'create', label: 'Create', blurb: 'Write, draw and edit.' },
  { id: 'analyze', label: 'Analyze', blurb: 'Numbers, data and second opinions.' },
  { id: 'learn', label: 'Learn', blurb: 'Make what you read stick.' },
  { id: 'assistants', label: 'Assistants', blurb: 'Helpers with their own instructions and model.' },
];

// Each row's accessible name is the tool's name alone; what it does, any missing key and where it lands are its
// description, so lists read briefly and exact-name lookups keep working.
function useRowIds() { const id = useId(); return { name: `${id}n`, desc: `${id}d`, meta: `${id}m`, described: `${id}d ${id}m` }; }

function RowCopy({ ids, name, text, meta }: { ids: ReturnType<typeof useRowIds>; name: string; text: string; meta?: ReactNode }) {
  return (
    <span className="tx-copy">
      <strong className="tx-name" id={ids.name}>{name}</strong>
      <span className="tx-text" id={ids.desc}>{text}</span>
      {meta && <span className="tx-meta" id={ids.meta}>{meta}</span>}
    </span>
  );
}

function ToolRow({ t }: { t: WorkspaceTool }) {
  const ids = useRowIds();
  const unavailable = Boolean(t.needs && !t.ready);
  const body = <>
    <span className="tx-icon" aria-hidden="true">{t.icon}</span>
    <RowCopy ids={ids} name={t.name} text={t.text} meta={<>
      {unavailable && <span className="tx-state setup"><KeyRound size={12} aria-hidden="true" />Needs {t.needs}</span>}
      {t.contextual ? <span className="tx-tag">In replies</span> : <span className="tx-lands">{t.lands}</span>}
    </>} />
  </>;
  if (t.contextual) return <li className="tx-row contextual"><div className="tx-hit">{body}</div></li>;
  if (t.toggle) return (
    <li className="tx-row">
      <button type="button" role="switch" aria-checked={t.toggle.on} aria-labelledby={ids.name} aria-describedby={ids.described} className="tx-hit" onClick={t.run}>
        {body}<span className={`tx-switch${t.toggle.on ? ' on' : ''}`} aria-hidden="true"><span /></span>
      </button>
    </li>
  );
  return (
    <li className={`tx-row${unavailable ? ' unavailable' : ''}`}>
      <button type="button" className="tx-hit" aria-labelledby={ids.name} aria-describedby={ids.described} onClick={t.run}>{body}<ChevronRight className="tx-go" size={17} aria-hidden="true" /></button>
    </li>
  );
}

function AssistantRow({ a, builtin, onStart, onEdit }: { a: SavedAssistant; builtin: boolean; onStart: () => void; onEdit: () => void }) {
  const ids = useRowIds();
  return (
    <li className="tx-row has-side">
      <button type="button" className="tx-hit" aria-labelledby={ids.name} aria-describedby={ids.described} onClick={onStart}>
        <span className="tx-icon" aria-hidden="true"><Sparkles size={18} /></span>
        <RowCopy ids={ids} name={a.name} text={a.description || 'Your custom assistant.'} meta={<span className="tx-lands">New chat</span>} />
      </button>
      <button type="button" className="tx-side" aria-label={builtin ? `Customize ${a.name}` : `Edit ${a.name}`} onClick={onEdit}><Pencil size={16} /></button>
    </li>
  );
}

function NewAssistantRow({ onClick }: { onClick: () => void }) {
  const ids = useRowIds();
  return (
    <li className="tx-row">
      <button type="button" className="tx-hit tx-new" aria-labelledby={ids.name} aria-describedby={ids.desc} onClick={onClick}>
        <span className="tx-icon" aria-hidden="true"><Plus size={18} /></span>
        <RowCopy ids={ids} name="New assistant" text="Your own instructions and model, ready in any chat." />
      </button>
    </li>
  );
}

export default function ToolsWorkspace({ tools, keys, mine, builtins, query, setQuery, area, setArea, onStartAssistant, onEditAssistant, onNewAssistant, onSetUpKeys }: {
  tools: WorkspaceTool[]; keys: ToolKey[]; mine: SavedAssistant[]; builtins: SavedAssistant[];
  query: string; setQuery: (q: string) => void; area: ToolArea | 'all'; setArea: (a: ToolArea | 'all') => void;
  onStartAssistant: (a: SavedAssistant) => void; onEditAssistant: (a: SavedAssistant, builtin: boolean) => void; onNewAssistant: () => void; onSetUpKeys: () => void;
}) {
  const q = query.trim().toLowerCase();
  const match = (name: string, text: string) => !q || `${name} ${text}`.toLowerCase().includes(q);
  const shownTools = tools.filter((t) => (area === 'all' || t.section === area) && match(t.name, t.text));
  const shownMine = area === 'all' || area === 'assistants' ? mine.filter((a) => match(a.name, a.description)) : [];
  const shownBuiltins = area === 'all' || area === 'assistants' ? builtins.filter((a) => match(a.name, a.description)) : [];
  const count = (id: ToolArea) => id === 'assistants' ? mine.length + builtins.length : tools.filter((t) => t.section === id).length;
  const total = tools.length + mine.length + builtins.length;
  const missing = keys.filter((k) => !k.ready || k.rejected);
  const nothing = !shownTools.length && !shownMine.length && !shownBuiltins.length;

  return (
    <div className="tx">
      <div className="tx-rail">
        <div className="tx-areas" role="group" aria-label="Tool areas">
          <button type="button" aria-pressed={area === 'all'} onClick={() => setArea('all')}>All<span className="tx-count">{total}</span></button>
          {AREAS.map((a) => <button key={a.id} type="button" aria-pressed={area === a.id} onClick={() => setArea(a.id)}>{a.label}<span className="tx-count">{count(a.id)}</span></button>)}
        </div>
        <section className={`tx-keys${area === 'all' && !q ? '' : ' filtered'}`} aria-label="Tool readiness">
          <ul>
            {keys.map((k) => (
              <li key={k.name}>
                <span className={`tx-dot${k.ready && !k.rejected ? ' on' : ''}`} aria-hidden="true" />
                <span className="tx-key-copy"><strong>{k.name} key</strong><span>{k.rejected ? 'Saved, but not accepted · check the key' : k.ready ? `Ready · powers ${k.uses.length} tools` : `Not set up · needed for ${k.uses.length > 2 ? `${k.uses.length} tools` : k.uses.join(' and ')}`}</span></span>
              </li>
            ))}
          </ul>
          {missing.length > 0 && <button type="button" className="tx-setup" onClick={onSetUpKeys}>Set up<ArrowUpRight size={14} aria-hidden="true" /></button>}
        </section>
      </div>
      <div className="tx-main">
      <label className="tx-search">
        <Search size={17} aria-hidden="true" />
        <input type="search" aria-label="Search tools" placeholder="Search tools" value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && <button type="button" aria-label="Clear tool search" onClick={(e) => { setQuery(''); e.currentTarget.parentElement?.querySelector('input')?.focus(); }}><X size={15} /></button>}
      </label>

      {AREAS.filter((a) => a.id !== 'assistants').map((a) => {
        const list = shownTools.filter((t) => t.section === a.id);
        if (!list.length) return null;
        return (
          <section key={a.id} className="tx-group" id={`tools-${a.id}`} aria-labelledby={`tx-h-${a.id}`}>
            <header><h2 id={`tx-h-${a.id}`} tabIndex={-1}>{a.label}</h2>{area !== 'all' && <p>{a.blurb}</p>}</header>
            <ul className="tx-list">{list.map((t) => <ToolRow key={t.id} t={t} />)}</ul>
          </section>
        );
      })}

      {(shownMine.length > 0 || shownBuiltins.length > 0 || (!q && (area === 'all' || area === 'assistants'))) && (
        <section className="tx-group" id="tools-assistants" aria-labelledby="tx-h-assistants">
          <header><h2 id="tx-h-assistants" tabIndex={-1}>Assistants</h2>{area !== 'all' && <p>{AREAS[4].blurb}</p>}</header>
          {(shownMine.length > 0 || !q) && <>
            <h3 className="tx-sub">Yours</h3>
            <ul className="tx-list">
              {shownMine.map((a) => <AssistantRow key={a.id} a={a} builtin={false} onStart={() => onStartAssistant(a)} onEdit={() => onEditAssistant(a, false)} />)}
              {!q && <NewAssistantRow onClick={onNewAssistant} />}
            </ul>
          </>}
          {shownBuiltins.length > 0 && <>
            <h3 className="tx-sub">From Lumen</h3>
            <ul className="tx-list">{shownBuiltins.map((a) => <AssistantRow key={a.id} a={a} builtin onStart={() => onStartAssistant(a)} onEdit={() => onEditAssistant(a, true)} />)}</ul>
          </>}
        </section>
      )}

      {nothing && (
        <div className="tx-empty" role="status">
          <strong>No tools match “{query}”{area !== 'all' ? ` in ${AREAS.find((a) => a.id === area)?.label}` : ''}</strong>
          <span>Try another word{area !== 'all' ? ' or search every area' : ''}.</span>
          <div>{area !== 'all' && <button type="button" onClick={() => setArea('all')}>Search all areas</button>}<button type="button" onClick={() => setQuery('')}>Clear search</button></div>
        </div>
      )}
      </div>
    </div>
  );
}
