import { useEffect, useLayoutEffect, useRef } from 'react';

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
  // Says which ends have more sections out of view (data-more="start end"), so the rail fades only there and a cut-off
  // label reads as "scroll for more" rather than as clipped text.
  useEffect(() => {
    const rail = root.current;
    if (!rail) return;
    const mark = () => {
      const rtl = getComputedStyle(rail).direction === 'rtl', left = Math.abs(rail.scrollLeft), room = rail.scrollWidth - rail.clientWidth;
      const more = [left > 2 && 'start', left < room - 2 && 'end'].filter(Boolean).join(' ');
      if (more) rail.dataset.more = more; else delete rail.dataset.more;
      rail.dataset.dir = rtl ? 'rtl' : 'ltr';
    };
    mark();
    rail.addEventListener('scroll', mark, { passive: true });
    const observer = new ResizeObserver(mark);
    observer.observe(rail);
    return () => { rail.removeEventListener('scroll', mark); observer.disconnect(); };
  }, []);
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
