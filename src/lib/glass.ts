// The iPhone look: see-through "glass" bars, floating controls and frosted sheets (styles in glass.css,
// all under `html.glass`). Only iPhones and iPads that can draw it smoothly get it:
//  - iOS 16 or later (older Safari draws blur slowly and with glitches);
//  - the browser can blur what's behind an element;
//  - the person hasn't asked for less transparency or less motion-heavy effects;
//  - this device hasn't stuttered with it before.
// While it's on, frames are timed whenever something moves (scrolling, sheets, the sidebar). If too many are
// slow, glass is turned off on this device for good and the solid look returns at once.
import { isIOS } from './device';

const KEY = 'mr.glass';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } };

const iosVersion = () => {
  const m = /OS (\d+)[_.]\d+.* like Mac OS X/.exec(navigator.userAgent);
  if (m) return Number(m[1]);
  return /Macintosh/.test(navigator.userAgent) ? 17 : 0; // iPadOS reports itself as a Mac; those are recent.
};
const canBlur = () => typeof CSS !== 'undefined' && (CSS.supports('backdrop-filter', 'blur(2px)') || CSS.supports('-webkit-backdrop-filter', 'blur(2px)'));

/** Whether this device should get the glass look. `?glass` in the address forces it on (for checking designs). */
export function glassWanted(): boolean {
  const forced = /[?&]glass(=1)?(&|$)/.test(location.search);
  if (forced) return true;
  if (read() === 'off') return false;
  if (!isIOS() || iosVersion() < 16 || !canBlur()) return false;
  if (matchMedia('(prefers-reduced-transparency: reduce)').matches) return false;
  return true;
}

/** Turns glass on when wanted, and off for good if it makes this device stutter. */
export function initGlass(): void {
  const root = document.documentElement;
  if (!glassWanted()) return;
  root.classList.add('glass');
  if (/[?&]glass/.test(location.search)) return; // forced: never switch off by itself

  // Frame timing while something is moving. A frame over 34 ms is a visible hitch (two missed frames at 60 Hz).
  let samples = 0, slow = 0, last = 0, until = 0, frame = 0;
  const tick = (t: number) => {
    if (last && document.visibilityState === 'visible') {
      samples++;
      if (t - last > 34) slow++;
    }
    last = t;
    if (t < until) frame = requestAnimationFrame(tick);
    else { frame = 0; last = 0; judge(); }
  };
  const moving = () => {
    until = performance.now() + 700;
    if (!frame) frame = requestAnimationFrame(tick);
  };
  const judge = () => {
    // Enough to be sure (about 5 seconds of movement), and more than a quarter of frames late: give up on glass.
    if (samples < 300) return;
    if (slow / samples > 0.25) {
      root.classList.remove('glass');
      write('off');
      stop();
    } else if (samples > 1800) {
      write('ok');
      stop(); // it's smooth here; stop measuring
    }
  };
  const opts = { capture: true, passive: true } as const;
  const stop = () => { for (const e of ['scroll', 'touchmove', 'transitionstart', 'animationstart']) document.removeEventListener(e, moving, opts); };
  if (read() === 'ok') return;
  for (const e of ['scroll', 'touchmove', 'transitionstart', 'animationstart']) document.addEventListener(e, moving, opts);
}

/** With glass, the chat runs under the floating top bar and message box: this keeps their heights in
 *  `--glass-top` and `--glass-bottom` on the chat, so the first and last messages are never hidden. */
export function watchGlassInsets(main: HTMLElement | null): () => void {
  if (!main || !document.documentElement.classList.contains('glass') || typeof ResizeObserver === 'undefined') return () => {};
  const set = () => {
    const top = main.querySelector<HTMLElement>(':scope > .topbar');
    const bottom = main.querySelector<HTMLElement>(':scope > .composer-wrap');
    main.style.setProperty('--glass-top', `${top?.offsetHeight ?? 0}px`);
    main.style.setProperty('--glass-bottom', `${bottom?.offsetHeight ?? 0}px`);
  };
  const ro = new ResizeObserver(set);
  const observe = () => { ro.disconnect(); for (const el of main.querySelectorAll(':scope > .topbar, :scope > .composer-wrap')) ro.observe(el); set(); };
  const mo = new MutationObserver(observe);
  mo.observe(main, { childList: true });
  observe();
  return () => { ro.disconnect(); mo.disconnect(); };
}
