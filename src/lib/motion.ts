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
import { springTo } from './spring';
import { cloneElement, useLayoutEffect, useRef, type ReactElement, type Ref, type RefObject } from 'react';
import { flushSync } from 'react-dom';

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Off with reduced motion, and in automated tests unless a test opts in (window.__mrMotion = true): copies of
 * closing elements would otherwise linger for a moment where older tests look for the real ones. */
export const motionOff = () => reducedMotion() || (typeof navigator !== 'undefined' && navigator.webdriver && !(window as { __mrMotion?: boolean }).__mrMotion);
const EASE_OUT = 'cubic-bezier(.2,.8,.2,1)';
const EASE_IN = 'cubic-bezier(.4,0,1,1)';
// iOS-like push/pop: quick start, long soft landing.
const SLIDE = 'cubic-bezier(.32, .72, 0, 1)';

export type ExitKind = 'fade' | 'pop' | 'sheet' | 'modal' | 'row' | 'toast' | 'drop';

const KEYFRAMES: Record<ExitKind, { frames: Keyframe[]; ms: number }> = {
  fade: { frames: [{ opacity: 1 }, { opacity: 0 }], ms: 140 },
  pop: { frames: [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.97)' }], ms: 130 },
  drop: { frames: [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(6px)' }], ms: 130 },
  // (Past its own height: sheets that float above the bottom edge, as with the iPhone glass look, must leave the screen fully.)
  sheet: { frames: [{ transform: 'translateY(0)' }, { transform: 'translateY(calc(100% + 120px))' }], ms: 220 },
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
/** The exit's first frame at the element's current opacity, when it starts from "fully visible". */
function fromNow(frames: Keyframe[], el: HTMLElement): Keyframe[] {
  const opacity = parseFloat(getComputedStyle(el).opacity);
  if (!('opacity' in frames[0]) || !(opacity < 0.99)) return frames;
  return [{ ...frames[0], opacity }, ...frames.slice(1)];
}

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
  // No blur behind a copy that's fading out: Safari can draw a fading blurred layer as a black flash.
  ghost.style.setProperty('backdrop-filter', 'none');
  ghost.style.setProperty('-webkit-backdrop-filter', 'none');
  node.parentNode.insertBefore(ghost, node);
  let { frames, ms } = KEYFRAMES[kind];
  // Fade from how it looks right now (a backdrop already faded by dragging its sheet away must not flash
  // back to full darkness first).
  frames = fromNow(frames, node);
  // A sheet that was being dragged leaves from where the finger let go, not from its resting place.
  const now = node.style.transform;
  if (kind === 'sheet' && now && now !== 'none') { frames = [{ transform: now }, frames[1]]; ms = 160; }
  const runs = [ghost.animate(frames, { duration: ms, easing: EASE_IN, fill: 'forwards' })];
  for (const [selector, partKind] of parts) {
    const el = ghost.querySelector<HTMLElement>(selector);
    const live = node.querySelector<HTMLElement>(selector)?.style.transform;
    const part = KEYFRAMES[partKind];
    const liveNode = node.querySelector<HTMLElement>(selector);
    const pf = partKind === 'sheet' && live && live !== 'none' ? [{ transform: live }, part.frames[1]] : liveNode ? fromNow(part.frames, liveNode) : part.frames;
    if (el) runs.push(el.animate(pf, { duration: part.ms, easing: EASE_IN, fill: 'forwards' }));
  }
  Promise.all(runs.map((r) => r.finished)).catch(() => {}).finally(() => ghost.remove());
}

/**
 * Gives a component an exit animation when it unmounts. Skips the immediate remount React's development
 * mode does, so only real closes animate.
 */
export function useExit(ref: RefObject<HTMLElement | null>, kind: ExitKind, parts: [string, ExitKind][] = [], enabled = true) {
  const born = useRef(0);
  const opts = useRef({ kind, parts, enabled });
  opts.current = { kind, parts, enabled };
  useLayoutEffect(() => {
    born.current = performance.now();
    const node = ref.current;
    return () => {
      if (!opts.current.enabled || !node || performance.now() - born.current < 40) return;
      exitGhost(node, opts.current.kind, opts.current.parts);
    };
  }, [ref]);
}

/** Only replies appended to an already-open conversation arrive. Loading history, switching chats
 * and remounting virtual rows never replay entrances, and token updates never restart them. */
export function useReplyEntrance(root: RefObject<HTMLElement | null>, ids: string[]) {
  const seen = useRef<Set<string> | null>(null);
  seen.current ??= new Set(ids);
  const order = ids.join('|');
  useLayoutEffect(() => {
    const fresh = ids.filter(id => !seen.current!.has(id));
    seen.current = new Set(ids);
    if (motionOff()) return;
    const runs = fresh.flatMap(id => {
      const message = root.current?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(id)}"] > .msg.assistant`);
      return message ? [message.animate([{ opacity: .5, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: EASE_OUT })] : [];
    });
    return () => runs.forEach(run => run.cancel());
  }, [root, order]); // ids have the same contents while the order is unchanged.
}

const setRef = <T,>(ref: Ref<T> | undefined, value: T | null) => {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
};

/** Wraps one element (with its own ref, if any) so it animates out when it's removed. */
export function Exit({ kind, parts, children, enabled = true }: { kind: ExitKind; parts?: [string, ExitKind][]; enabled?: boolean; children: ReactElement<{ ref?: Ref<HTMLElement> }> }) {
  const ref = useRef<HTMLElement | null>(null);
  useExit(ref, kind, parts, enabled);
  const own = children.props.ref;
  return cloneElement(children, { ref: (el: HTMLElement | null) => { ref.current = el; setRef(own, el); } });
}

/**
 * Swaps one screen for another as a push (the new one slides in from the right over the old one, which
 * eases left and dims) or a pop (the old one slides away to the right, revealing the new one). `from` is the
 * screen now; `to` finds the screen after the change. The change itself is applied immediately and in full,
 * so focus, state and tests see it at once; only a copy of the old screen is animated.
 */
/** Set while a change has already been animated by a gesture (swipe-back), so pageSwap just applies it. */
export const swapControl = { skip: false };
let swapSerial = 0;
let stopSwap: (() => void) | null = null;

export function pageSwap(dir: 'push' | 'pop' | 'fade', from: HTMLElement | null, to: () => HTMLElement | null, change: () => void) {
  const serial = ++swapSerial;
  stopSwap?.();
  stopSwap = null;
  if (swapControl.skip || !from || motionOff() || !from.isConnected || !from.parentNode) { change(); return; }
  const ghost = from.cloneNode(true) as HTMLElement;
  copyValues(from, ghost);
  ghost.inert = true;
  ghost.setAttribute('aria-hidden', 'true');
  ghost.removeAttribute('id');
  ghost.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  ghost.classList.add('exit-ghost', 'page-swap-ghost');
  ghost.style.animation = 'none';
  ghost.style.display = getComputedStyle(from).display;
  const scroll = [...from.querySelectorAll<HTMLElement>('*')].filter((el) => el.scrollTop > 0).map((el) => [el, el.scrollTop] as const);
  Object.assign(ghost.style, { position: 'absolute', top: `${from.offsetTop}px`, left: `${from.offsetLeft}px`, width: `${from.offsetWidth}px`, height: `${from.offsetHeight}px`, margin: '0', pointerEvents: 'none' });
  from.parentNode.insertBefore(ghost, from);
  stopSwap = () => ghost.remove();
  // Keep the copy scrolled exactly like the original.
  const all = [...from.querySelectorAll<HTMLElement>('*')], copies = [...ghost.querySelectorAll<HTMLElement>('*')];
  for (const [el, top] of scroll) { const c = copies[all.indexOf(el)]; if (c) c.scrollTop = top; }
  flushSync(change);
  // A screen that loads on demand may need a moment to appear; the copy of the old one covers the wait.
  let tries = 0;
  const begin = () => {
    if (serial !== swapSerial) return;
    const found = to();
    if (!found && tries++ < 20) { requestAnimationFrame(begin); return; }
    stopSwap = animateSwap(dir, ghost, found);
  };
  begin();
}

function animateSwap(dir: 'push' | 'pop' | 'fade', ghost: HTMLElement, next: HTMLElement | null) {
  // Only transform and opacity animate (the screen going underneath is dimmed by a layer, not a filter, and
  // the shadow is fixed), so the browser runs the whole slide on its graphics thread.
  const opts = { duration: dir === 'fade' ? 180 : 340, easing: dir === 'fade' ? EASE_OUT : SLIDE };
  const runs: Animation[] = [];
  const extras: HTMLElement[] = [];
  const original = next ? { position: next.style.position, zIndex: next.style.zIndex, boxShadow: next.style.boxShadow } : null;
  const dimOver = (el: HTMLElement, z: string, from: number, to: number) => {
    const r = el.getBoundingClientRect();
    const dim = document.createElement('div');
    dim.className = 'exit-ghost';
    Object.assign(dim.style, { position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, background: '#000', pointerEvents: 'none', zIndex: z, opacity: String(to) });
    // In the same parent, so it stacks with the two screens (above the one it dims, below the other).
    el.parentElement?.insertBefore(dim, el.nextSibling);
    extras.push(dim);
    return dim.animate([{ opacity: from, transform: from > to ? 'translateX(-28%)' : 'none' }, { opacity: to, transform: from > to ? 'none' : 'translateX(-28%)' }], opts);
  };
  if (dir === 'push') {
    ghost.style.zIndex = '1';
    runs.push(ghost.animate([{ transform: 'none' }, { transform: 'translateX(-28%)' }], opts));
    if (next) {
      if (getComputedStyle(next).position === 'static') next.style.position = 'relative';
      next.style.zIndex = '3';
      next.style.boxShadow = '-8px 0 24px rgb(0 0 0 / .1)';
      runs.push(dimOver(ghost, '2', 0, 0.08));
      runs.push(next.animate([{ transform: 'translateX(100%)' }, { transform: 'none' }], opts));
    }
  } else if (dir === 'pop') {
    ghost.style.zIndex = '3';
    ghost.style.boxShadow = '-8px 0 24px rgb(0 0 0 / .1)';
    runs.push(ghost.animate([{ transform: 'none' }, { transform: 'translateX(100%)' }], opts));
    if (next) {
      runs.push(next.animate([{ transform: 'translateX(-28%)' }, { transform: 'none' }], opts));
      runs.push(dimOver(next, '2', 0.08, 0));
    }
  } else {
    ghost.style.zIndex = '3';
    runs.push(ghost.animate([{ opacity: 1 }, { opacity: 0 }], opts));
    if (next) runs.push(next.animate([{ opacity: .7, transform: 'scale(.99)' }, { opacity: 1, transform: 'none' }], { ...opts, duration: 240 }));
  }
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    runs.forEach(run => run.cancel());
    ghost.remove();
    extras.forEach((e) => e.remove());
    if (next && original) Object.assign(next.style, original);
    if (stopSwap === cleanup) stopSwap = null;
  };
  Promise.all(runs.map((r) => r.finished)).catch(() => {}).finally(cleanup);
  return cleanup;
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

// ---- Sending, like a messaging app: the new message rises out of the text box with a soft spring, and the
// conversation above slides up with it instead of jumping. Transform and opacity only, on the graphics thread.
let flight: { right: number; bottom: number; at: number; lastId?: string; lastTop?: number } | null = null;
/** Remember where the text and the latest message were just before sending. */
export function noteSend(from: HTMLElement | null) {
  if (!from || motionOff()) return;
  const r = from.getBoundingClientRect();
  const last = document.querySelector<HTMLElement>('.thread .message-row:last-child');
  flight = { right: r.right, bottom: r.bottom, at: performance.now(), lastId: last?.dataset.messageId, lastTop: last?.getBoundingClientRect().top };
}
/** Play it once the new message is on the page. */
export function flySent(bubble: HTMLElement | null | undefined) {
  const f = flight;
  flight = null;
  if (!f || !bubble || performance.now() - f.at > 1500 || motionOff()) return;
  const thread = bubble.closest<HTMLElement>('.thread');
  const r = bubble.getBoundingClientRect();
  // How far the earlier messages were pushed up: they start where they were and glide.
  const prev = f.lastId ? thread?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(f.lastId)}"]`) : null;
  const shift = prev && f.lastTop !== undefined ? f.lastTop - prev.getBoundingClientRect().top : 0;
  const lift = shift > 0 && shift < window.innerHeight;
  // The bubble starts at the bottom right of the text box, a little smaller.
  const dx = Math.min(0, f.right - r.right);
  const dy = Math.max(0, f.bottom - r.bottom - (lift ? shift : 0));
  if (dy > window.innerHeight) return;
  // The whole message moves as one piece (scaled around the bubble's corner); its buttons fade in as it lands.
  const msg = bubble.closest<HTMLElement>('.msg') || bubble;
  const m = msg.getBoundingClientRect();
  msg.style.animation = 'none';
  msg.style.transformOrigin = `${r.right - m.left}px ${r.bottom - m.top}px`;
  springTo(0, 1, 0, (t) => [
    [msg, { transform: `translate(${dx * (1 - t)}px, ${dy * (1 - t)}px) scale(${0.88 + 0.12 * t})` }],
    [lift ? thread : null, { transform: `translateY(${shift * (1 - t)}px)` }],
  ], () => { msg.style.transform = ''; msg.style.transformOrigin = ''; if (thread) thread.style.transform = ''; }, { stiffness: 340, damping: 30 });
  bubble.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: 'ease-out' });
  msg.querySelector('.msg-actions')?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }], { duration: 520, easing: 'ease-out' });
}

// ---- While a reply streams, each new piece of text fades in instead of popping in. Works on the rendered
// HTML: text that arrived in the last half second is wrapped word by word in spans whose fade is offset by
// how long ago it arrived, so re-rendering mid-fade continues smoothly instead of restarting.
const FADE_MS = 240;
const SKIP_BLOCKS = '.katex, svg, style, script';
export type Arrivals = { total: number; list: { at: number; time: number }[] };
export function fadeInText(root: HTMLElement, arrivals: Arrivals) {
  const now = performance.now();
  const nodes: { node: Text; start: number }[] = [];
  let total = 0;
  // Maths, graphics and code styles are skipped as whole blocks (one check per element, not per word), so this
  // stays cheap on long replies; text already fading is counted but not wrapped again.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeType === Node.TEXT_NODE ? NodeFilter.FILTER_ACCEPT : (n as Element).matches(SKIP_BLOCKS) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP),
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text;
    if (!t.parentElement?.classList.contains('fresh')) nodes.push({ node: t, start: total });
    total += t.length;
  }
  if (total > arrivals.total) arrivals.list.push({ at: arrivals.total, time: now });
  else if (total < arrivals.total) arrivals.list = arrivals.list.filter((a) => a.at < total);
  arrivals.total = total;
  arrivals.list = arrivals.list.filter((a, i, all) => now - a.time < FADE_MS || (all[i + 1] && now - all[i + 1].time < FADE_MS));
  const live = arrivals.list.map((a, i, all) => ({ from: a.at, to: all[i + 1]?.at ?? Infinity, age: now - a.time })).filter((r) => r.age < FADE_MS);
  if (!live.length) return;
  for (let k = nodes.length - 1; k >= 0; k--) {
    const { node, start } = nodes[k];
    const end = start + node.length;
    for (let j = live.length - 1; j >= 0; j--) {
      const r = live[j];
      const a = Math.max(r.from, start), b = Math.min(r.to, end);
      if (a >= b) continue;
      // Split out [a, b) of this node and wrap each word in it.
      const tail = node.splitText(a - start);
      tail.splitText(b - a);
      // One fading piece per arrival (a few words): smooth, and cheap enough for long replies.
      const span = document.createElement('span');
      span.className = 'fresh';
      span.style.animationDelay = `${-r.age}ms`;
      tail.replaceWith(span);
      span.append(tail);
    }
  }
}
/** After streaming: drop the wrappers so the finished reply is plain text again. */
export function settleText(root: HTMLElement) {
  const spans = root.querySelectorAll('.fresh');
  if (!spans.length) return;
  spans.forEach((s) => s.replaceWith(...s.childNodes));
  root.normalize();
}

// ---- Small moments
/** Sending: a lime ring ripples out of the send button and its icon hops. */
export function sendRipple() {
  if (motionOff()) return;
  const btn = document.querySelector<HTMLElement>('.composer .send-btn');
  if (!btn) return;
  const ring = document.createElement('span');
  ring.className = 'send-ripple';
  ring.setAttribute('aria-hidden', 'true');
  btn.append(ring);
  ring.animate([{ transform: 'scale(.7)', opacity: 0.6 }, { transform: 'scale(2.1)', opacity: 0 }], { duration: 560, easing: 'cubic-bezier(.2, .8, .2, 1)' }).finished.finally(() => ring.remove());
  btn.querySelector('svg')?.animate([{ transform: 'none' }, { transform: 'translateY(-4px) scale(.88)', offset: 0.35 }, { transform: 'none' }], { duration: 440, easing: 'cubic-bezier(.3, 1.3, .5, 1)' });
}
/** The first message of a new chat: the welcome (crescent and greeting) lifts away instead of vanishing. */
export function liftWelcome() {
  if (motionOff()) return;
  const welcome = document.querySelector<HTMLElement>('.main.is-empty .empty');
  if (!welcome) return;
  const r = welcome.getBoundingClientRect();
  const ghost = welcome.cloneNode(true) as HTMLElement;
  ghost.classList.add('exit-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, { position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, margin: '0', zIndex: '5', pointerEvents: 'none' });
  document.body.append(ghost);
  ghost.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-28px) scale(.96)' }], { duration: 320, easing: 'cubic-bezier(.4, 0, .2, 1)' }).finished.finally(() => ghost.remove());
}

// ---- Sliding selection for segmented controls (Theme, Text size…): one thumb glides to the chosen option.
export function useSegmentThumb(box: RefObject<HTMLElement | null>, value: string) {
  const first = useRef(true);
  useLayoutEffect(() => {
    const el = box.current;
    const thumb = el?.querySelector<HTMLElement>(':scope > .seg-thumb');
    const active = el?.querySelector<HTMLElement>(':scope > button.active');
    if (!el || !thumb || !active) return;
    const place = () => {
      thumb.style.width = `${active.offsetWidth}px`;
      thumb.style.height = `${active.offsetHeight}px`;
      thumb.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
    };
    // No glide the first time (it's simply there), or when motion is off.
    if (first.current || motionOff()) { thumb.style.transition = 'none'; place(); void thumb.offsetWidth; thumb.style.transition = ''; }
    else place();
    first.current = false;
    const ro = new ResizeObserver(() => { thumb.style.transition = 'none'; place(); void thumb.offsetWidth; thumb.style.transition = ''; });
    ro.observe(el);
    return () => ro.disconnect();
  }, [box, value]);
}
