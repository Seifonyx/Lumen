// Canvas tool picker (Browse all tools): one searchable list of what Lumen can do, filtered by area, with a missing
// key and where each tool takes you stated up front. Launching, toggling and editing reuse ToolsPage's actions unchanged.
import { ChevronRight, KeyRound, Pencil, Plus, Search, Sparkles, X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useFocusScope } from '../lib/focus-scope';
import { useSheetDrag } from '../lib/sheet-drag';
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

export const AREAS: { id: ToolArea; label: string }[] = [
  { id: 'research', label: 'Research' },
  { id: 'create', label: 'Create' },
  { id: 'analyze', label: 'Analyze' },
  { id: 'learn', label: 'Learn' },
  { id: 'assistants', label: 'Assistants' },
];

// Each row's accessible name is the tool's name alone; what it does, any missing key and where it lands are its
// description, so lists read briefly and exact-name lookups keep working.
function useRowIds() { const id = useId(); return { name: `${id}n`, desc: `${id}d`, meta: `${id}m` }; }

function RowCopy({ ids, name, text, meta }: { ids: ReturnType<typeof useRowIds>; name: string; text?: string; meta?: ReactNode }) {
  return (
    <span className="tx-copy">
      <strong className="tx-name" id={ids.name}>{name}</strong>
      {text && <span className="tx-text" id={ids.desc}>{text}</span>}
      {meta && <span className="tx-meta" id={ids.meta}>{meta}</span>}
    </span>
  );
}

function ToolRow({ t }: { t: WorkspaceTool }) {
  const ids = useRowIds();
  const unavailable = Boolean(t.needs && !t.ready);
  const text = t.id === 'image' ? undefined : t.text;
  const describedBy = [text && ids.desc, (unavailable || t.contextual) && ids.meta].filter(Boolean).join(' ');
  const body = <>
    <span className="tx-icon" aria-hidden="true">{t.icon}</span>
    <RowCopy ids={ids} name={t.name} text={text} meta={(unavailable || t.contextual) && <>
      {unavailable ? <span className="tx-state setup"><KeyRound size={12} aria-hidden="true" />Needs {t.needs}</span>
        : t.contextual ? <span className="tx-tag">In replies</span> : null}
    </>} />
  </>;
  if (t.contextual) return <li className="tx-row contextual"><div className="tx-hit">{body}</div></li>;
  if (t.toggle) return (
    <li className="tx-row">
      <button type="button" role="switch" aria-checked={t.toggle.on} aria-labelledby={ids.name} aria-describedby={describedBy || undefined} className="tx-hit" onClick={t.run}>
        {body}<span className={`tx-switch${t.toggle.on ? ' on' : ''}`} aria-hidden="true"><span /></span>
      </button>
    </li>
  );
  return (
    <li className={`tx-row${unavailable ? ' unavailable' : ''}`}>
      <button type="button" className="tx-hit" aria-labelledby={ids.name} aria-describedby={describedBy || undefined} onClick={t.run}>{body}<ChevronRight className="tx-go" size={17} aria-hidden="true" /></button>
    </li>
  );
}

function AssistantRow({ a, builtin, onStart, onEdit }: { a: SavedAssistant; builtin: boolean; onStart: () => void; onEdit: () => void }) {
  const ids = useRowIds();
  const describedBy = a.description ? ids.desc : undefined;
  return (
    <li className="tx-row has-side">
      <button type="button" className="tx-hit" aria-labelledby={ids.name} aria-describedby={describedBy || undefined} onClick={onStart}>
        <span className="tx-icon" aria-hidden="true"><Sparkles size={18} /></span>
        <RowCopy ids={ids} name={a.name} text={a.description} />
      </button>
      <button type="button" className="tx-side" aria-label={builtin ? `Customize ${a.name}` : `Edit ${a.name}`} onClick={onEdit}><Pencil size={16} /></button>
    </li>
  );
}

function NewAssistantRow({ onClick }: { onClick: () => void }) {
  const ids = useRowIds();
  return (
    <li className="tx-row">
      <button type="button" className="tx-hit tx-new" aria-labelledby={ids.name} onClick={onClick}>
        <span className="tx-icon" aria-hidden="true"><Plus size={18} /></span>
        <RowCopy ids={ids} name="New assistant" />
      </button>
    </li>
  );
}

export interface ToolPickerProps {
  tools: WorkspaceTool[]; keys: ToolKey[]; mine: SavedAssistant[]; builtins: SavedAssistant[];
  query: string; setQuery: (q: string) => void; area: ToolArea | 'all'; setArea: (a: ToolArea | 'all') => void;
  onStartAssistant: (a: SavedAssistant) => void; onEditAssistant: (a: SavedAssistant, builtin: boolean) => void; onNewAssistant: () => void; onSetUpKeys: () => void;
  /** Closes the picker (Back, Escape, the close button, a tap outside, or a swipe down on phones). */
  onClose: () => void;
}

/** Browse all tools: the whole catalogue in one searchable picker over the chat, reached from the message box's +
 * (and every older route to Tools). A large sheet on phones, a centred panel on computers. Launching, toggling and
 * editing reuse ToolsPage's actions unchanged; nothing runs until a row is chosen. */
export default function ToolPicker(props: ToolPickerProps) {
  const { tools, keys, mine, builtins, query, setQuery, area, setArea, onStartAssistant, onEditAssistant, onNewAssistant, onSetUpKeys, onClose } = props;
  const dialog = useRef<HTMLDivElement>(null), layer = useRef<HTMLDivElement>(null), search = useRef<HTMLInputElement>(null);
  const [phone] = useState(() => window.matchMedia('(max-width: 899px)').matches);
  useFocusScope(dialog, true, onClose);
  useSheetDrag(dialog, onClose, phone, undefined, true);
  // Computers: straight into the search. Phones: no keyboard until the field is tapped, so the list stays in view.
  useLayoutEffect(() => { if (!phone && !window.matchMedia('(pointer: coarse)').matches) search.current?.focus({ preventScroll: true }); }, [phone]);
  // Opened from the + menu, whose row is gone by now: focus goes back to + when the picker closes.
  useEffect(() => () => { setTimeout(() => { const a = document.activeElement; if (!a || a === document.body) document.querySelector<HTMLElement>('.composer .add-tool, .composer .tool-btn')?.focus({ preventScroll: true }); }, 0); }, []);
  const q = query.trim().toLowerCase();
  const match = (name: string, text: string) => !q || `${name} ${text}`.toLowerCase().includes(q);
  const shownTools = tools.filter((t) => (area === 'all' || t.section === area) && match(t.name, t.text));
  const shownMine = area === 'all' || area === 'assistants' ? mine.filter((a) => match(a.name, a.description)) : [];
  const shownBuiltins = area === 'all' || area === 'assistants' ? builtins.filter((a) => match(a.name, a.description)) : [];
  const missing = keys.filter((k) => !k.ready || k.rejected);
  const nothing = !shownTools.length && !shownMine.length && !shownBuiltins.length;
  const pickArea = (next: ToolArea | 'all') => { setArea(next); dialog.current?.querySelector('.tp-scroll')?.scrollTo({ top: 0 }); };
  // Phones: the areas are one scrolling row; it fades only at an end with more, and the chosen area is kept in view.
  const areas = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const row = areas.current;
    if (!row) return;
    const mark = () => { const more = [row.scrollLeft > 2 && 'start', row.scrollLeft < row.scrollWidth - row.clientWidth - 2 && 'end'].filter(Boolean).join(' '); if (more) row.dataset.more = more; else delete row.dataset.more; };
    row.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    mark(); row.addEventListener('scroll', mark, { passive: true });
    return () => row.removeEventListener('scroll', mark);
  }, [area]);

  return (
    <div ref={layer} className={`tool-picker-layer${phone ? ' is-sheet' : ''}`} onPointerDown={(e) => { if (e.target === layer.current) onClose(); }}>
      <div ref={dialog} className="tool-picker" role="dialog" aria-modal="true" aria-labelledby="tp-title" tabIndex={-1}>
        {phone && <div className="sheet-grab" aria-hidden="true" />}
        <header className="tp-head">
          <h2 id="tp-title">Tools</h2>
          <button type="button" className="tp-close" aria-label="Close tools" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </header>
        <div className="tp-top">
          <label className="tx-search" data-local-escape={query ? '' : undefined} onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.preventDefault(); setQuery(''); } }}>
            <Search size={17} aria-hidden="true" />
            <input ref={search} type="search" aria-label="Search tools" placeholder="Search tools and assistants" value={query} onChange={(e) => setQuery(e.target.value)} enterKeyHint="search"
              onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); dialog.current?.querySelector<HTMLElement>('.tp-scroll button')?.focus(); } }} />
            {query && <button type="button" aria-label="Clear tool search" onClick={() => { setQuery(''); search.current?.focus(); }}><X size={15} /></button>}
          </label>
          <div className="tx-areas" role="group" aria-label="Tool areas" ref={areas}>
            <button type="button" aria-pressed={area === 'all'} onClick={() => pickArea('all')}>All</button>
            {AREAS.map((a) => <button key={a.id} type="button" aria-pressed={area === a.id} onClick={() => pickArea(a.id)}>{a.label}</button>)}
          </div>
        </div>
        <div className="tp-scroll" onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
          const rows = [...e.currentTarget.querySelectorAll<HTMLElement>('button')].filter((b) => b.getClientRects().length > 0);
          const i = rows.indexOf(document.activeElement as HTMLElement);
          if (i < 0) return;
          e.preventDefault();
          if (e.key === 'ArrowUp' && i === 0) search.current?.focus(); else rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
        }}>
          {missing.length > 0 && !q && (area === 'all' || shownTools.some((t) => t.needs && !t.ready)) && (
            <section className="tp-keys" aria-label="Tool readiness">
              <p>{missing.map((k) => <span key={k.name}><KeyRound size={13} aria-hidden="true" />{k.rejected ? `${k.name} key saved but not accepted` : `No ${k.name} key`}<span className="tp-keys-uses"> · {k.rejected ? 'check it' : `needed for ${k.uses.length > 2 ? `${k.uses.length} tools` : k.uses.join(' and ')}`}</span></span>)}</p>
              <button type="button" className="tx-setup" onClick={onSetUpKeys}>{missing.some((k) => k.rejected) ? 'Check keys' : 'Set up keys'}<ChevronRight size={15} aria-hidden="true" /></button>
            </section>
          )}
          {AREAS.filter((a) => a.id !== 'assistants').map((a) => {
            const list = shownTools.filter((t) => t.section === a.id);
            if (!list.length) return null;
            return (
              <section key={a.id} className="tx-group" id={`tools-${a.id}`} aria-labelledby={`tx-h-${a.id}`}>
                <header><h3 id={`tx-h-${a.id}`}>{a.label}</h3></header>
                <ul className="tx-list">{list.map((t) => <ToolRow key={t.id} t={t} />)}</ul>
              </section>
            );
          })}
          {(shownMine.length > 0 || shownBuiltins.length > 0 || (!q && (area === 'all' || area === 'assistants'))) && (
            <section className="tx-group" id="tools-assistants" aria-labelledby="tx-h-assistants">
              <header><h3 id="tx-h-assistants">Assistants</h3></header>
              {(shownMine.length > 0 || !q) && <>
                <h4 className="tx-sub">Yours</h4>
                <ul className="tx-list">
                  {shownMine.map((a) => <AssistantRow key={a.id} a={a} builtin={false} onStart={() => onStartAssistant(a)} onEdit={() => onEditAssistant(a, false)} />)}
                  {!q && <NewAssistantRow onClick={onNewAssistant} />}
                </ul>
              </>}
              {shownBuiltins.length > 0 && <>
                <h4 className="tx-sub">From Lumen</h4>
                <ul className="tx-list">{shownBuiltins.map((a) => <AssistantRow key={a.id} a={a} builtin onStart={() => onStartAssistant(a)} onEdit={() => onEditAssistant(a, true)} />)}</ul>
              </>}
            </section>
          )}
          {nothing && (
            <div className="tx-empty" role="status">
              <strong>No tools match “{query}”{area !== 'all' ? ` in ${AREAS.find((a) => a.id === area)?.label}` : ''}</strong>
              <span>Try another word{area !== 'all' ? ' or search every area' : ''}.</span>
              <div>{area !== 'all' && <button type="button" onClick={() => setArea('all')}>Search all areas</button>}<button type="button" onClick={() => { setQuery(''); search.current?.focus(); }}>Clear search</button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
