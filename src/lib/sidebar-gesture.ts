import { useStore } from '../store';

/** A phone drawer that follows the finger; vertical scrolling keeps its native behavior. */
export function installSidebarGestures(): () => void {
  const root = document.documentElement;
  const phone = window.matchMedia('(max-width: 899px)');
  type Drag = { id: number; x: number; y: number; open: boolean; sign: number; width: number; offset: number; lastX: number; time: number; velocity: number; claimed: boolean; target: Element; sidebar: HTMLElement; scrim: HTMLElement };
  let drag: Drag | null = null;
  let frame = 0;
  let suppressClickUntil = 0;
  let suppressTarget: Element | null = null;

  const clear = () => {
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
    clear();
    const state = useStore.getState();
    if (!phone.matches || event.touches.length !== 1 || state.settingsOpen || !state.authed || window.getSelection()?.toString()) return;
    const target = event.target;
    if (!(target instanceof Element) || document.querySelector('.modal-backdrop, .sheet-backdrop, .models-pop, .usage-pop')) return;
    if (target.closest('input, textarea, select, [contenteditable], pre, table, .menu, .row-menu')) return;
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
    drag = { id: t.identifier, x: t.clientX, y: t.clientY, open: state.sidebarOpen, sign: getComputedStyle(sidebar).direction === 'rtl' ? -1 : 1, width, offset: state.sidebarOpen ? width : 0, lastX: t.clientX, time: performance.now(), velocity: 0, claimed: false, target, sidebar, scrim };
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
      if (drag.open ? dx > 0 : dx < 0) { clear(); return; }
      drag.claimed = true;
      root.dataset.sidebarDragging = '';
    }
    if (event.cancelable) event.preventDefault();
    const now = performance.now();
    drag.velocity = ((t.clientX - drag.lastX) * drag.sign) / Math.max(1, now - drag.time);
    drag.lastX = t.clientX;
    drag.time = now;
    drag.offset = Math.max(0, Math.min(drag.width, (drag.open ? drag.width : 0) + dx));
    if (!frame) frame = requestAnimationFrame(paint);
  };
  const end = (event: TouchEvent) => {
    if (!drag) return;
    if (!drag.claimed) { clear(); return; }
    if (event.cancelable) event.preventDefault();
    suppressClickUntil = performance.now() + 400;
    suppressTarget = drag.target;
    const velocity = performance.now() - drag.time < 120 ? drag.velocity : 0;
    const travelled = Math.abs(drag.offset - (drag.open ? drag.width : 0));
    const fling = travelled >= 24 && Math.abs(velocity) > .45;
    const open = fling ? velocity > 0 : drag.open ? drag.offset > drag.width * .65 : drag.offset > drag.width * .35;
    useStore.getState().setUi({ sidebarOpen: open });
    // Let React apply the final open state, then animate from the last painted position.
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(clear);
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
