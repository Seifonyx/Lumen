// Motion helpers: exits for things that unmount, FLIP for lists, and page transitions.
//
// Exits: React removes a closed menu, sheet, window or toast in one go. Just before that happens, a copy of
// it (non-interactive, hidden from assistive technology) takes its place and animates out, so nothing
// vanishes. The real element is already gone, so focus, state and tap targets behave exactly as before.
//
// FLIP: list rows that move (pin, new chat, delete) glide from their old position to the new one.
//
// Page transitions: the browser's View Transitions snapshot the screen before and after a change and animate
// between them, so the first and last frames match the screens exactly. Used for Settings push/pop, opening
// and closing Settings, and theme changes; skipped where unsupported or with reduced motion.
import { cloneElement, useLayoutEffect, useRef, type ReactElement, type Ref, type RefObject } from 'react';
import { flushSync } from 'react-dom';

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Off with reduced motion, and in automated tests unless a test opts in (window.__mrMotion = true): copies of
 * closing elements would otherwise linger for a moment where older tests look for the real ones. */
export const motionOff = () => reducedMotion() || (typeof navigator !== 'undefined' && navigator.webdriver && !(window as { __mrMotion?: boolean }).__mrMotion);
const EASE_OUT = 'cubic-bezier(.2,.8,.2,1)';
const EASE_IN = 'cubic-bezier(.4,0,1,1)';

export type ExitKind = 'fade' | 'pop' | 'sheet' | 'modal' | 'row' | 'toast' | 'drop';

const KEYFRAMES: Record<ExitKind, { frames: Keyframe[]; ms: number }> = {
  fade: { frames: [{ opacity: 1 }, { opacity: 0 }], ms: 140 },
  pop: { frames: [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.97)' }], ms: 130 },
  drop: { frames: [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(6px)' }], ms: 130 },
  sheet: { frames: [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], ms: 220 },
  modal: { frames: [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.97)' }], ms: 150 },
  row: { frames: [{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: 'translateX(-12px)' }], ms: 180 },
  toast: { frames: [{ opacity: 1, transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: 'translateY(-8px) scale(.98)' }], ms: 180 },
};

/** Copies form values the clone wouldn't otherwise show (cloneNode copies attributes, not typed values). */
function copyValues(from: Element, to: Element) {
  const a = from.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea');
  const b = to.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea');
  a.forEach((el, i) => { const c = b[i]; if (c && 'value' in c) { try { c.value = el.value; if ('checked' in el) (c as HTMLInputElement).checked = (el as HTMLInputElement).checked; } catch { /* file inputs */ } } });
}

/**
 * Plays an exit for `node` using a copy, then removes the copy. `parts` animates inner pieces too (for
 * example a sheet sliding down while its backdrop fades).
 */
export function exitGhost(node: HTMLElement, kind: ExitKind, parts: [string, ExitKind][] = []) {
  if (motionOff() || !node.isConnected || !node.parentNode) return;
  const ghost = node.cloneNode(true) as HTMLElement;
  copyValues(node, ghost);
  ghost.inert = true;
  ghost.setAttribute('aria-hidden', 'true');
  ghost.removeAttribute('id');
  ghost.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  ghost.classList.add('exit-ghost');
  // Keep showing it even if a rule hides elements of its kind once the change lands.
  ghost.style.display = getComputedStyle(node).display;
  const pos = getComputedStyle(node).position;
  if (pos !== 'fixed' && pos !== 'absolute') {
    // Out of the flow, exactly where it was, so the rest of the layout settles immediately.
    Object.assign(ghost.style, { position: 'absolute', top: `${node.offsetTop}px`, left: `${node.offsetLeft}px`, width: `${node.offsetWidth}px`, height: `${node.offsetHeight}px`, margin: '0', zIndex: '1' });
  } else if (pos === 'absolute') {
    Object.assign(ghost.style, { top: `${node.offsetTop}px`, left: `${node.offsetLeft}px`, right: 'auto', bottom: 'auto', width: `${node.offsetWidth}px`, margin: '0' });
  }
  ghost.style.pointerEvents = 'none';
  node.parentNode.insertBefore(ghost, node);
  let { frames, ms } = KEYFRAMES[kind];
  // A sheet that was being dragged leaves from where the finger let go, not from its resting place.
  const now = node.style.transform;
  if (kind === 'sheet' && now && now !== 'none') { frames = [{ transform: now }, frames[1]]; ms = 160; }
  const runs = [ghost.animate(frames, { duration: ms, easing: EASE_IN, fill: 'forwards' })];
  for (const [selector, partKind] of parts) {
    const el = ghost.querySelector<HTMLElement>(selector);
    const live = node.querySelector<HTMLElement>(selector)?.style.transform;
    const part = KEYFRAMES[partKind];
    const pf = partKind === 'sheet' && live && live !== 'none' ? [{ transform: live }, part.frames[1]] : part.frames;
    if (el) runs.push(el.animate(pf, { duration: part.ms, easing: EASE_IN, fill: 'forwards' }));
  }
  Promise.all(runs.map((r) => r.finished)).catch(() => {}).finally(() => ghost.remove());
}

/**
 * Gives a component an exit animation when it unmounts. Skips the immediate remount React's development
 * mode does, so only real closes animate.
 */
export function useExit(ref: RefObject<HTMLElement | null>, kind: ExitKind, parts: [string, ExitKind][] = []) {
  const born = useRef(0);
  const opts = useRef({ kind, parts });
  opts.current = { kind, parts };
  useLayoutEffect(() => {
    born.current = performance.now();
    const node = ref.current;
    return () => {
      if (!node || performance.now() - born.current < 40) return;
      exitGhost(node, opts.current.kind, opts.current.parts);
    };
  }, [ref]);
}

const setRef = <T,>(ref: Ref<T> | undefined, value: T | null) => {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
};

/** Wraps one element (with its own ref, if any) so it animates out when it's removed. */
export function Exit({ kind, parts, children }: { kind: ExitKind; parts?: [string, ExitKind][]; children: ReactElement<{ ref?: Ref<HTMLElement> }> }) {
  const ref = useRef<HTMLElement | null>(null);
  useExit(ref, kind, parts);
  const own = children.props.ref;
  return cloneElement(children, { ref: (el: HTMLElement | null) => { ref.current = el; setRef(own, el); } });
}

/**
 * Swaps one screen for another as a push (the new one slides in from the right over the old one, which
 * eases left and dims) or a pop (the old one slides away to the right, revealing the new one). `from` is the
 * screen now; `to` finds the screen after the change. The change itself is applied immediately and in full,
 * so focus, state and tests see it at once; only a copy of the old screen is animated.
 */
export function pageSwap(dir: 'push' | 'pop' | 'fade', from: HTMLElement | null, to: () => HTMLElement | null, change: () => void) {
  if (!from || motionOff() || !from.isConnected || !from.parentNode) { change(); return; }
  const ghost = from.cloneNode(true) as HTMLElement;
  copyValues(from, ghost);
  ghost.inert = true;
  ghost.setAttribute('aria-hidden', 'true');
  ghost.removeAttribute('id');
  ghost.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  ghost.classList.add('exit-ghost');
  ghost.style.display = getComputedStyle(from).display;
  const scroll = [...from.querySelectorAll<HTMLElement>('*')].filter((el) => el.scrollTop > 0).map((el) => [el, el.scrollTop] as const);
  Object.assign(ghost.style, { position: 'absolute', top: `${from.offsetTop}px`, left: `${from.offsetLeft}px`, width: `${from.offsetWidth}px`, height: `${from.offsetHeight}px`, margin: '0', pointerEvents: 'none' });
  from.parentNode.insertBefore(ghost, from);
  // Keep the copy scrolled exactly like the original.
  const all = [...from.querySelectorAll<HTMLElement>('*')], copies = [...ghost.querySelectorAll<HTMLElement>('*')];
  for (const [el, top] of scroll) { const c = copies[all.indexOf(el)]; if (c) c.scrollTop = top; }
  flushSync(change);
  // A screen that loads on demand may need a moment to appear; the copy of the old one covers the wait.
  let tries = 0;
  const begin = () => {
    const found = to();
    if (!found && tries++ < 20) { requestAnimationFrame(begin); return; }
    animateSwap(dir, ghost, found);
  };
  begin();
}

function animateSwap(dir: 'push' | 'pop' | 'fade', ghost: HTMLElement, next: HTMLElement | null) {
  const opts = { duration: dir === 'fade' ? 180 : 300, easing: EASE_OUT };
  const runs: Animation[] = [];
  if (dir === 'push') {
    ghost.style.zIndex = '1';
    runs.push(ghost.animate([{ transform: 'none', filter: 'brightness(1)' }, { transform: 'translateX(-28%)', filter: 'brightness(.92)' }], opts));
    if (next) { if (getComputedStyle(next).position === 'static') next.style.position = 'relative'; next.style.zIndex = '2'; runs.push(next.animate([{ transform: 'translateX(100%)', boxShadow: '-8px 0 24px rgb(0 0 0 / .12)' }, { transform: 'none', boxShadow: '-8px 0 24px rgb(0 0 0 / 0)' }], opts)); }
  } else if (dir === 'pop') {
    ghost.style.zIndex = '3';
    runs.push(ghost.animate([{ transform: 'none', boxShadow: '-8px 0 24px rgb(0 0 0 / .12)' }, { transform: 'translateX(100%)', boxShadow: '-8px 0 24px rgb(0 0 0 / 0)' }], opts));
    if (next) runs.push(next.animate([{ transform: 'translateX(-28%)', filter: 'brightness(.92)' }, { transform: 'none', filter: 'brightness(1)' }], opts));
  } else {
    ghost.style.zIndex = '3';
    runs.push(ghost.animate([{ opacity: 1 }, { opacity: 0 }], opts));
  }
  Promise.all(runs.map((r) => r.finished)).catch(() => {}).finally(() => {
    ghost.remove();
    if (next) { next.style.zIndex = ''; if (next.style.position === 'relative') next.style.position = ''; }
  });
}

/**
 * FLIP: rows (children with data-flip="key") glide from where they were to where they are after the order
 * changes (pin, new chat, delete); new rows fade in. Measures only when `order` changes, so it costs nothing
 * while text streams in. Positions are relative to the list, so scrolling doesn't count as movement.
 */
export function useFlip(container: RefObject<HTMLElement | null>, order: string, enabled = true) {
  const last = useRef(new Map<string, { x: number; y: number }>());
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const base = root.getBoundingClientRect();
    const next = new Map<string, { x: number; y: number }>();
    const animate = enabled && !motionOff() && last.current.size > 0;
    root.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
      const r = el.getBoundingClientRect();
      const now = { x: r.left - base.left, y: r.top - base.top };
      next.set(el.dataset.flip!, now);
      if (!animate) return;
      const was = last.current.get(el.dataset.flip!);
      if (!was) { el.animate([{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: EASE_OUT }); return; }
      const dx = was.x - now.x, dy = was.y - now.y;
      if (Math.abs(dy) < 1 && Math.abs(dx) < 1) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 260, easing: EASE_OUT });
    });
    last.current = next;
  }, [container, order]); // eslint-disable-line react-hooks/exhaustive-deps
}

type TransitionKind = 'push' | 'pop' | 'fade' | 'theme';
type VT = { finished: Promise<void>; ready: Promise<void>; skipTransition?: () => void };

/** Runs a state change as a page transition: push (new page slides in from the inline end), pop, or a crossfade. */
export function pageTransition(kind: TransitionKind, change: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => VT };
  if (!doc.startViewTransition || motionOff() || document.visibilityState !== 'visible') { change(); return; }
  const root = document.documentElement;
  root.dataset.transition = kind;
  try {
    const vt = doc.startViewTransition(() => flushSync(change));
    vt.finished.finally(() => { if (root.dataset.transition === kind) delete root.dataset.transition; });
  } catch {
    delete root.dataset.transition;
    change();
  }
}
