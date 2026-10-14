import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ListFilter } from 'lucide-react';

export type FilterOption<T extends string> = { value: T; label: string; count?: number };

/** A compact "Show: All ▾" button that opens a short list of choices. Use it where a list needs one filter. */
export default function FilterMenu<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: FilterOption<T>[]; onChange: (value: T) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const close = () => { setOpen(false); root.current?.querySelector<HTMLButtonElement>('.filter-trigger')?.focus(); };

  return (
    <div className={`filter-menu${open ? ' open' : ''}`} ref={root}>
      <button type="button" className={`filter-trigger${value !== options[0].value ? ' filtered' : ''}`} aria-haspopup="menu" aria-expanded={open} aria-label={`${label}: ${current.label}`} onClick={() => setOpen(!open)}>
        <ListFilter size={15} aria-hidden="true" />
        <span className="filter-value">{current.label}</span>
        <ChevronDown size={14} aria-hidden="true" className="filter-chev" />
      </button>
      {open && (
        <div className="menu filter-pop" role="menu" aria-label={label} onKeyDown={(e) => {
          if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
          e.preventDefault();
          const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
          const i = items.indexOf(document.activeElement as HTMLButtonElement);
          const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
          items[next]?.focus();
        }}>
          <span className="filter-pop-label">{label}</span>
          {options.map((o) => (
            <button key={o.value} type="button" role="menuitemradio" aria-checked={o.value === value} onClick={() => { onChange(o.value); close(); }}>
              <span className="filter-check">{o.value === value && <Check size={14} />}</span>
              <span className="filter-option">{o.label}</span>
              {o.count !== undefined && <span className="filter-count">{o.count}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
