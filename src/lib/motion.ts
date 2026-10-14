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
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { flushSync } from 'react-dom';

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  if (reducedMotion() || !node.isConnected || !node.parentNode) return;
  const ghost = node.cloneNode(true) as HTMLElement;
  copyValues(node, ghost);
  ghost.inert = true;
  ghost.setAttribute('aria-hidden', 'true');
  ghost.removeAttribute('id');
  ghost.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  ghost.classList.add('exit-ghost');
  const pos = getComputedStyle(node).position;
  if (pos !== 'fixed' && pos !== 'absolute') {
    // Out of the flow, exactly where it was, so the rest of the layout settles immediately.
    Object.assign(ghost.style, { position: 'absolute', top: `${node.offsetTop}px`, left: `${node.offsetLeft}px`, width: `${node.offsetWidth}px`, height: `${node.offsetHeight}px`, margin: '0', zIndex: '1' });
  } else if (pos === 'absolute') {
    Object.assign(ghost.style, { top: `${node.offsetTop}px`, left: `${node.offsetLeft}px`, right: 'auto', bottom: 'auto', width: `${node.offsetWidth}px`, margin: '0' });
  }
  ghost.style.pointerEvents = 'none';
  node.parentNode.insertBefore(ghost, node);
  const { frames, ms } = KEYFRAMES[kind];
  const runs = [ghost.animate(frames, { duration: ms, easing: EASE_IN, fill: 'forwards' })];
  for (const [selector, partKind] of parts) {
    const el = ghost.querySelector<HTMLElement>(selector);
    if (el) runs.push(el.animate(KEYFRAMES[partKind].frames, { duration: KEYFRAMES[partKind].ms, easing: EASE_IN, fill: 'forwards' }));
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

/**
 * FLIP: rows (children with data-flip) glide from where they were to where they are after a change; new rows
 * fade in. Call once per render with the list container.
 */
export function useFlip(container: RefObject<HTMLElement | null>) {
  const last = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const rows = root.querySelectorAll<HTMLElement>('[data-flip]');
    const next = new Map<string, DOMRect>();
    const skip = reducedMotion() || last.current.size === 0;
    rows.forEach((el) => {
      const key = el.dataset.flip!;
      const now = el.getBoundingClientRect();
      next.set(key, now);
      if (skip) return;
      const was = last.current.get(key);
      if (!was) { el.animate([{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: EASE_OUT }); return; }
      const dx = was.left - now.left, dy = was.top - now.top;
      if (Math.abs(dy) < 1 && Math.abs(dx) < 1) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 240, easing: EASE_OUT });
    });
    last.current = next;
  });
}

type TransitionKind = 'push' | 'pop' | 'fade' | 'theme';
type VT = { finished: Promise<void>; ready: Promise<void>; skipTransition?: () => void };

/** Runs a state change as a page transition: push (new page slides in from the inline end), pop, or a crossfade. */
export function pageTransition(kind: TransitionKind, change: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => VT };
  if (!doc.startViewTransition || reducedMotion() || document.visibilityState !== 'visible') { change(); return; }
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
