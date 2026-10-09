import { Brain, Check, ChevronDown, Eye, Globe, SlidersHorizontal, Sparkles } from 'lucide-react';
import { AUTO } from '../lib/routing';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

interface Props {
  value: string;
  onChange: (id: string) => void;
  /** compact = used inside message actions ("Retry with…") */
  label?: string;
  compact?: boolean;
  align?: 'left' | 'right';
}

export default function ModelPicker({ value, onChange, label, compact, align = 'left' }: Props) {
  const catalog = useStore((s) => s.catalog);
  const enabled = useStore((s) => s.settings.enabledModels);
  const setUi = useStore((s) => s.setUi);
  const usage = useStore((s) => s.usage);
  const [open, setOpen] = useState(false);
  const statusOf = (id: string) => {
    const u = usage?.models[id];
    const freeOR = id.startsWith('openrouter:') && id.endsWith(':free');
    const until = u?.blockedUntil && u.blockedUntil > Date.now() ? u.blockedUntil : freeOR && usage?.openrouter.limit && usage.openrouter.used >= usage.openrouter.limit ? usage.openrouter.resetAt : null;
    if (until) return <span className="limit-tag blocked" title={`Available again ${formatUntil(until)}`}>Limit · {formatUntil(until).replace(/^(in|at) /, '')}</span>;
    const left = remaining(usage, id);
    if (left !== null && left <= 10) return <span className="limit-tag low">{left} left</span>;
    return null;
  };
  const ref = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  // Keep the menu on screen: on phones the button can sit far enough right for it to run off the edge.
  useLayoutEffect(() => {
    const el = pop.current;
    if (!open || !el) return;
    el.style.translate = '';
    const r = el.getBoundingClientRect();
    const W = document.documentElement.clientWidth;
    const shift = r.right > W - 8 ? W - 8 - r.right : r.left < 8 ? 8 - r.left : 0;
    if (shift) el.style.translate = `${shift}px 0`;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
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

  const models = enabled.map((id) => catalog?.models.find((m) => m.id === id) || ({ id, label: modelLabel(catalog, id), provider: providerOfId(id) } as ModelInfo));
  const customLayouts = useStore((s) => s.settings.layouts);
  const hiddenLayouts = useStore((s) => s.settings.hiddenLayouts);
  // Layouts with at least one model this account can use.
  const layouts = allLayouts(catalog?.models || [], customLayouts, hiddenLayouts).filter((l) => l.models.some((id) => catalog?.models.some((m) => m.id === id)));
  const current = isLayoutId(value) ? findLayout(value, catalog?.models || [], customLayouts, hiddenLayouts) : undefined;
  const groups = (Object.keys(PROVIDER_NAMES) as ProviderId[])
    .map((p) => [PROVIDER_NAMES[p], models.filter((m) => m.provider === p)] as [string, ModelInfo[]])
    .filter(([, list]) => list.length);

  return (
    <div className={`model-picker${compact ? ' compact' : ''}`} ref={ref}>
      <button className={compact ? 'msg-action' : 'model-button'} onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}>
        {label ?? (
          <span className="model-name">
            {value === AUTO && <Sparkles size={16} className="auto-icon" />}
            {current && <LayoutIcon icon={current.icon} size={16} className="auto-icon" />}
            {modelLabel(catalog, value) || 'Choose a model'}
          </span>
        )}
        {!compact && <ChevronDown size={16} />}
      </button>
      {open && (
        <div className={`popover models-pop ${align}`} role="listbox" ref={pop}>
          {!compact && groups.length > 0 && (
            <button
              role="option"
              aria-selected={value === AUTO}
              className={`pop-item auto-item${value === AUTO ? ' selected' : ''}`}
              onClick={() => {
                onChange(AUTO);
                setOpen(false);
              }}
            >
              <Sparkles size={18} className="auto-icon" />
              <span className="pop-main">
                <span className="pop-title">Auto</span>
                <span className="pop-sub">Picks the best model for each message</span>
              </span>
              {value === AUTO && <Check size={16} className="check" />}
            </button>
          )}
          {layouts.length > 0 && (
            <div className="layout-group">
              <div className="pop-label">Layouts</div>
              {layouts.map((l) => {
                const id = LAYOUT_PREFIX + l.id;
                return (
                  <button
                    key={id}
                    role="option"
                    aria-selected={id === value}
                    className={`pop-item${id === value ? ' selected' : ''}`}
                    onClick={() => {
                      onChange(id);
                      setOpen(false);
                    }}
                  >
                    <LayoutIcon icon={l.icon} size={17} className="auto-icon" />
                    <span className="pop-main">
                      <span className="pop-title">{l.name}</span>
                      <span className="pop-sub">
                        {l.mode === 'auto' ? 'Best of' : 'In order:'}{' '}
                        {l.models.filter((m) => catalog?.models.some((x) => x.id === m)).map((m) => modelLabel(catalog, m)).join(', ')}
                      </span>
                    </span>
                    {id === value && <Check size={16} className="check" />}
                  </button>
                );
              })}
            </div>
          )}
          {groups.length === 0 && <p className="muted small pad">No models enabled yet.</p>}
          {groups.map(([name, list]) => (
            <div key={name}>
              <div className="pop-label">{name}</div>
              {list.map((m) => (
                <button
                  key={m.id}
                  role="option"
                  aria-selected={m.id === value}
                  className={`pop-item${m.id === value ? ' selected' : ''}`}
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                >
                  <span className="pop-main">
                    <span className="pop-title">{m.label}</span>
                    <span className="pop-sub">{m.name}</span>
                  </span>
                  {statusOf(m.id)}
                  <Badges m={catalog?.models.find((x) => x.id === m.id)} />
                  {m.id === value && <Check size={16} className="check" />}
                </button>
              ))}
            </div>
          ))}
          <button
            className="pop-item manage"
            onClick={() => {
              setOpen(false);
              setUi({ settingsOpen: true, settingsTab: 'models' });
            }}
          >
            <SlidersHorizontal size={16} /> Manage models
          </button>
        </div>
      )}
    </div>
  );
}
