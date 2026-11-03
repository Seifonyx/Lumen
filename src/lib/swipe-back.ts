// Custom phone Back. Leave the current screen intact until history restores the real destination.
import { CANVAS_SHELL } from './canvas-presentation';
import { haptic } from './haptics';
import { browserOwnsEdges, isBackEdge, isBrowserEdge } from './navigation-edge';
import { Velocity } from './spring';

const IGNORE = 'input, textarea, select, [contenteditable="true"], .segmented, .swipe-row, .coll-filters, .hub-tabs, .tools-rail, pre, table, .switch, [role="slider"], .modal-backdrop, .sheet-backdrop, .ctx-layer, .glass-tabbar';
const scrollsSideways = (el: Element, root: Element) => {
  for (let n: Element | null = el; n && n !== root; n = n.parentElement) {
    const s = getComputedStyle(n);
    if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 2) return true;
  }
  return false;
};

export function installSwipeBack(page: HTMLElement, canGoBack: () => boolean, back: () => void) {
  if (CANVAS_SHELL && browserOwnsEdges()) return;
  let start: { x: number; y: number; id: number } | null = null;
  let claimed = false;
  const speed = new Velocity();
  const cancel = () => { start = null; claimed = false; };

  const touchStart = (event: TouchEvent) => {
    cancel();
    const target = event.target;
    if (event.touches.length !== 1 || event.defaultPrevented || !canGoBack() || !(target instanceof Element) || target.closest(IGNORE)) return;
    const touch = event.touches[0];
    if (isBrowserEdge(touch.clientX)) return;
    const glassPhone = document.documentElement.classList.contains('glass') && matchMedia('(max-width: 899px)').matches;
    if ((!isBackEdge(touch.clientX) && !glassPhone) || scrollsSideways(target, page)) return;
    start = { x: touch.clientX, y: touch.clientY, id: touch.identifier };
    speed.reset();
    speed.add(touch.clientX);
  };
  const touchMove = (event: TouchEvent) => {
    if (!start) return;
    const touch = event.touches[0];
    if (event.defaultPrevented || event.touches.length !== 1 || touch.identifier !== start.id) { cancel(); return; }
    const dx = touch.clientX - start.x, dy = Math.abs(touch.clientY - start.y);
    if (!claimed) {
      if ((dy > 10 && dy >= dx) || dx < -12) { cancel(); return; }
      if (dx < 12 || dx < dy * 1.4) return;
      claimed = true;
    }
    if (event.cancelable) event.preventDefault();
    speed.add(touch.clientX);
  };
  const touchEnd = (event: TouchEvent) => {
    const gesture = start, wasClaimed = claimed;
    cancel();
    if (!gesture || !wasClaimed || event.touches.length || event.defaultPrevented || !canGoBack()) return;
    const touch = Array.from(event.changedTouches).find(t => t.identifier === gesture.id);
    if (!touch) return;
    const dx = touch.clientX - gesture.x;
    if (dx < page.clientWidth * 0.5 && (dx < 24 || speed.get() <= 0.5)) return;
    if (event.cancelable) event.preventDefault();
    haptic();
    back();
  };
  page.addEventListener('touchstart', touchStart, { passive: true });
  page.addEventListener('touchmove', touchMove, { passive: false });
  page.addEventListener('touchend', touchEnd);
  page.addEventListener('touchcancel', cancel);
  window.addEventListener('popstate', cancel);
  window.addEventListener('pagehide', cancel);
  return () => {
    cancel();
    page.removeEventListener('touchstart', touchStart);
    page.removeEventListener('touchmove', touchMove);
    page.removeEventListener('touchend', touchEnd);
    page.removeEventListener('touchcancel', cancel);
    window.removeEventListener('popstate', cancel);
    window.removeEventListener('pagehide', cancel);
  };
}
