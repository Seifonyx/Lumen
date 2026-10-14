import { MoreHorizontal } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface MoreItem {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
}

/** "⋯" button with the less-used actions for a message, so the row under replies stays short. */
export default function MoreMenu({ items, label = 'More actions' }: { items: MoreItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const down = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); box.current?.querySelector<HTMLButtonElement>('.msg-action')?.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const list = [...(box.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') || [])];
        const i = list.indexOf(document.activeElement as HTMLButtonElement);
        e.preventDefault();
        list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
      }
    };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key, true); };
  }, [open]);
  if (!items.length) return null;
  return (
    <div className="more-menu" ref={box}>
      <button type="button" className="msg-action" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="menu more-menu-list" role="menu" aria-label={label}>
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" onClick={() => { setOpen(false); it.onSelect(); }}>
              {it.icon}<span>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
