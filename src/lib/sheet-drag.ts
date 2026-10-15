// Bottom sheets under your finger: drag down to dismiss. Letting go keeps the finger's speed (a quick flick
// closes even a short drag; a slow, short one springs back), a moving sheet can be caught again mid-flight,
// and pulling up past the top resists like a rubber band.
// Starts from the grab bar or header at any time, or from the content when it's scrolled to the top.
import { useEffect, useRef, type RefObject } from 'react';
import { rubberBand, spring, Velocity, type Spring } from './spring';
import { haptic } from './haptics';

const PROJECT_MS = 180; // where the sheet would be this long after release, at release speed
const FLICK = 0.5; // px per ms

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
    let start: { y: number; x: number; id: number; handle: boolean; base: number } | null = null;
    let y = 0, dragging = false, anim: Spring | null = null, closing = false;
    const speed = new Velocity();
    // Only a separate scrim fades (a backdrop that contains the sheet would fade the sheet too).
    const backdrop = () => (scrim?.current && !scrim.current.contains(el) ? scrim.current : null);
    const set = (v: number) => {
      y = v;
      el.style.transition = 'none';
      el.style.transform = Math.abs(v) > 0.01 ? `translateY(${v}px)` : '';
      const b = backdrop();
      if (b) { b.style.transition = 'none'; b.style.opacity = v > 0 ? String(Math.max(0.15, 1 - v / el.offsetHeight)) : ''; }
    };
    const down = (x: number, py: number, id: number, target: EventTarget | null) => {
      const t = target as Element | null;
      const moving = Boolean(anim?.running);
      const handle = moving || Boolean(t?.closest('.sheet-grip, .sheet-grab, .modal-head, .um-head, .add-sheet-header'));
      if (!handle && (t?.closest('input, textarea, select, [contenteditable="true"]') || scrolledInside(t, el))) return;
      // Catch a moving sheet where it is (and call off a close that was under way).
      if (moving) { anim!.stop(); anim = null; closing = false; }
      start = { x, y: py, id, handle, base: y };
      dragging = moving;
      speed.reset();
      speed.add(py);
    };
    const move = (x: number, py: number, e: Event) => {
      if (!start) return;
      const ddy = py - start.y;
      if (!dragging) {
        if (Math.abs(x - start.x) > Math.abs(ddy) || Math.abs(ddy) < 6) { if (Math.abs(x - start.x) > 10) start = null; return; }
        // Upward from the content scrolls it; upward from the grab bar or header rubber-bands.
        if (ddy < 0 && !start.handle) { start = null; return; }
        dragging = true;
      }
      if (e.cancelable) e.preventDefault();
      speed.add(py);
      const raw = start.base + ddy;
      set(raw < 0 ? rubberBand(raw, el.offsetHeight) : raw);
    };
    const up = () => {
      if (!start) return;
      const was = dragging;
      start = null; dragging = false;
      if (!was) return;
      const v = speed.get();
      const h = el.offsetHeight;
      const projected = y + v * PROJECT_MS;
      if (y > 0 && (projected > h * 0.5 || (v > FLICK && y > 8))) {
        closing = true;
        haptic();
        anim = spring(y, h + 40, Math.max(v, 1.2), set, () => { anim = null; if (closing) close.current(); }, { stiffness: 260, damping: 32 });
      } else {
        anim = spring(y, 0, v, set, () => { anim = null; set(0); });
      }
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
      anim?.stop();
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
