import { useLayoutEffect, useRef } from 'react';

export interface PhoneSectionsProps {
  label: string;
  items: { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
  /** Filtering tabs share one content panel; screen navigation retains ordinary button semantics. */
  panelId?: string;
}

/** Browser-owned horizontal scrolling; never captures a pointer or impersonates a bottom app dock. */
export default function PhoneSections({ label, items, active, onSelect, panelId }: PhoneSectionsProps) {
  const root = useRef<HTMLElement>(null);
  const pointerFocus = useRef(false);
  const reveal = (button: HTMLElement | null) => {
    const rail = root.current;
    if (!rail || !button) return;
    const r = rail.getBoundingClientRect(), b = button.getBoundingClientRect();
    if (b.left < r.left + 12) rail.scrollBy({ left: b.left - r.left - 12 });
    else if (b.right > r.right - 12) rail.scrollBy({ left: b.right - r.right + 12 });
  };
  useLayoutEffect(() => { reveal(root.current?.querySelector<HTMLElement>('[aria-selected="true"],[aria-current="page"]') || null); }, [active]);
  const Tag = panelId ? 'div' : 'nav';
  return <Tag ref={root as React.Ref<HTMLDivElement>} className="phone-sections" role={panelId ? 'tablist' : undefined} aria-label={label}
    onPointerDownCapture={() => { pointerFocus.current = true; }}
    onPointerUpCapture={() => { pointerFocus.current = false; }} onPointerCancel={() => { pointerFocus.current = false; }}
    onFocusCapture={e => { if (!pointerFocus.current) reveal((e.target as HTMLElement).closest('button')); }}
    onKeyDown={e => {
      pointerFocus.current = false;
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
      const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')], index = buttons.indexOf(e.target as HTMLButtonElement);
      if (index < 0) return;
      e.preventDefault();
      const direction = getComputedStyle(e.currentTarget).direction === 'rtl' ? -1 : 1;
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (index + (e.key === 'ArrowRight' ? direction : -direction) + buttons.length) % buttons.length;
      buttons[next]?.focus({ preventScroll: true });
    }}>
    {items.map(item => <button type="button" key={item.id} id={panelId ? `${panelId}-${item.id}` : undefined}
      role={panelId ? 'tab' : undefined} aria-controls={panelId} aria-selected={panelId ? item.id === active : undefined}
      aria-current={!panelId && item.id === active ? 'page' : undefined} tabIndex={panelId && item.id !== active ? -1 : 0}
      onClick={() => onSelect(item.id)}>{item.label}</button>)}
  </Tag>;
}
