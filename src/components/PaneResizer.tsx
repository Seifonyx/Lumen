// The divider between the chat and a panel beside it (side by side, documents): drag it to share the space
// differently, or use the arrow keys. Double-click puts it back. The width is remembered on this device.
import { useEffect, useRef } from 'react';

const MIN = 320;

export function savedWidth(key: string) {
  try { const v = Number(localStorage.getItem(key)); return v > 0 ? v : null; } catch { return null; }
}

export default function PaneResizer({ pane, storageKey, label }: { pane: React.RefObject<HTMLElement | null>; storageKey: string; label: string }) {
  const handle = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = pane.current, w = savedWidth(storageKey);
    if (el && w) el.style.setProperty('--pane-w', `${w}px`);
    if (el) handle.current?.setAttribute('aria-valuenow', String(Math.round(el.getBoundingClientRect().width)));
  }, [pane, storageKey]);
  const limit = (w: number) => Math.round(Math.max(MIN, Math.min(w, window.innerWidth - MIN - (document.querySelector('.sidebar')?.getBoundingClientRect().width || 0))));
  const apply = (w: number, save = true) => {
    const el = pane.current;
    if (!el) return;
    const width = limit(w);
    el.style.setProperty('--pane-w', `${width}px`);
    handle.current?.setAttribute('aria-valuenow', String(width));
    if (save) try { localStorage.setItem(storageKey, String(width)); } catch { /* private mode */ }
  };
  const rtl = () => document.documentElement.dir === 'rtl';
  return (
    <div
      ref={handle}
      className="pane-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={MIN}
      aria-valuemax={typeof window !== 'undefined' ? window.innerWidth : 2000}
      aria-valuenow={savedWidth(storageKey) || 560}
      tabIndex={0}
      onPointerDown={(e) => {
        const el = pane.current;
        if (!el || e.button !== 0) return;
        e.preventDefault();
        const startX = e.clientX, startW = el.getBoundingClientRect().width;
        const target = e.currentTarget;
        target.setPointerCapture(e.pointerId);
        document.documentElement.classList.add('pane-resizing');
        const move = (ev: PointerEvent) => apply(startW + (rtl() ? ev.clientX - startX : startX - ev.clientX), false);
        const up = (ev: PointerEvent) => {
          apply(startW + (rtl() ? ev.clientX - startX : startX - ev.clientX));
          document.documentElement.classList.remove('pane-resizing');
          target.removeEventListener('pointermove', move);
          target.removeEventListener('pointerup', up);
          target.removeEventListener('pointercancel', up);
        };
        target.addEventListener('pointermove', move);
        target.addEventListener('pointerup', up);
        target.addEventListener('pointercancel', up);
      }}
      onDoubleClick={() => { pane.current?.style.removeProperty('--pane-w'); try { localStorage.removeItem(storageKey); } catch { /* private mode */ } }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const w = pane.current?.getBoundingClientRect().width || 0;
        const grow = (e.key === 'ArrowLeft') !== rtl();
        apply(w + (grow ? 40 : -40));
      }}
    />
  );
}
