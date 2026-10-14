// Bottom sheets follow your finger: drag down to dismiss, let go early and they spring back.
// Starts from the grab bar or header at any time, or from the content when it's scrolled to the top.
import { useEffect, useRef, type RefObject } from 'react';

const CLOSE_DISTANCE = 0.25; // share of the sheet's height
const CLOSE_SPEED = 0.6; // px per ms, a quick flick

/** Is something between `el` and the sheet scrolled down (so a downward drag should scroll it instead)? */
function scrolledInside(el: Element | null, sheet: HTMLElement) {
  for (let n = el; n && n !== sheet.parentElement; n = n.parentElement) {
    if (n instanceof HTMLElement && n.scrollTop > 0 && n.scrollHeight > n.clientHeight) return true;
    if (n === sheet) break;
  }
  return false;
}

export function useSheetDrag(sheet: RefObject<HTMLElement | null>, onClose: () => void, enabled = true, scrim?: RefObject<HTMLElement | null>) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = sheet.current;
    if (!enabled || !el) return;
    let start: { y: number; x: number; t: number; id: number; handle: boolean } | null = null;
    let dy = 0, lastY = 0, lastT = 0, speed = 0, dragging = false;
    // Only a separate scrim fades (a backdrop that contains the sheet would fade the sheet too).
    const backdrop = () => (scrim?.current && !scrim.current.contains(el) ? scrim.current : null);
    const set = (y: number, animate: boolean) => {
      el.style.transition = animate ? 'transform .22s cubic-bezier(.2,.8,.2,1)' : 'none';
      el.style.transform = y ? `translateY(${y}px)` : '';
      const b = backdrop();
      if (b && b !== el) { b.style.transition = animate ? 'opacity .22s' : 'none'; b.style.opacity = y ? String(Math.max(0.2, 1 - y / el.offsetHeight)) : ''; }
    };
    const down = (x: number, y: number, id: number, target: EventTarget | null) => {
      const t = target as Element | null;
      const handle = Boolean(t?.closest('.sheet-grip, .sheet-grab, .modal-head, .um-head, .add-sheet-header'));
      if (!handle && (t?.closest('input, textarea, select, [contenteditable="true"]') || scrolledInside(t, el))) return;
      start = { x, y, t: performance.now(), id, handle };
      dy = 0; lastY = y; lastT = start.t; speed = 0; dragging = false;
    };
    const move = (x: number, y: number, e: Event) => {
      if (!start) return;
      const ddy = y - start.y;
      if (!dragging) {
        if (Math.abs(x - start.x) > Math.abs(ddy) || ddy < 6) { if (ddy < -6 || Math.abs(x - start.x) > 10) start = null; return; }
        dragging = true;
      }
      if (e.cancelable) e.preventDefault();
      const now = performance.now();
      speed = (y - lastY) / Math.max(1, now - lastT);
      lastY = y; lastT = now;
      dy = Math.max(0, ddy);
      set(dy, false);
    };
    const up = () => {
      if (!start) return;
      const wasDragging = dragging;
      start = null; dragging = false;
      if (!wasDragging) return;
      if (dy > el.offsetHeight * CLOSE_DISTANCE || speed > CLOSE_SPEED) {
        set(el.offsetHeight + 40, true);
        window.setTimeout(() => close.current(), 200);
      } else set(0, true);
    };
    const ts = (e: TouchEvent) => { const t = e.touches[0]; if (e.touches.length === 1) down(t.clientX, t.clientY, t.identifier, e.target); };
    const tm = (e: TouchEvent) => { const t = [...e.touches].find((x) => x.identifier === start?.id); if (t) move(t.clientX, t.clientY, e); };
    // Mouse: only from the grab bar or header (so text can still be selected).
    const pd = (e: PointerEvent) => { if (e.pointerType !== 'mouse' || e.button !== 0) return; down(e.clientX, e.clientY, -1, e.target); if (start && !start.handle) start = null; };
    const pm = (e: PointerEvent) => { if (e.pointerType === 'mouse') move(e.clientX, e.clientY, e); };
    const pu = (e: PointerEvent) => { if (e.pointerType === 'mouse') up(); };
    el.addEventListener('touchstart', ts, { passive: true });
    el.addEventListener('touchmove', tm, { passive: false });
    el.addEventListener('touchend', up);
    el.addEventListener('touchcancel', up);
    el.addEventListener('pointerdown', pd);
    window.addEventListener('pointermove', pm);
    window.addEventListener('pointerup', pu);
    return () => {
      el.removeEventListener('touchstart', ts);
      el.removeEventListener('touchmove', tm);
      el.removeEventListener('touchend', up);
      el.removeEventListener('touchcancel', up);
      el.removeEventListener('pointerdown', pd);
      window.removeEventListener('pointermove', pm);
      window.removeEventListener('pointerup', pu);
    };
  }, [sheet, enabled, scrim]);
}

/** True on phone-sized screens, where windows open as bottom sheets. */
export const isSheetScreen = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
