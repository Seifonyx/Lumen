import { CANVAS_SHELL } from './canvas-presentation';
// One bounded press language for glass and solid controls. The action stays under the finger;
// scrolling, cancellation and releasing outside always remove the feedback.
const BUTTONS = CANVAS_SHELL ? [
  '.btn', '.icon-btn', '.tool-btn', '.send-btn', '.sidebar-chip', '.model-button', '.to-bottom',
  '.hub-close', '.composer-chip', '.project-topbar-pill', '.new-chat', 'button.tool-card',
  // Canvas: its tree's places, New chat and account share the same press.
  '.cv-dest button', '.cv-new-pill', '.cv-account', '.cv-all',
].join(', ') : [
  '.btn', '.icon-btn', '.tool-btn', '.send-btn', '.sidebar-chip', '.model-button', '.to-bottom',
  '.hub-close', '.composer-chip', '.project-topbar-pill', '.new-chat', 'button.tool-card',
].join(', ');
const NOT_IN = '.menu, .ctx-menu, .sheet-row, .chat-row, .mp-item, .mp-layout, .settings-tabs, .msg-actions, .glass-tabbar';
const cleanup = new WeakMap<HTMLElement, number>();
let held: { el: HTMLElement; id: number; x: number; y: number } | null = null;
let initialized = false;

function release() {
  if (!held) return;
  const { el } = held;
  held = null;
  el.classList.remove('is-pressed');
  cleanup.set(el, window.setTimeout(() => {
    el.classList.remove('motion-pressable');
    el.style.removeProperty('--press-scale');
    cleanup.delete(el);
  }, 320));
}

function down(e: PointerEvent) {
  if (!e.isPrimary || e.button !== 0) return;
  if (CANVAS_SHELL && phone()) { touchDown(e); return; }
  const el = (e.target as Element | null)?.closest<HTMLElement>(BUTTONS);
  if (!el || el.closest(NOT_IN) || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return;
  release();
  clearTimeout(cleanup.get(el));
  cleanup.delete(el);
  const r = el.getBoundingClientRect();
  // A wide card compresses less than a small control. No moving hit target or elastic stretching.
  el.style.setProperty('--press-scale', r.width > 120 ? '.985' : '.965');
  held = { el, id: e.pointerId, x: e.clientX, y: e.clientY };
  el.classList.add('motion-pressable', 'is-pressed');
}

function move(e: PointerEvent) {
  if (CANVAS_SHELL && touch) { touchMove(e); return; }
  if (!held || e.pointerId !== held.id) return;
  if (Math.hypot(e.clientX - held.x, e.clientY - held.y) > 12) release();
}

/* ---------- Canvas on phones: iOS 26 touch feedback (owner, 2026-11-05).
 * Every control answers the finger the way its iOS counterpart does, decided by what it looks like, so a new control
 * needs no list entry:
 *  - grow: a control with its own fill or glass (bar buttons, the message box's buttons, pills, chips) swells while
 *    held, leans a little toward the finger, and springs back with a small overshoot when let go;
 *  - row: a full-width list row lights up (after a moment inside a scrolling list, so a scroll never flashes rows;
 *    a quick tap still flashes it), then fades;
 *  - card: a tall tile sinks slightly;
 *  - dim: a plain glyph or text button (reply actions, links, Back) dims.
 * Moving the finger far off a control (or scrolling it) lets go without acting, as in iOS. Styles: canvas-screens.css. */
type Kind = 'grow' | 'lens' | 'row' | 'card' | 'dim';
const TARGET = 'button, a[href], summary, [role="button"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"], [role="tab"], [role="link"]';
let touch: { el: HTMLElement; kind: Kind; id: number; x: number; y: number; at: number; timer: number; shown: boolean } | null = null;
const fades = new WeakMap<HTMLElement, number>();
const phone = () => matchMedia('(max-width: 899px)').matches;

function visible(color: string) {
  const m = color.match(/[\d.]+/g);
  return Boolean(m && (m.length < 4 || Number(m[3]) > 0.02) && color !== 'transparent');
}

function kindOf(el: HTMLElement): Kind {
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  const filled = visible(s.backgroundColor) || (s.backdropFilter && s.backdropFilter !== 'none') || s.backgroundImage !== 'none';
  const wide = r.width >= Math.min(240, innerWidth * 0.6);
  // Menu and list choices light up like rows, however narrow the menu.
  if (el.closest('[role="menu"], [role="listbox"], .menu, .ctx-menu')) return 'row';
  if (wide && r.height > 96) return 'card';
  // A wide control is a list row unless it is a filled pill (a full-width "Continue" button grows like any button).
  if (wide && !(filled && parseFloat(s.borderRadius) >= r.height / 2 - 1)) return 'row';
  if (filled) return 'grow';
  // A bare glyph on a glass bar or in the message box (+, the microphone, a button in the top-right group) gets the
  // lit circle iOS 26 draws under it, and swells with it.
  if (el.closest('.composer, .topbar-trailing, .phone-navigation, .phone-navigation-actions, .glass-tabbar')) return 'lens';
  return 'dim';
}

/** Small controls swell the most; a wide pill only a little, so it never covers what is beside it. */
function growScale(r: DOMRect) {
  const size = Math.max(r.width, r.height);
  return size <= 56 ? 1.15 : size <= 120 ? 1.1 : 1.05;
}

function scrolls(el: HTMLElement) {
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    if (n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) return true;
  }
  return false;
}

function show(t: NonNullable<typeof touch>) {
  t.shown = true;
  clearTimeout(fades.get(t.el));
  t.el.dataset.press = t.kind;
  if (t.kind === 'grow' || t.kind === 'lens') t.el.style.setProperty('--press-scale', String(growScale(t.el.getBoundingClientRect())));
  // A row lights up over its own colour (a row on a card stays on its card).
  if (t.kind === 'row') t.el.style.setProperty('--press-base', getComputedStyle(t.el).backgroundColor);
  t.el.classList.add('is-pressed');
}

function letGo(after = 0) {
  const t = touch;
  if (!t) return;
  touch = null;
  clearTimeout(t.timer);
  const off = () => {
    t.el.classList.remove('is-pressed');
    t.el.style.removeProperty('--press-x');
    t.el.style.removeProperty('--press-y');
    // The attribute stays while the release animates, then goes.
    fades.set(t.el, window.setTimeout(() => { if (!t.el.classList.contains('is-pressed')) { delete t.el.dataset.press; t.el.style.removeProperty('--press-scale'); t.el.style.removeProperty('--press-base'); } }, 600));
  };
  if (after) window.setTimeout(off, after); else off();
}

function touchDown(e: PointerEvent) {
  letGo();
  const el = (e.target as Element | null)?.closest<HTMLElement>(TARGET);
  if (!el || el.matches(':disabled, [aria-disabled="true"], [data-no-press]') || el.closest('[data-no-press]')) return;
  const kind = kindOf(el);
  touch = { el, kind, id: e.pointerId, x: e.clientX, y: e.clientY, at: performance.now(), timer: 0, shown: false };
  // Rows in a scrolling list wait a moment, as iOS does, so starting a scroll never lights them.
  if (kind === 'row' && scrolls(el)) { const t = touch; t.timer = window.setTimeout(() => { if (touch === t) show(t); }, 70); }
  else show(touch);
}

function touchMove(e: PointerEvent) {
  const t = touch;
  if (!t || e.pointerId !== t.id) return;
  const dx = e.clientX - t.x, dy = e.clientY - t.y, far = Math.hypot(dx, dy);
  // A row lets go as soon as the finger travels (that is a scroll); a button follows the finger a little and lets go
  // once it is well off it.
  if (t.kind === 'row' || t.kind === 'card' ? far > 10 : far > 44) { letGo(); return; }
  if ((t.kind === 'grow' || t.kind === 'lens') && t.shown) {
    const lean = (v: number) => Math.max(-4, Math.min(4, v * 0.15));
    t.el.style.setProperty('--press-x', `${lean(dx)}px`);
    t.el.style.setProperty('--press-y', `${lean(dy)}px`);
  }
}

function touchUp(e: Event) {
  const t = touch;
  if (!t) return;
  if (e instanceof PointerEvent && e.pointerId !== t.id) return;
  // A tap quicker than the row's delay still flashes it.
  if (!t.shown && e.type === 'pointerup') { show(t); letGo(110); return; }
  letGo();
}

export function initPress(): void {
  if (initialized) return;
  initialized = true;
  document.addEventListener('touchstart', () => {}, { passive: true });
  document.addEventListener('pointerdown', down, { passive: true });
  document.addEventListener('pointermove', move, { passive: true });
  for (const type of ['pointerup', 'pointercancel', 'dragstart', 'blur'] as const) window.addEventListener(type, (e) => { release(); if (CANVAS_SHELL) touchUp(e); }, { passive: true });
  document.addEventListener('scroll', event => {
    // Streaming can scroll the conversation while a composer control is held. Only a scroll
    // of the pressed control's own container should cancel its feedback.
    if (held && (event.target === document || (event.target instanceof Node && event.target.contains(held.el)))) release();
    if (CANVAS_SHELL && touch && (event.target === document || (event.target instanceof Node && event.target.contains(touch.el)))) letGo();
  }, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { release(); if (CANVAS_SHELL) letGo(); });
}
