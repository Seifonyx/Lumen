import { Exit } from '../lib/motion';
import { useSheetDrag } from '../lib/sheet-drag';
import { Brain, Check, ChevronDown, Cpu, Eye, Globe, Search, SlidersHorizontal, Sparkles, Waypoints, Zap } from 'lucide-react';
import { AUTO } from '../lib/routing';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useFocusScope } from '../lib/focus-scope';
import { formatUntil, remaining } from '../lib/usage';
import { PROVIDER_NAMES, providerOfId, type ProviderId } from '../lib/util';
import { modelLabel, useStore } from '../store';
import { allLayouts, findLayout, isLayoutId, LAYOUT_PREFIX } from '../lib/layouts';
import LayoutIcon from './LayoutIcon';
import type { ModelInfo } from '../types';

export function Badges({ m }: { m?: ModelInfo }) {
  if (!m) return null;
  return (
    <span className="badges">
      {m.vision && <Eye size={13} aria-label="Reads images" />}
      {m.search && <Globe size={13} aria-label="Web search" />}
      {m.thinking && <Brain size={13} aria-label="Thinks before answering" />}
    </span>
  );
}

/** Gemini's four-pointed star. */
function GeminiMark({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 2c.4 5.3 4.7 9.6 10 10-5.3.4-9.6 4.7-10 10-.4-5.3-4.7-9.6-10-10 5.3-.4 9.6-4.7 10-10Z" />
    </svg>
  );
}

/** A small tile that tells providers apart at a glance. */
export function ProviderMark({ provider, size = 28 }: { provider: ProviderId; size?: number }) {
  const icon = size < 24 ? 12 : 15;
  return (
    <span className={`pmark pmark-${provider}`} style={{ width: size, height: size }} aria-hidden="true">
      {provider === 'google' ? <GeminiMark size={icon} /> : provider === 'groq' ? <Zap size={icon} /> : provider === 'cerebras' ? <Cpu size={icon} /> : <Waypoints size={icon} />}
    </span>
  );
}

const ctx = (n?: number | null) => (n ? (n >= 1_000_000 ? `${Math.round(n / 1_000_000)}M` : `${Math.round(n / 1000)}K`) : '');

interface Props {
  value: string;
  onChange: (id: string) => void;
  /** compact = used inside message actions ("Retry with…") */
  label?: string;
  compact?: boolean;
  align?: 'left' | 'right';
  opensUp?: boolean;
}

export default function ModelPicker({ value, onChange, label, compact, align = 'left', opensUp = false }: Props) {
  const catalog = useStore((s) => s.catalog);
  const enabled = useStore((s) => s.settings.enabledModels);
  const customLayouts = useStore((s) => s.settings.layouts);
  const hiddenLayouts = useStore((s) => s.settings.hiddenLayouts);
  const setUi = useStore((s) => s.setUi);
  const usage = useStore((s) => s.usage);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Phones get a sheet from the bottom of the screen instead of a dropdown.
  const [sheet, setSheet] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  useFocusScope(pop,open,()=>setOpen(false));
  const scrim = useRef<HTMLDivElement>(null);
  useSheetDrag(pop, () => setOpen(false), open && sheet, scrim);

  const statusOf = (id: string) => {
    const u = usage?.models[id];
    const freeOR = id.startsWith('openrouter:') && id.endsWith(':free');
    const until = u?.blockedUntil && u.blockedUntil > Date.now() ? u.blockedUntil : freeOR && usage?.openrouter.limit && usage.openrouter.used >= usage.openrouter.limit ? usage.openrouter.resetAt : null;
    if (until) return <span className="limit-tag blocked" title={`Available again ${formatUntil(until)}`}>Limit · {formatUntil(until).replace(/^(in|at) /, '')}</span>;
    const left = remaining(usage, id);
    if (left !== null && left <= 10) return <span className="limit-tag low">{left} left</span>;
    return null;
  };

  const toggle = () => {
    if (!open) {
      setSheet(window.matchMedia('(max-width: 720px), (pointer: coarse)').matches);
      setQuery('');
    }
    setOpen(!open);
  };
  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  // Keep the dropdown on screen: the button can sit far enough right for it to run off the edge.
  useLayoutEffect(() => {
    const el = pop.current;
    if (!open || !el || sheet) return;
    el.style.translate = '';
    if (opensUp && ref.current) el.style.maxHeight = `${Math.max(80, Math.min(560, ref.current.getBoundingClientRect().top - (window.visualViewport?.offsetTop||0) - 16))}px`;
    const r = el.getBoundingClientRect();
    const W = document.documentElement.clientWidth;
    const shift = r.right > W - 8 ? W - 8 - r.right : r.left < 8 ? 8 - r.left : 0;
    if (shift) el.style.translate = `${shift}px 0`;
  }, [open, sheet, opensUp]);

  useEffect(() => {
    if (!open) return;
    // Search is ready to type into on computers (on phones it would pop the keyboard up).
    if (window.matchMedia('(pointer: fine)').matches) search.current?.focus();
    pop.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    const close = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !pop.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const models = enabled.map((id) => catalog?.models.find((m) => m.id === id) || ({ id, label: modelLabel(catalog, id), name: id.split(':').slice(1).join(':'), provider: providerOfId(id) } as ModelInfo));
  const layouts = useMemo(
    () => allLayouts(catalog?.models || [], customLayouts, hiddenLayouts).filter((l) => l.models.some((id) => catalog?.models.some((m) => m.id === id))),
    [catalog, customLayouts, hiddenLayouts],
  );
  const current = isLayoutId(value) ? findLayout(value, catalog?.models || [], customLayouts, hiddenLayouts) : undefined;
  const shownLayouts = layouts.filter((l) => !q || `${l.name} ${l.description}`.toLowerCase().includes(q));
  const groups = (Object.keys(PROVIDER_NAMES) as ProviderId[])
    .map((p) => [p, models.filter((m) => m.provider === p && (!q || `${m.label} ${m.name} ${PROVIDER_NAMES[p]}`.toLowerCase().includes(q)))] as [ProviderId, ModelInfo[]])
    .filter(([, list]) => list.length);
  const showAuto = !compact && models.length > 0 && (!q || 'auto best automatic'.includes(q));
  const searchable = models.length + layouts.length > 5;
  const nothing = !showAuto && !shownLayouts.length && !groups.length;

  // Arrow keys move between options; Enter picks (buttons do that themselves).
  const onKeys = (e: ReactKeyboardEvent) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      e.preventDefault();
      pop.current?.querySelector<HTMLButtonElement>('[role="option"]')?.click();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const options = [...(pop.current?.querySelectorAll<HTMLElement>('[role="option"]') || [])];
    if (!options.length) return;
    e.preventDefault();
    const at = options.indexOf(document.activeElement as HTMLElement);
    const next = at < 0 ? (e.key === 'ArrowDown' ? 0 : options.length - 1) : (at + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    options[next].focus();
    options[next].scrollIntoView({ block: 'nearest' });
  };
  const onSearchKeys = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const first = pop.current?.querySelector<HTMLElement>('[role="option"]');
    if (first) {
      e.preventDefault();
      first.click();
    }
  };

  const menu = (
    <div className={`popover models-pop ${align}${sheet ? ' sheet' : ''}`} role="dialog" aria-modal="true" aria-label="Choose a model" tabIndex={-1} ref={pop} onKeyDown={onKeys}>
      {sheet && <div className="sheet-grip" aria-hidden="true" />}
      {searchable && (
        <div className="mp-search">
          <Search size={15} />
          <input ref={search} type="search" placeholder="Search models and layouts" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onSearchKeys} aria-label="Search models" />
        </div>
      )}
      <div className="mp-body" role="listbox" aria-label="Models and layouts">
        {showAuto && (
          <button type="button" role="option" aria-selected={value === AUTO} className={`mp-item mp-auto${value === AUTO ? ' selected' : ''}`} onClick={() => pick(AUTO)}>
            <span className="mp-tile auto"><Sparkles size={15} /></span>
            <span className="mp-text">
              <span className="mp-title">Auto <span className="mp-pill">Recommended</span></span>
              <span className="mp-sub">Picks the best model for each message</span>
            </span>
            {value === AUTO && <Check size={16} className="mp-check" />}
          </button>
        )}

        {shownLayouts.length > 0 && (
          <section className="mp-section">
            <div className="mp-label">Layouts</div>
            <div className="mp-layouts">
              {shownLayouts.map((l) => {
                const id = LAYOUT_PREFIX + l.id;
                const usable = l.models.filter((m) => catalog?.models.some((x) => x.id === m));
                return (
                  <button type="button"
                    key={id}
                    role="option"
                    aria-selected={id === value}
                    className={`mp-layout${id === value ? ' selected' : ''}`}
                    onClick={() => pick(id)}
                    title={`${l.mode === 'auto' ? 'Best of' : 'In order:'} ${usable.map((m) => modelLabel(catalog, m)).join(', ')}`}
                  >
                    <span className="mp-tile"><LayoutIcon icon={l.icon} size={15} /></span>
                    <span className="mp-text">
                      <span className="mp-title">{l.name}</span>
                      <span className="mp-sub">{usable.length} model{usable.length === 1 ? '' : 's'}</span>
                    </span>
                    {id === value && <Check size={14} className="mp-check" />}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {groups.map(([p, list]) => (
          <section key={p} className="mp-section">
            <div className="mp-label">{PROVIDER_NAMES[p]}</div>
            {list.map((m) => {
              const info = catalog?.models.find((x) => x.id === m.id);
              const sub = [info?.context ? `${ctx(info.context)} context` : '', info?.preview ? 'preview' : '', !info ? 'Not available right now' : ''].filter(Boolean).join(' · ') || m.name;
              return (
                <button type="button" key={m.id} role="option" aria-selected={m.id === value} className={`mp-item${m.id === value ? ' selected' : ''}${info ? '' : ' unavailable'}`} onClick={() => pick(m.id)}>
                  <ProviderMark provider={p} />
                  <span className="mp-text">
                    <span className="mp-title">{m.label}</span>
                    <span className="mp-sub">{sub}</span>
                  </span>
                  {statusOf(m.id)}
                  <Badges m={info} />
                  {m.id === value && <Check size={16} className="mp-check" />}
                </button>
              );
            })}
          </section>
        ))}

        {models.length === 0 && <p className="mp-empty">No models enabled yet.</p>}
        {models.length > 0 && nothing && <p className="mp-empty">Nothing matches “{query}”.</p>}
      </div>
      <div className="mp-foot">
        <button type="button"
          className="mp-manage"
          onClick={() => {
            setOpen(false);
            setUi({ settingsOpen: true, settingsTab: 'models' });
          }}
        >
          <SlidersHorizontal size={14} /> Manage models &amp; layouts
        </button>
        <span className="mp-keys" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> move <kbd>↵</kbd> pick</span>
      </div>
    </div>
  );

  return (
    <div className={`model-picker${compact ? ' compact' : ''}${opensUp ? ' opens-up' : ''}`} ref={ref}>
      <button type="button" className={compact ? 'msg-action' : 'model-button'} onClick={toggle} aria-haspopup="dialog" aria-expanded={open}>
        {label ?? (
          <span className="model-name">
            {value === AUTO && <Sparkles size={16} className="auto-icon" />}
            {current && <LayoutIcon icon={current.icon} size={16} className="auto-icon" />}
            {!current && value !== AUTO && value && <ProviderMark provider={providerOfId(value)} size={20} />}
            <span className="model-name-text">{modelLabel(catalog, value) || 'Choose a model'}</span>
          </span>
        )}
        {!compact && <ChevronDown size={16} />}
      </button>
      {open &&
        (sheet
          ? createPortal(
              <>
                <Exit kind="fade"><div ref={scrim} className="mp-scrim" onClick={() => setOpen(false)} aria-hidden="true" /></Exit>
                <Exit kind="sheet">{menu}</Exit>
              </>,
              document.body,
            )
          : <Exit kind="drop">{menu}</Exit>)}
    </div>
  );
}
