// Bottom sheets under your finger: drag down to dismiss. Letting go keeps the finger's speed (a quick flick
// closes even a short drag; a slow, short one springs back), a moving sheet can be caught again mid-flight,
// and pulling up past the top resists like a rubber band.
// Starts from the grab bar or header at any time, or from the content when it's scrolled to the top.
import { useEffect, useRef, type RefObject } from 'react';
import { rubberBand, springTo, Velocity, type Motion } from './spring';
import { haptic } from './haptics';
import { reducedMotion } from './motion';

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

// With `detent`, a tall sheet opens at iOS's medium detent (about half the screen): dragging up grows it to its full
// height, dragging down goes from full to medium and from medium away. The position `y` runs from 0 (full height)
// through `m` (medium: the sheet is m px shorter, its content still scrolls) to beyond `m` (the medium sheet leaving).
export function useSheetDrag(sheet: RefObject<HTMLElement | null>, onClose: () => void, enabled = true, scrim?: RefObject<HTMLElement | null>, detent = false) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = sheet.current;
    if (!enabled || !el) return;
    let start: { y: number; x: number; id: number; handle: boolean; base: number } | null = null;
    let y = 0, dragging = false, anim: Motion | null = null, closing = false;
    // Medium detent only for a sheet taller than about 70% of the screen. Measured at its own height: when this
    // effect runs again over the same sheet, a medium sheet's inline size is cleared first (and medium restored).
    const at = el.dataset.detent;
    if (detent && at) { el.style.maxHeight = ''; el.style.transform = ''; }
    const full = el.offsetHeight, m = detent && full > innerHeight * 0.7 ? Math.round(full - innerHeight * 0.55) : 0;
    // At medium the sheet is really shorter (its content still scrolls to the end). A sheet pinned at the top would
    // shrink away from the bottom edge, so it also moves down by what its bottom rose (`drop`: m for a top-pinned
    // sheet, 0 for one that sits on the bottom edge).
    let drop = 0;
    // (Layout offsets, not on-screen boxes: the sheet may still be sliding in.)
    const bottom = () => el.offsetTop + el.offsetHeight;
    if (m) { const before = bottom(); el.style.maxHeight = `${full - m}px`; drop = Math.max(0, before - bottom()); el.style.maxHeight = ''; }
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
      // Keep the background depth connected to the sheet until it has fully left the screen.
      // (The background stays fully dimmed down to the medium detent.)
      const t = v - m;
      const k = t > 0 ? Math.max(0, 1 - t / (el.offsetHeight - m + 120)) : 1;
      const b = backdrop(), h = holder();
      const shrink = m ? Math.min(m, Math.max(0, v)) : 0, move = v < 0 || !m ? v : drop * shrink / m + Math.max(0, v - m);
      const sheetFrame: Keyframe = m ? { transform: `translateY(${move}px)`, maxHeight: `${full - shrink}px` } : { transform: `translateY(${v}px)` };
      return [[el, sheetFrame], [b, { opacity: String(k) }], [h, { backgroundColor: h ? tint(h, k) : '' }]];
    };
    const set = (v: number) => {
      y = v;
      el.style.transition = 'none';
      const b = backdrop(), h = holder();
      if (b) b.style.transition = 'none';
      if (h) h.style.transition = 'none';
      if (Math.abs(v) < 0.01) { el.style.transform = ''; el.style.maxHeight = ''; if (b) b.style.opacity = ''; if (h) h.style.backgroundColor = ''; if (m) el.dataset.detent = 'full'; else delete el.dataset.detent; return; }
      if (m) el.dataset.detent = v > 0 && v <= m + 1 ? 'medium' : 'moving';
      frames(v).forEach(([n, kf]) => { if (n) Object.assign(n.style, kf); });
    };
    // Released: the rest of the motion runs on the graphics thread (see springTo).
    const settle = (to: number, v: number, done: () => void, opts?: { stiffness: number; damping: number }) => {
      el.style.transition = 'none';
      if (reducedMotion()) { set(to); done(); return; }
      anim = springTo(y, to, v, frames, () => { anim = null; y = to; done(); }, opts || { stiffness: 420, damping: 34 });
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
        // At the medium detent, an upward drag anywhere grows the sheet, as in iOS.
        if (ddy < 0 && !start.handle && !(m && start.base > 0)) { start = null; return; }
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
      const h = full - m;
      const projected = y + v * PROJECT_MS;
      // From a detent, dismissing takes a firmer flick than changing height.
      const away = m ? FLICK * 1.5 : FLICK;
      // Detents: a flick moves one step (full, medium, away); otherwise the stop nearest to where it would land.
      if (m && y <= m && !(v > away && y > m - 8) && projected < m + full * 0.5) {
        const to = v < -FLICK ? 0 : v > FLICK ? m : projected < m / 2 ? 0 : m;
        settle(to, v, () => set(to));
        return;
      }
      if (y > m && (projected > m + full * 0.5 || (v > away && y > m + 8)) || (m && v > away && y > m - 8)) {
        closing = true;
        haptic();
        // (No blur behind it while it goes: Safari can draw a fading blurred layer as a black flash.)
        const hb = holder();
        if (hb) { hb.style.setProperty('backdrop-filter', 'none'); hb.style.setProperty('-webkit-backdrop-filter', 'none'); }
        // (Well past its height: a sheet floating above the bottom edge must leave the screen completely.)
        settle(m + h + 120, Math.max(v, 1.2), () => { if (closing) close.current(); }, { stiffness: 380, damping: 36 });
      } else {
        settle(m, v, () => set(m));
      }
    };
    // An interrupted gesture restores the sheet even beyond the normal dismissal threshold.
    const cancel = () => {
      if (!start) return;
      start = null; dragging = false; closing = false;
      anim?.stop(); anim = null;
      speed.reset();
      const to = m && y > m / 2 ? m : 0;
      settle(to, 0, () => set(to));
    };
    if (m) set(at === 'full' ? 0 : m);
    // Typing in a medium sheet (its search) grows it to full height, so the keyboard never covers what you type.
    const grow = (e: FocusEvent) => { if (m && y > 0 && !dragging && (e.target as Element)?.matches?.('input, textarea')) settle(0, 0, () => set(0)); };
    el.addEventListener('focusin', grow);
    const ts = (e: TouchEvent) => { const t = e.touches[0]; if (e.touches.length === 1) down(t.clientX, t.clientY, t.identifier, e.target); else cancel(); };
    const tm = (e: TouchEvent) => { const t = [...e.touches].find((x) => x.identifier === start?.id); if (t) move(t.clientX, t.clientY, e); };
    // Mouse: only from the grab bar or header (so text can still be selected).
    const pd = (e: PointerEvent) => { if (e.pointerType !== 'mouse' || e.button !== 0) return; down(e.clientX, e.clientY, -1, e.target); if (start && !start.handle) start = null; };
    const pm = (e: PointerEvent) => { if (e.pointerType === 'mouse') move(e.clientX, e.clientY, e); };
    const pu = (e: PointerEvent) => { if (e.pointerType === 'mouse') up(); };
    el.addEventListener('touchstart', ts, { passive: true });
    el.addEventListener('touchmove', tm, { passive: false });
    el.addEventListener('touchend', up);
    el.addEventListener('touchcancel', cancel);
    el.addEventListener('pointerdown', pd);
    window.addEventListener('pointermove', pm);
    window.addEventListener('pointerup', pu);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    return () => {
      anim?.stop();
      el.removeEventListener('focusin', grow);
      el.removeEventListener('touchstart', ts);
      el.removeEventListener('touchmove', tm);
      el.removeEventListener('touchend', up);
      el.removeEventListener('touchcancel', cancel);
      el.removeEventListener('pointerdown', pd);
      window.removeEventListener('pointermove', pm);
      window.removeEventListener('pointerup', pu);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
    };
  }, [sheet, enabled, scrim]);
}

/** True on phone-sized screens, where windows open as bottom sheets. */
export const isSheetScreen = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
