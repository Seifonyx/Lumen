import { Brain, Check, ChevronDown, Eye, Globe, SlidersHorizontal, Sparkles } from 'lucide-react';
import { AUTO } from '../lib/routing';
import { useEffect, useRef, useState } from 'react';
import { formatUntil, remaining } from '../lib/usage';
import { PROVIDER_NAMES, providerOfId, type ProviderId } from '../lib/util';
import { modelLabel, useStore } from '../store';
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
  const groups = (Object.keys(PROVIDER_NAMES) as ProviderId[])
    .map((p) => [PROVIDER_NAMES[p], models.filter((m) => m.provider === p)] as [string, ModelInfo[]])
    .filter(([, list]) => list.length);

  return (
    <div className={`model-picker${compact ? ' compact' : ''}`} ref={ref}>
      <button className={compact ? 'msg-action' : 'model-button'} onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}>
        {label ?? (
          <span className="model-name">
            {value === AUTO && <Sparkles size={16} className="auto-icon" />}
            {modelLabel(catalog, value) || 'Choose a model'}
          </span>
        )}
        {!compact && <ChevronDown size={16} />}
      </button>
      {open && (
        <div className={`popover models-pop ${align}`} role="listbox">
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
