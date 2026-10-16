// Bottom sheets under your finger: drag down to dismiss. Letting go keeps the finger's speed (a quick flick
// closes even a short drag; a slow, short one springs back), a moving sheet can be caught again mid-flight,
// and pulling up past the top resists like a rubber band.
// Starts from the grab bar or header at any time, or from the content when it's scrolled to the top.
import { useEffect, useRef, type RefObject } from 'react';
import { rubberBand, springTo, Velocity, type Motion } from './spring';
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
    let y = 0, dragging = false, anim: Motion | null = null, closing = false;
    const speed = new Velocity();
    // The dimmed background lightens as the sheet goes, so nothing dark is left behind once it's gone. A
    // separate scrim fades; a backdrop that contains the sheet has its colour faded (its opacity would fade
    // the sheet too).
    const backdrop = () => (scrim?.current && !scrim.current.contains(el) ? scrim.current : null);
    const holder = () => (backdrop() ? null : el.parentElement?.closest<HTMLElement>('.modal-backdrop, .sheet-backdrop') || null);
    let base: number[] | null = null;
    const tint = (b: HTMLElement, k: number) => {
      base ??= (getComputedStyle(b).backgroundColor.match(/[\d.]+/g) || ['0', '0', '0', '0']).map(Number);
      const [r, g, bl, a = 1] = base;
      return `rgba(${r}, ${g}, ${bl}, ${(a * k).toFixed(3)})`;
    };
    const frames = (v: number): [HTMLElement | null, Keyframe][] => {
      // (Clears a little ahead of the sheet, so the screen never ends up darker than where it lands.)
      const k = v > 0 ? Math.max(0, 1 - (1.6 * v) / el.offsetHeight) : 1;
      const b = backdrop(), h = holder();
      return [[el, { transform: `translateY(${v}px)` }], [b, { opacity: String(k) }], [h, { backgroundColor: h ? tint(h, k) : '' }]];
    };
    const set = (v: number) => {
      y = v;
      el.style.transition = 'none';
      const b = backdrop(), h = holder();
      if (b) b.style.transition = 'none';
      if (h) h.style.transition = 'none';
      if (Math.abs(v) < 0.01) { el.style.transform = ''; if (b) b.style.opacity = ''; if (h) h.style.backgroundColor = ''; return; }
      frames(v).forEach(([n, kf]) => { if (n) Object.assign(n.style, kf); });
    };
    // Released: the rest of the motion runs on the graphics thread (see springTo).
    const settle = (to: number, v: number, done: () => void, opts?: { stiffness: number; damping: number }) => {
      el.style.transition = 'none';
      anim = springTo(y, to, v, frames, () => { anim = null; y = to; done(); }, opts);
    };
    const down = (x: number, py: number, id: number, target: EventTarget | null) => {
      const t = target as Element | null;
      const moving = Boolean(anim?.running);
      const handle = moving || Boolean(t?.closest('.sheet-grip, .sheet-grab, .modal-head, .um-head, .add-sheet-header'));
      // (A swipe down that starts on a one-line field, such as the search box at the top, still moves the sheet;
      // a tap still types in it. Multi-line text and menus keep the touch for themselves.)
      if (!handle && (t?.closest('textarea, select, [contenteditable="true"]') || scrolledInside(t, el))) return;
      // Catch a moving sheet where it is (and call off a close that was under way).
      if (moving) { y = anim!.stop(); anim = null; closing = false; }
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
        // Dragging from a field: no keyboard popping up as the sheet goes.
        if (document.activeElement instanceof HTMLInputElement && el.contains(document.activeElement)) document.activeElement.blur();
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
        // (No blur behind it while it goes: Safari can draw a fading blurred layer as a black flash.)
        const hb = holder();
        if (hb) { hb.style.setProperty('backdrop-filter', 'none'); hb.style.setProperty('-webkit-backdrop-filter', 'none'); }
        // (Well past its height: a sheet floating above the bottom edge must leave the screen completely.)
        settle(h + 120, Math.max(v, 1.2), () => { if (closing) close.current(); }, { stiffness: 380, damping: 36 });
      } else {
        settle(0, v, () => set(0));
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
