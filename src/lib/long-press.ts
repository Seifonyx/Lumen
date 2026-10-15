// Press and hold on a touch screen (messages, chats): the item sinks slightly while you hold, then a menu
// opens with a tap you can feel. Moving the finger (scrolling) or lifting early cancels it (the app scrolling by
// itself doesn't), and the click that
// would follow the lift is swallowed so nothing else opens underneath.
import { useEffect, useRef, type RefObject } from 'react';
import { haptic } from './haptics';

const HOLD_MS = 450;
const SLOP = 8;

export function useLongPress(ref: RefObject<HTMLElement | null>, onLongPress: (target: Element, y: number) => void, { enabled = true, ignore = 'a, button, input, textarea, select, [contenteditable="true"], .code-head' } = {}) {
  const callback = useRef(onLongPress);
  callback.current = onLongPress;
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let timer = 0, sink = 0, x = 0, y = 0, fired = false;
    const reset = () => {
      clearTimeout(timer); clearTimeout(sink); timer = sink = 0;
      el.classList.remove('pressing');
    };
    const start = (e: TouchEvent) => {
      reset(); fired = false;
      const target = e.target as Element;
      if (e.touches.length !== 1 || target.closest(ignore) || !matchMedia('(pointer: coarse)').matches) return;
      x = e.touches[0].clientX; y = e.touches[0].clientY;
      sink = window.setTimeout(() => el.classList.add('pressing'), 220);
      timer = window.setTimeout(() => {
        reset(); fired = true;
        haptic('medium');
        callback.current(target, y);
      }, HOLD_MS);
    };
    const move = (e: TouchEvent) => {
      if (!timer) return;
      const t = e.touches[0];
      if (Math.hypot(t.clientX - x, t.clientY - y) > SLOP) reset();
    };
    const end = (e: TouchEvent) => {
      reset();
      if (!fired) return;
      if (e.cancelable) e.preventDefault();
      const swallow = (c: Event) => { c.preventDefault(); c.stopPropagation(); };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 400);
    };
    // Android opens its own menu (or starts selecting text) on a long press; this one replaces it.
    const menu = (e: Event) => { if (matchMedia('(pointer: coarse)').matches && !(e.target as Element).closest(ignore)) e.preventDefault(); };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: true });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', reset);
    el.addEventListener('contextmenu', menu);
    return () => {
      reset();
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', reset);
      el.removeEventListener('contextmenu', menu);
    };
  }, [ref, enabled, ignore]);
}
