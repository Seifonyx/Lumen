import { useStore } from '../store';
import { rubberBand, springTo, Velocity, type Motion } from './spring';
import { haptic } from './haptics';

/**
 * A phone drawer that follows the finger; vertical scrolling keeps its native behavior. Letting go keeps the
 * finger's speed (spring), the drawer can be caught mid-slide (including a tap-opened one), and pulling it
 * further open than it goes resists like a rubber band.
 */
export function installSidebarGestures(): () => void {
  const root = document.documentElement;
  const phone = window.matchMedia('(max-width: 899px)');
  type Drag = { id: number; x: number; y: number; open: boolean; sign: number; width: number; offset: number; lastX: number; time: number; velocity: number; claimed: boolean; target: Element; sidebar: HTMLElement; scrim: HTMLElement };
  let drag: Drag | null = null;
  let frame = 0;
  let suppressClickUntil = 0;
  let suppressTarget: Element | null = null;
  let anim: Motion | null = null;
  const speed = new Velocity();
  /** Where the drawer actually is on screen (0 closed … width open), even mid-animation. */
  const visualOffset = (sidebar: HTMLElement, width: number, sign: number) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(sidebar).transform === 'none' ? undefined : getComputedStyle(sidebar).transform);
    return Math.max(0, Math.min(width, width + sign * m.m41));
  };

  const clear = () => {
    anim?.stop(); anim = null;
    cancelAnimationFrame(frame);
    frame = 0;
    delete root.dataset.sidebarDragging;
    drag?.sidebar.style.removeProperty('transform');
    drag?.scrim.style.removeProperty('opacity');
    drag = null;
  };
  const paint = () => {
    frame = 0;
    if (!drag?.claimed) return;
    drag.sidebar.style.transform = `translateX(${drag.sign * (drag.offset - drag.width)}px)`;
    drag.scrim.style.opacity = String(drag.offset / drag.width);
  };
  const start = (event: TouchEvent) => {
    // Caught mid-slide (after a release, or a tap that opened or closed it): continue from where it is.
    const onDrawer = event.target instanceof Element && Boolean(event.target.closest('.sidebar, .scrim'));
    const moving = anim?.running && onDrawer ? drag : null;
    if (moving && event.touches.length === 1) {
      moving.offset = anim!.stop(); anim = null;
      const t = event.touches[0];
      const open = useStore.getState().sidebarOpen;
      moving.open = open; moving.id = t.identifier; moving.claimed = true; moving.y = t.clientY;
      moving.x = t.clientX - (moving.offset - (open ? moving.width : 0)) * moving.sign;
      speed.reset(); speed.add(t.clientX * moving.sign);
      return;
    }
    clear();
    const state = useStore.getState();
    if (!phone.matches || event.touches.length !== 1 || state.settingsOpen || !state.authed || window.getSelection()?.toString()) return;
    const target = event.target;
    if (!(target instanceof Element) || document.querySelector('.modal-backdrop, .sheet-backdrop, .models-pop, .usage-pop')) return;
    if (target.closest('input, textarea, select, [contenteditable], pre, table, .menu')) return;
    if (state.sidebarOpen ? !target.closest('.sidebar, .scrim') : !target.closest('.main') || target.closest('button, a, label, .composer')) return;
    // Leave sideways code, tables and other horizontal scrollers to the browser.
    for (let el: Element | null = target; el && el !== document.body; el = el.parentElement) {
      if (el.scrollWidth > el.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return;
    }
    const sidebar = document.querySelector<HTMLElement>('.sidebar');
    const scrim = document.querySelector<HTMLElement>('.scrim');
    if (!sidebar || !scrim) return;
    const t = event.touches[0];
    const width = sidebar.getBoundingClientRect().width;
    const sign = getComputedStyle(sidebar).direction === 'rtl' ? -1 : 1;
    const at = visualOffset(sidebar, width, sign), rest = state.sidebarOpen ? width : 0;
    drag = { id: t.identifier, x: t.clientX, y: t.clientY, open: state.sidebarOpen, sign, width, offset: rest, lastX: t.clientX, time: performance.now(), velocity: 0, claimed: false, target, sidebar, scrim };
    speed.reset(); speed.add(t.clientX * sign);
    // Still sliding from a tap: freeze it where it is and let the finger take over from there.
    if (onDrawer && Math.abs(at - rest) > 2 && sidebar.getAnimations().length) {
      drag.offset = at; drag.claimed = true; drag.x = t.clientX - (at - rest) * sign;
      root.dataset.sidebarDragging = '';
      paint();
    }
  };
  const move = (event: TouchEvent) => {
    if (!drag) return;
    if (event.touches.length !== 1 || window.getSelection()?.toString() || useStore.getState().settingsOpen || document.querySelector('.modal-backdrop, .sheet-backdrop')) { clear(); return; }
    const t = event.touches[0];
    if (t.identifier !== drag.id) { clear(); return; }
    const dx = (t.clientX - drag.x) * drag.sign;
    const dy = Math.abs(t.clientY - drag.y);
    if (!drag.claimed) {
      if (dy > 12 && dy > Math.abs(dx)) { clear(); return; }
      if (Math.abs(dx) < 12 || Math.abs(dx) < dy * 1.5) return;
      if (!drag.open && dx < 0) { clear(); return; } // (open + rightward: allowed, it rubber-bands)
      drag.claimed = true;
      root.dataset.sidebarDragging = '';
    }
    if (event.cancelable) event.preventDefault();
    speed.add(t.clientX * drag.sign);
    const raw = (drag.open ? drag.width : 0) + dx;
    drag.offset = raw > drag.width ? drag.width + rubberBand(raw - drag.width, drag.width) : Math.max(0, raw);
    if (!frame) frame = requestAnimationFrame(paint);
  };
  const end = (event: TouchEvent) => {
    if (!drag) return;
    if (!drag.claimed) { clear(); return; }
    if (event.cancelable) event.preventDefault();
    suppressClickUntil = performance.now() + 400;
    suppressTarget = drag.target;
    const velocity = speed.get();
    const travelled = Math.abs(drag.offset - (drag.open ? drag.width : 0));
    const fling = travelled >= 24 && Math.abs(velocity) > .45;
    // Past about a third of the way (where the finger's speed would carry it) commits the change.
    const projected = drag.offset + velocity * 160;
    const open = fling ? velocity > 0 : drag.open ? projected > drag.width * .65 : projected > drag.width * .35;
    if (open !== drag.open) haptic();
    useStore.getState().setUi({ sidebarOpen: open });
    // The drawer keeps the finger's speed and settles with a spring; the state above is already final.
    cancelAnimationFrame(frame); frame = 0;
    const d = drag;
    // (Runs on the graphics thread: smooth even while the chat you picked is rendering.)
    const frames = (x: number): [HTMLElement, Keyframe][] => [[d.sidebar, { transform: `translateX(${d.sign * (x - d.width)}px)` }], [d.scrim, { opacity: String(x / d.width) }]];
    anim = springTo(d.offset, open ? d.width : 0, velocity, frames, () => { anim = null; d.offset = open ? d.width : 0; clear(); }, { stiffness: 900, damping: 60 });
  };
  const click = (event: MouseEvent) => {
    if (performance.now() < suppressClickUntil && event.target instanceof Node && suppressTarget?.contains(event.target)) {
      event.preventDefault(); event.stopImmediatePropagation(); suppressClickUntil = 0;
    }
  };
  document.addEventListener('touchstart', start, { passive: true });
  document.addEventListener('touchmove', move, { passive: false });
  document.addEventListener('touchend', end, { passive: false });
  document.addEventListener('touchcancel', clear);
  document.addEventListener('click', click, true);
  window.addEventListener('resize', clear);
  phone.addEventListener('change', clear);
  return () => {
    clear();
    document.removeEventListener('touchstart', start);
    document.removeEventListener('touchmove', move);
    document.removeEventListener('touchend', end);
    document.removeEventListener('touchcancel', clear);
    document.removeEventListener('click', click, true);
    window.removeEventListener('resize', clear);
    phone.removeEventListener('change', clear);
  };
}
