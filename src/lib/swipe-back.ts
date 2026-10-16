// Edge swipe-back for stacked screens on phones (Settings sections): start at the left edge and the screen
// follows your finger while the previous one eases in underneath; let go past halfway (or with a flick) to
// go back, otherwise it springs back. A screen that's still moving can be caught again.
// With the iPhone glass look it works like iOS 26: the swipe can start anywhere on the screen (not only at the
// edge), as long as the finger clearly moves sideways and isn't on something that scrolls sideways itself.
import { haptic } from './haptics';
import { swapControl } from './motion';
import { flushSync } from 'react-dom';
import { springTo, Velocity, type Motion } from './spring';

const EDGE = 24; // px from the left edge where the gesture starts
// Where a swipe from the middle of the screen doesn't start: fields, sideways-scrolling rows and controls.
const IGNORE = 'input, textarea, select, [contenteditable="true"], .segmented, .swipe-row, .coll-filters, .hub-tabs, .tools-rail, pre, table, .switch, [role="slider"], .modal-backdrop, .sheet-backdrop, .ctx-layer';
const scrollsSideways = (el: Element | null, root: Element) => {
  for (let n = el; n && n !== root; n = n.parentElement) {
    const s = getComputedStyle(n);
    if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 2) return true;
  }
  return false;
};
const glassPhone = () => document.documentElement.classList.contains('glass') && matchMedia('(max-width: 899px)').matches;

export interface SwipeBackOptions {
  /** The screen that's really underneath (the chat), revealed as the page moves, instead of a copy of the page. */
  reveal?: () => HTMLElement | null;
}

/**
 * `page` is the screen element; `underlay(copy)` turns a copy of it into the previous screen (for Settings:
 * the same page without the open section); `back()` performs the navigation. Returns a cleanup.
 */
export function installSwipeBack(page: HTMLElement, canGoBack: () => boolean, underlay: (copy: HTMLElement) => void, back: () => void, opts: SwipeBackOptions = {}) {
  let start: { x: number; y: number; id: number; edge: boolean } | null = null;
  let revealed = false;
  let claimed = false, dx = 0, anim: Motion | null = null, under: HTMLElement | null = null, dim: HTMLElement | null = null;
  const speed = new Velocity();
  const width = () => page.offsetWidth;

  // Only transform and opacity change per frame (the screen underneath is dimmed by a layer, not a filter),
  // so the browser can move everything on its graphics thread.
  const frames = (x: number): [HTMLElement | null, Keyframe][] => {
    const p = Math.min(1, x / width());
    return [[page, { transform: x > 0.5 ? `translateX(${x}px)` : 'translateX(0)' }], [under, { transform: `translateX(${-28 * (1 - p)}%)` }], [dim, { opacity: String(0.08 * (1 - p)) }]];
  };
  const paint = (x: number) => {
    dx = x;
    page.style.transition = 'none';
    page.style.boxShadow = x > 0.5 ? '-8px 0 24px rgb(0 0 0 / .14)' : '';
    frames(x).forEach(([el, kf]) => { if (el) Object.assign(el.style, kf); });
  };
  const makeUnder = () => {
    if (under || !page.parentNode) return;
    const real = opts.reveal?.();
    if (real) {
      // The chat itself slides back in: shown under the page (CSS) for the length of the gesture.
      document.querySelector('.app')?.classList.add('swipe-revealing');
      revealed = true;
      dim = document.createElement('div');
      dim.className = 'swipe-dim';
      real.append(dim);
      under = real;
      return;
    }
    const copy = page.cloneNode(true) as HTMLElement;
    copy.inert = true;
    copy.setAttribute('aria-hidden', 'true');
    copy.removeAttribute('id');
    copy.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
    copy.classList.add('exit-ghost', 'swipe-under');
    underlay(copy);
    Object.assign(copy.style, { position: 'absolute', top: `${page.offsetTop}px`, left: `${page.offsetLeft}px`, width: `${page.offsetWidth}px`, height: `${page.offsetHeight}px`, margin: '0', zIndex: '1', pointerEvents: 'none', display: getComputedStyle(page).display });
    dim = document.createElement('div');
    Object.assign(dim.style, { position: 'absolute', inset: '0', background: '#000', opacity: '0.08', pointerEvents: 'none', zIndex: '10' });
    copy.append(dim);
    page.parentNode.insertBefore(copy, page);
    if (getComputedStyle(page).position === 'static') page.style.position = 'relative';
    page.style.zIndex = '2';
    under = copy;
  };
  const reset = () => {
    if (revealed) {
      dim?.remove();
      if (under) { under.style.transform = ''; under.style.transition = ''; }
      document.querySelector('.app')?.classList.remove('swipe-revealing');
      revealed = false;
    } else under?.remove();
    under = null; dim = null;
    page.style.transform = ''; page.style.boxShadow = ''; page.style.zIndex = ''; page.style.transition = '';
    if (page.style.position === 'relative') page.style.position = '';
    dx = 0;
  };

  const ts = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    if (anim?.running) { dx = anim.stop(); anim = null; start = { x: t.clientX - dx, y: t.clientY, id: t.identifier, edge: true }; claimed = true; speed.reset(); speed.add(t.clientX); return; }
    if (!canGoBack()) return;
    const edge = t.clientX <= EDGE;
    if (!edge) {
      const target = e.target as Element;
      if (!glassPhone() || target.closest(IGNORE) || scrollsSideways(target, page)) return;
    }
    start = { x: t.clientX, y: t.clientY, id: t.identifier, edge };
    claimed = false;
    speed.reset(); speed.add(t.clientX);
  };
  const tm = (e: TouchEvent) => {
    if (!start) return;
    const t = [...e.touches].find((x) => x.identifier === start!.id);
    if (!t) return;
    const ddx = t.clientX - start.x, ddy = t.clientY - start.y;
    if (!claimed) {
      if (Math.abs(ddy) > 10 && Math.abs(ddy) > Math.abs(ddx)) { start = null; return; }
      if (ddx < (start.edge ? 8 : 12)) return;
      // From the middle of the screen, only a clearly sideways move counts (otherwise it's scrolling).
      if (!start.edge && ddx < Math.abs(ddy) * 1.4) { start = null; return; }
      claimed = true;
      makeUnder();
    }
    if (e.cancelable) e.preventDefault();
    speed.add(t.clientX);
    paint(Math.max(0, ddx));
  };
  const te = () => {
    if (!start) return;
    const was = claimed;
    start = null; claimed = false;
    if (!was) return;
    const v = speed.get(), w = width();
    if (dx + v * 180 > w * 0.5 || (v > 0.5 && dx > 16)) {
      haptic();
      // The slide already happened, so going back mustn't animate again.
      anim = springTo(dx, w, Math.max(v, 0.6), frames, () => { anim = null; swapControl.skip = true; try { flushSync(back); } finally { swapControl.skip = false; } reset(); }, { stiffness: 320, damping: 34 });
    } else {
      anim = springTo(dx, 0, v, frames, () => { anim = null; reset(); }, { stiffness: 420, damping: 40 });
    }
  };
  page.addEventListener('touchstart', ts, { passive: true });
  page.addEventListener('touchmove', tm, { passive: false });
  page.addEventListener('touchend', te);
  page.addEventListener('touchcancel', te);
  return () => {
    anim?.stop(); reset();
    page.removeEventListener('touchstart', ts);
    page.removeEventListener('touchmove', tm);
    page.removeEventListener('touchend', te);
    page.removeEventListener('touchcancel', te);
  };
}
