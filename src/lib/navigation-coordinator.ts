// Canvas phone navigation: one owner for every horizontal Back gesture and one transition for every screen change.
// Loaded on demand by the Canvas presentation on touch devices (canvas-presentation.on.ts → App.tsx).
//
// What is behind the current screen is the real thing when it can be: the chat (or a project's workspace) stays
// mounted under pages, Router and Settings, so it is revealed and moved for the gesture. Any other screen is shown from
// the presentation kept when you left it (taken just before the step, while it was still on screen), and only if it
// still describes the same chat, project and account. Otherwise the underlay is a plain page: never a wrong preview.
// A completed gesture makes exactly one history traversal; the layers come off once the destination has painted.
// Taps use the same slide (push from onScreenLeave, pop when the app itself traverses), so both feel like one system.
import { useStore } from '../store';
import { gestureOwner, browserOwnsEdges, isBackEdge } from './navigation-edge';
import { onScreenLeave, onScreenPop, screenEntry, screenParent, screenUp, type Screen } from './screen-history';
import { motionOff, swapControl } from './motion';
import { haptic } from './haptics';
import { Velocity } from './spring';
import { isTemporaryChat } from './temporary-chat';
import { installSidebarGestures } from './sidebar-gesture';

const PHONE = '(max-width: 899px)';
const LAYER = 'nav-layer';
// Screens from the top of the stack down; the first visible one is the current screen.
const SCREENS = ['.canvas-panel', '.settings-page', '.hub-page', '.run-panel', '.rc-page:not([hidden])', '.app > .main'];
// Presentations that own their own gestures: Back never starts over them.
const OVERLAYS = '.modal-backdrop, .sheet-backdrop, .models-pop, .usage-pop, .ctx-layer:not(.exit-ghost), .image-viewer, [role="dialog"], [role="menu"], [role="listbox"]';
const PARALLAX = 0.28, DIM = 0.08, SHADOW = '-8px 0 24px rgb(0 0 0 / .12)', EASE = 'cubic-bezier(.2, .8, .25, 1)';
const Z = { back: '55', under: '56', dim: '58', top: '60', drawer: '70' };

const phone = () => matchMedia(PHONE).matches;
const isLayer = (el: Element) => el.classList.contains(LAYER) || Boolean(el.closest(`.${LAYER}, .exit-ghost`));
const shown = (el: Element | null): el is HTMLElement => el instanceof HTMLElement && !isLayer(el) && el.getClientRects().length > 0;
/** The screen on top right now (pages, Router, Settings, panels or the chat). */
export function currentScreen(): HTMLElement | null {
  for (const s of SCREENS) { const el = [...document.querySelectorAll(s)].find(shown); if (el) return el; }
  return null;
}
/** Which screen an entry shows on a phone. */
const screenFor = (e: Screen) => e.canvasOpen ? '.canvas-panel' : e.settingsOpen ? '.settings-page' : e.page ? '.hub-page' : e.runner ? '.run-panel' : e.routing.open ? '.rc-page:not([hidden])' : '.app > .main';
/** Shown by the chat area itself: a conversation or a project's workspace. */
const inMain = (e: Screen) => !e.canvasOpen && !e.settingsOpen && !e.page && !e.runner && !e.routing.open && !e.layer;
/** A root screen (a conversation): its right swipe belongs to the drawer, not to Back. */
const isRoot = (e: Screen) => inMain(e) && !e.projectWorkspaceOpen;
/** On screen now: inside the viewport, not inert (a closed drawer keeps its box off to the side). */
const onScreen = (el: Element) => { if (!shown(el) || el.closest('[inert]')) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right > 1 && r.left < window.innerWidth - 1 && r.bottom > 1 && r.top < window.innerHeight - 1; };
const ready = (selector: string) => { const el = [...document.querySelectorAll(selector)].find(shown); return el && el.childElementCount > 0 ? el : null; };

// ---- Presentations kept when leaving a screen (memory only, this account only, never incognito or key fields).
type Kept = { node: HTMLElement; rect: DOMRect; display: string; scrolls: [number, number, number][]; uid?: string; entry: Screen; deps: unknown[] };
/** The store data a screen draws from. A kept screen is shown only while all of it is unchanged; otherwise what it shows
 * may no longer be what Back restores (a new project, a saved key, a new document), and the underlay stays plain. */
// The state the screen on display was drawn from: updated a frame after each change, once React has committed it. A step
// that changes data and navigates at once (New document) is then kept with the data it was actually showing.
let painted = useStore.getState(), paintFrame = 0;
const notePaint = () => { if (!paintFrame) paintFrame = requestAnimationFrame(() => { paintFrame = 0; painted = useStore.getState(); }); };
const deps = (selector: string, s = useStore.getState(), entry?: Screen) => {
  return selector === '.rc-page:not([hidden])' ? [s.keys, s.catalog, s.settings, s.chats]
    : selector === '.settings-page' ? [s.settings, s.keys, s.memories, s.user]
    : selector === '.run-panel' ? [s.runner]
    // A conversation's screen draws from that one chat (or none for a new chat): another chat being added is no change.
    : selector === '.app > .main' && entry && !entry.projectWorkspaceOpen ? [entry.currentId ? s.chats.find((c) => c.id === entry.currentId) : null, s.settings, s.memories]
    : [s.chats, s.settings, s.memories];
};
const kept = new Map<number, Kept>();
const KEEP = 8;
function keep(el: HTMLElement, entry: Screen): Kept {
  const all = [...el.querySelectorAll<HTMLElement>('*')];
  const scrolls: [number, number, number][] = [];
  if (el.scrollTop || el.scrollLeft) scrolls.push([-1, el.scrollTop, el.scrollLeft]);
  all.forEach((n, i) => { if (n.scrollTop || n.scrollLeft) scrolls.push([i, n.scrollTop, n.scrollLeft]); });
  const node = el.cloneNode(true) as HTMLElement;
  const from = el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'), to = node.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
  from.forEach((field, i) => {
    const copy = to[i]; if (!copy) return;
    if ((field as HTMLInputElement).type === 'password') { copy.removeAttribute('value'); copy.value = ''; return; }
    try { copy.value = field.value; if ('checked' in field) (copy as HTMLInputElement).checked = (field as HTMLInputElement).checked; } catch { /* file inputs */ }
  });
  // Nothing in a kept screen may load, play or be reached: no frames or media sources, no ids, no focus.
  node.querySelectorAll('iframe, video, audio, source, embed, object').forEach((n) => { n.removeAttribute('src'); n.removeAttribute('srcdoc'); n.removeAttribute('data'); });
  node.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  node.querySelectorAll('[autofocus]').forEach((n) => n.removeAttribute('autofocus'));
  node.removeAttribute('id');
  node.inert = true;
  node.setAttribute('aria-hidden', 'true');
  return { node, rect: el.getBoundingClientRect(), display: getComputedStyle(el).display, scrolls, uid: useStore.getState().user?.uid, entry, deps: deps(screenFor(entry), painted, entry) };
}
/** A kept screen is only shown if it still describes what Back will restore: same account, chat and project. */
function trusted(k: Kept | undefined) {
  if (!k) return null;
  const s = useStore.getState();
  if (k.uid !== s.user?.uid) return null;
  if (k.entry.currentId && !s.chats.some((c) => c.id === k.entry.currentId)) return null;
  if (k.entry.activeProjectId && !s.settings.projects?.some((p) => p.id === k.entry.activeProjectId)) return null;
  const now = deps(screenFor(k.entry), undefined, k.entry);
  return k.deps.every((d, i) => d === now[i]) ? k : null;
}
function mount(k: Kept, z: string) {
  const app = document.querySelector('.app');
  const node = k.node.cloneNode(true) as HTMLElement;
  node.classList.add(LAYER);
  node.setAttribute('aria-hidden', 'true');
  node.inert = true;
  Object.assign(node.style, { position: 'fixed', left: `${k.rect.left}px`, top: `${k.rect.top}px`, width: `${k.rect.width}px`, height: `${k.rect.height}px`, margin: '0', zIndex: z, pointerEvents: 'none', animation: 'none', transition: 'none' });
  node.style.setProperty('display', k.display, 'important');
  (app || document.body).append(node);
  const all = [...node.querySelectorAll<HTMLElement>('*')];
  for (const [i, top, left] of k.scrolls) { const n = i < 0 ? node : all[i]; if (n) { n.scrollTop = top; n.scrollLeft = left; } }
  return node;
}
const plain = (z: string, background = 'var(--bg)') => {
  const el = document.createElement('div');
  el.className = LAYER;
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, { position: 'fixed', inset: '0', zIndex: z, background, pointerEvents: 'none' });
  (document.querySelector('.app') || document.body).append(el);
  return el;
};

// ---- Lifting real screens for a transition, and putting back only what this module changed: the app may change the
// same element meanwhile (its focus scope makes the chat inert under a page and releases it when the page closes).
type Lift = { el: HTMLElement; props: [string, string, string][]; inert: boolean };
const lift = (el: HTMLElement, styles: Record<string, string>, opts: { inert?: boolean; display?: string } = {}): Lift => {
  const all = { ...styles, ...(opts.display ? { display: opts.display } : {}) };
  const props = Object.keys(all).map((k) => { const name = k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()); return [name, el.style.getPropertyValue(name), el.style.getPropertyPriority(name)] as [string, string, string]; });
  for (const [k, v] of Object.entries(all)) el.style.setProperty(k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()), v, k === 'display' ? 'important' : '');
  const inert = Boolean(opts.inert && !el.inert);
  if (inert) el.inert = true;
  return { el, props, inert };
};
const drop = (l: Lift | null) => {
  if (!l) return;
  l.el.getAnimations().forEach((a) => a.cancel());
  // Position first, with transitions still off, then the rest: a screen's own transition (it slides aside with the
  // drawer) must not replay this module's movement as it is put back.
  const put = ([name, value, priority]: [string, string, string]) => { if (value) l.el.style.setProperty(name, value, priority); else l.el.style.removeProperty(name); };
  l.props.filter(([name]) => name !== 'transition').forEach(put);
  void getComputedStyle(l.el).transform;
  l.props.filter(([name]) => name === 'transition').forEach(put);
  if (l.inert) l.el.inert = false;
};
/** The current screen, raised above everything it moves over. */
const raise = (el: HTMLElement) => lift(el, { zIndex: Z.top, boxShadow: SHADOW, willChange: 'transform', transition: 'none', transform: el.style.transform, ...(getComputedStyle(el).position === 'static' ? { position: 'relative' } : {}) });
/** The real chat underneath a page: shown for the transition only, inert and out of the layout. */
const reveal = (main: HTMLElement) => lift(main, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: Z.under, pointerEvents: 'none', willChange: 'transform', transition: 'none', transform: '' }, { inert: true, display: 'flex' });

type Under = { kind: 'live' | 'kept' | 'none'; el: HTMLElement | null; live: Lift | null; extra: HTMLElement[] };
/** What Back would show (the screen's parent, not the previous step), put underneath the current screen. */
function underlay(current: HTMLElement): Under | null {
  const behind = screenParent();
  if (!behind) return null;
  const s = useStore.getState(), b = behind.entry;
  const back = plain(Z.back);
  // Live when the destination is still mounted and shows the same thing: the chat or workspace under any screen, or a
  // page under a document panel opened from it.
  const selector = screenFor(b);
  const live = [...document.querySelectorAll<HTMLElement>(selector)].find((el) => el !== current && !isLayer(el) && (selector === '.app > .main' || shown(el)));
  if (live && selector === '.app > .main' && inMain(b) && b.currentId === s.currentId && b.activeProjectId === s.activeProjectId && b.projectWorkspaceOpen === s.projectWorkspaceOpen) {
    return { kind: 'live', el: live, live: reveal(live), extra: [back] };
  }
  if (live && selector === '.hub-page' && b.page === s.page && b.pageArg === s.pageArg) {
    return { kind: 'live', el: live, live: lift(live, { zIndex: Z.under, willChange: 'transform', transition: 'none', transform: '' }, { inert: true }), extra: [back] };
  }
  // Kept only if it is the screen Back now restores (a deep-linked visit exits past its own first screen).
  const k = trusted(kept.get(behind.id)), match = k && screenFor(k.entry) === selector ? k : null;
  if (match) { const el = mount(match, Z.under); el.dataset.navEntry = String(behind.id); return { kind: 'kept', el, live: null, extra: [back] }; }
  return { kind: 'none', el: null, live: null, extra: [back] };
}
const clearUnder = (u: Under | null) => { if (!u) return; drop(u.live); if (u.kind === 'kept') u.el?.remove(); u.extra.forEach((e) => e.remove()); };

// ---- The Back gesture.
type Phase = 'idle' | 'track' | 'drag' | 'settle' | 'commit';
let phase: Phase = 'idle';
type Gesture = { id: number; x: number; y: number; dx: number; width: number; screen: HTMLElement; top: Lift | null; under: Under | null; dim: HTMLElement | null; behind: number };
let g: Gesture | null = null;
const speed = new Velocity();
let frame = 0, guard = 0, suppressUntil = 0, suppressTarget: Element | null = null;

function eligible(event: TouchEvent): HTMLElement | null {
  if (phase !== 'idle' || event.touches.length !== 1 || !phone() || browserOwnsEdges()) return null;
  const s = useStore.getState(), entry = screenEntry();
  if (!s.authed || s.sidebarOpen || !entry || isRoot(entry) || !screenParent()) return null;
  if (window.getSelection()?.toString()) return null;
  const target = event.target, screen = currentScreen();
  if (!(target instanceof Element) || !screen || !screen.contains(target)) return null;
  const overlay = [...document.querySelectorAll(OVERLAYS)].find((el) => onScreen(el) && el !== screen && !el.contains(screen));
  if (overlay) return null;
  // Back starts only from the screen's leading edge, as in iOS apps: a right swipe across the content does nothing.
  if (!isBackEdge(event.touches[0].clientX)) return null;
  return screen;
}

function start(event: TouchEvent) {
  if (phase === 'settle' || phase === 'commit') { event.stopPropagation(); return; } // one gesture at a time
  const screen = eligible(event);
  if (!screen) return;
  const t = event.touches[0];
  g = { id: t.identifier, x: t.clientX, y: t.clientY, dx: 0, width: window.innerWidth, screen, top: null, under: null, dim: null, behind: screenParent()!.id };
  phase = 'track';
  gestureOwner.current = 'back';
  speed.reset(); speed.add(t.clientX);
}
function paint() {
  frame = 0;
  if (!g || phase !== 'drag') return;
  const p = Math.min(1, g.dx / g.width), still = motionOff();
  g.screen.style.transform = `translate3d(${g.dx}px, 0, 0)`;
  if (g.under?.el && !still) g.under.el.style.transform = `translate3d(${-PARALLAX * g.width * (1 - p)}px, 0, 0)`;
  if (g.dim) g.dim.style.opacity = String(DIM * (1 - p));
}
function claim() {
  if (!g) return;
  phase = 'drag';
  g.top = raise(g.screen);
  g.under = underlay(g.screen);
  g.dim = plain(Z.dim, '#000');
  g.dim.style.opacity = String(DIM);
  document.documentElement.dataset.navGesture = g.under?.kind || 'none';
}
function move(event: TouchEvent) {
  if (!g || (phase !== 'track' && phase !== 'drag')) return;
  const t = [...event.touches].find((x) => x.identifier === g!.id);
  if (!t || event.touches.length !== 1 || document.querySelector('.ctx-layer:not(.exit-ghost)')) { abort(); return; }
  const dx = t.clientX - g.x, dy = Math.abs(t.clientY - g.y);
  if (phase === 'track') {
    if ((dy > 10 && dy >= dx) || dx < -10) { reset(); return; }
    if (dx < 10 || dx < dy * 1.3) return;
    claim();
  }
  if (event.cancelable) event.preventDefault();
  speed.add(t.clientX);
  g.dx = Math.max(0, dx);
  if (!frame) frame = requestAnimationFrame(paint);
}
function end(event: TouchEvent) {
  if (!g) return;
  if (phase === 'track') { reset(); return; }
  if (phase !== 'drag') return;
  if (![...event.changedTouches].some((t) => t.identifier === g!.id)) return;
  if (event.cancelable) event.preventDefault();
  // The lifted finger must not also press whatever it started on (iOS sends a click after an unprevented touchend).
  suppressUntil = performance.now() + 450; suppressTarget = event.target instanceof Element ? event.target : null;
  cancelAnimationFrame(frame); frame = 0;
  const v = speed.get();
  // As UIKit decides: where the finger's speed would carry the screen, past half way, or a deliberate flick. Easing back
  // a little at the end still completes; a clear reversal stays, and so does a touch the system cancels.
  const projected = g.dx + v * 180;
  const commit = event.type === 'touchend' && Boolean(screenParent()) && ((projected > g.width / 2 && v > -0.3) || (v > 0.5 && g.dx > 30));
  settle(commit, v);
}
function settle(commit: boolean, v: number) {
  if (!g) return;
  phase = 'settle';
  const d = g, from = d.dx, to = commit ? d.width : 0;
  const finish = () => { if (g !== d) return; if (commit) traverse(); else reset(); };
  if (motionOff()) { d.dx = to; finish(); return; }
  const distance = Math.abs(to - from), pace = Math.max(Math.abs(v), 0.9);
  const duration = Math.round(Math.min(340, Math.max(160, (distance / pace) * 1.15)));
  const opts: KeyframeAnimationOptions = { duration, easing: EASE, fill: 'forwards' };
  const pf = Math.min(1, from / d.width), pt = to / d.width;
  const runs = [d.screen.animate([{ transform: `translate3d(${from}px,0,0)` }, { transform: `translate3d(${to}px,0,0)` }], opts)];
  if (d.under?.el) runs.push(d.under.el.animate([{ transform: `translate3d(${-PARALLAX * d.width * (1 - pf)}px,0,0)` }, { transform: `translate3d(${-PARALLAX * d.width * (1 - pt)}px,0,0)` }], opts));
  if (d.dim) runs.push(d.dim.animate([{ opacity: DIM * (1 - pf) }, { opacity: DIM * (1 - pt) }], opts));
  d.dx = to;
  Promise.all(runs.map((r) => r.finished)).then(finish, () => {});
}
function traverse() {
  if (!g) return;
  phase = 'commit';
  const d = g;
  d.screen.style.transform = `translate3d(${d.width}px, 0, 0)`;
  if (d.under?.el) d.under.el.style.transform = 'none';
  if (d.dim) d.dim.style.opacity = '0';
  d.screen.getAnimations().forEach((a) => a.cancel());
  d.under?.el?.getAnimations().forEach((a) => a.cancel());
  d.dim?.getAnimations().forEach((a) => a.cancel());
  haptic();
  // If the browser drops the traversal, put the current screen back rather than leave it hidden.
  guard = window.setTimeout(() => { if (g === d && phase === 'commit') reset(); }, 1500);
  // A screen that refuses to be left (an unsaved document name) slides back into place.
  if (!screenUp()) { window.clearTimeout(guard); settle(false, 0); }
}
/** After history has restored the destination: wait until it has painted, then take every layer off. */
function arrived() {
  const d = g;
  if (!d) return;
  window.clearTimeout(guard);
  const entry = screenEntry(), selector = entry ? screenFor(entry) : '.app > .main';
  let tries = 0;
  const check = () => {
    if (g !== d) return;
    if (!ready(selector) && tries++ < 40) { requestAnimationFrame(check); return; }
    requestAnimationFrame(() => { if (g === d) reset(); });
  };
  check();
}
/** Put everything back: transforms, the lifted chat, kept screens, dim and the owner. */
function reset() {
  cancelAnimationFrame(frame); frame = 0;
  window.clearTimeout(guard);
  const d = g;
  g = null; phase = 'idle'; gestureOwner.current = null;
  delete document.documentElement.dataset.navGesture;
  if (!d) return;
  drop(d.top);
  clearUnder(d.under);
  d.dim?.remove();
}
/** Browser Back, an account change or a resize during a gesture: stop at once, no traversal. */
const abort = () => { if (phase !== 'commit') reset(); };
const click = (event: MouseEvent) => {
  if (performance.now() < suppressUntil && event.target === suppressTarget) { event.preventDefault(); event.stopImmediatePropagation(); suppressUntil = 0; }
};

// ---- Taps: the same slide for a push (a new step) and for a pop the app itself asked for.
let swap: { cleanup: () => void } | null = null;
const stopSwap = () => { swap?.cleanup(); swap = null; };
const userAction = () => (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation?.isActive !== false;
function slide(dir: 'push' | 'pop', outgoing: HTMLElement, selector: string) {
  stopSwap();
  let tries = 0, done = false;
  const extras: HTMLElement[] = [outgoing];
  let lifted: Lift | null = null;
  // Leaving from the open drawer: the drawer keeps closing on top of the slide, as it does on its own.
  const drawer = document.querySelector<HTMLElement>('.sidebar.open, .cv-nav.open');
  const above = drawer ? [lift(drawer, { zIndex: Z.drawer }), ...[...document.querySelectorAll<HTMLElement>('.scrim')].map((el) => lift(el, { zIndex: String(+Z.drawer - 1) }))] : [];
  const cleanup = () => { if (done) return; done = true; drop(lifted); above.forEach(drop); extras.forEach((e) => e.remove()); if (swap?.cleanup === cleanup) swap = null; };
  swap = { cleanup };
  const begin = () => {
    if (done) return;
    const next = ready(selector);
    if (!next && tries++ < 30) { requestAnimationFrame(begin); return; }
    if (!next) { cleanup(); return; }
    const opts: KeyframeAnimationOptions = { duration: 340, easing: 'cubic-bezier(.32, .72, 0, 1)', fill: 'forwards' };
    const w = window.innerWidth, runs: Animation[] = [];
    const dim = plain(Z.dim, '#000'); extras.push(dim);
    if (dir === 'push') {
      outgoing.style.zIndex = Z.under; dim.style.opacity = '0';
      lifted = raise(next);
      runs.push(outgoing.animate([{ transform: 'none' }, { transform: `translate3d(${-PARALLAX * w}px,0,0)` }], opts));
      runs.push(dim.animate([{ opacity: 0 }, { opacity: DIM }], opts));
      runs.push(next.animate([{ transform: `translate3d(${w}px,0,0)` }, { transform: 'none' }], opts));
    } else {
      outgoing.style.zIndex = Z.top; outgoing.style.boxShadow = SHADOW;
      lifted = lift(next, { willChange: 'transform', transform: '' });
      runs.push(outgoing.animate([{ transform: 'none' }, { transform: `translate3d(${w}px,0,0)` }], opts));
      runs.push(dim.animate([{ opacity: DIM }, { opacity: 0 }], opts));
      runs.push(next.animate([{ transform: `translate3d(${-PARALLAX * w}px,0,0)` }, { transform: 'none' }], opts));
    }
    Promise.all(runs.map((r) => r.finished)).catch(() => {}).finally(cleanup);
  };
  requestAnimationFrame(begin);
}
/** A new step: keep the screen being left (for Back), and slide the new one in over it. */
function leaving(from: number, next: Screen) {
  if (from < 0) { kept.clear(); abort(); stopSwap(); return; }
  if (!phone()) return;
  if (phase !== 'idle') abort();
  const screen = currentScreen(), entry = screenEntry();
  // A dialog or sheet on top of the same screen is not a new screen: nothing to keep or slide.
  if (!screen || !entry || next.layer || entry.layer) return;
  // An incognito conversation (the one being left, not the next) is never kept, not even for the slide.
  if (screen.matches('.app > .main') && entry.currentId && isTemporaryChat({ id: entry.currentId })) { kept.delete(from); return; }
  const k = keep(screen, entry);
  kept.set(from, k);
  for (const id of [...kept.keys()].slice(0, Math.max(0, kept.size - KEEP))) kept.delete(id);
  if (motionOff() || swapControl.skip || !userAction()) return;
  // A place chosen in the drawer replaces the screen: the drawer closes over it, with no push slide underneath.
  if (document.querySelector('.sidebar.open, .cv-nav.open')) return;
  slide('push', mount(k, Z.top), screenFor(next));
}
/** Before history restores a screen (called by the history adapter, so order never depends on listeners): an app Back,
 * a tap, slides like the gesture; the browser's own Back does not, since Safari animates it itself. */
function popping(app: boolean) {
  if (phase === 'commit') return;
  if (phase !== 'idle') { abort(); return; }
  stopSwap();
  if (!phone() || motionOff() || !app) return;
  const screen = currentScreen(), entry = screenEntry();
  // Closing a dialog or sheet is that presentation's own exit, not a screen pop.
  if (!screen || !entry || entry.layer) return;
  const ghost = mount(keep(screen, entry), Z.top);
  requestAnimationFrame(() => { const now = screenEntry(); if (now?.layer) { ghost.remove(); return; } slide('pop', ghost, now ? screenFor(now) : '.app > .main'); });
}
function popped() { if (phase === 'commit') arrived(); }

export function installNavigation() {
  if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return () => {};
  // The drawer's gesture runs after Back's at every touch (window capture first), and yields while Back owns it.
  const stopDrawer = installSidebarGestures();
  onScreenLeave(leaving);
  painted = useStore.getState();
  const unsubscribe = useStore.subscribe(notePaint);
  const opts = { capture: true } as const;
  window.addEventListener('touchstart', start, { capture: true, passive: true });
  window.addEventListener('touchmove', move, { capture: true, passive: false });
  window.addEventListener('touchend', end, { capture: true, passive: false });
  window.addEventListener('touchcancel', end, opts);
  window.addEventListener('click', click, opts);
  onScreenPop({ before: popping, after: popped });
  window.addEventListener('resize', abort);
  window.addEventListener('pagehide', abort);
  return () => {
    stopDrawer(); reset(); stopSwap(); kept.clear(); unsubscribe(); cancelAnimationFrame(paintFrame); paintFrame = 0;
    onScreenLeave(null);
    window.removeEventListener('touchstart', start, opts);
    window.removeEventListener('touchmove', move, opts);
    window.removeEventListener('touchend', end, opts);
    window.removeEventListener('touchcancel', end, opts);
    window.removeEventListener('click', click, opts);
    onScreenPop(null);
    window.removeEventListener('resize', abort);
    window.removeEventListener('pagehide', abort);
  };
}
