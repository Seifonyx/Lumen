// iPhone glass look: pressing a glass button feels like iOS 26. Under your finger the button swells, a soft
// light gathers where you touch, and if you drag, it leans and stretches after your finger like a drop of
// liquid; let go and it springs back with a little overshoot. Done by touch (not CSS :active, which Safari only
// applies to some taps), and only with transform-like properties so it stays on the graphics thread.
// List rows and cards don't swell: rows get the grey press highlight and cards sink slightly (glass.css).

const BUTTONS = [
  '.btn', '.icon-btn', '.tool-btn', '.send-btn', '.sidebar-chip', '.model-button', '.to-bottom',
  '.hub-close', '.composer-chip', '.project-topbar-pill',
].join(', ');
// Inside these, a button is part of a list or menu row, which highlights instead of swelling.
const NOT_IN = '.menu, .ctx-menu, .sheet-row, .chat-row, .mp-item, .mp-layout, .settings-tabs, .msg-actions';

const SWELL = 'cubic-bezier(0.2, 1.4, 0.4, 1)';
const SETTLE = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

let held: { el: HTMLElement; x: number; y: number; glow: HTMLElement; w: number; h: number; big: number; restore: string } | null = null;

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function down(e: PointerEvent) {
  if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || !document.documentElement.classList.contains('glass')) return;
  const el = (e.target as Element | null)?.closest<HTMLElement>(BUTTONS);
  if (!el || el.closest(NOT_IN) || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return;
  release();
  const r = el.getBoundingClientRect();
  // Small buttons swell more than wide ones, so the bulge looks the same size under a finger.
  const big = reduced() ? 1.04 : Math.min(1.22, 1 + 9 / Math.max(24, Math.min(r.width, r.height)) + 0.02);
  const restore = el.style.position;
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  const glow = document.createElement('span');
  glow.className = 'press-glow';
  glow.setAttribute('aria-hidden', 'true');
  el.append(glow);
  held = { el, x: e.clientX, y: e.clientY, glow, w: r.width, h: r.height, big, restore };
  light(e.clientX - r.left, e.clientY - r.top);
  el.style.transition = `scale 0.42s ${SWELL}, translate 0.42s ${SWELL}, filter 0.2s`;
  el.style.scale = String(big);
  el.style.filter = 'brightness(1.07) saturate(1.15)';
  el.classList.add('is-pressed');
}

function light(x: number, y: number) {
  if (!held) return;
  held.glow.style.setProperty('--px', `${x}px`);
  held.glow.style.setProperty('--py', `${y}px`);
}

function move(e: PointerEvent) {
  if (!held || !e.isPrimary || reduced()) return;
  const dx = e.clientX - held.x, dy = e.clientY - held.y;
  // Far off the button, it lets go (and the tap won't count, as on iOS).
  if (Math.hypot(dx, dy) > Math.max(70, held.w)) { release(); return; }
  // Rubber band: follows the finger at first, then less and less.
  const lean = (d: number, size: number) => 12 * Math.tanh(d / (size * 0.9 + 30));
  const ox = lean(dx, held.w), oy = lean(dy, held.h);
  const stretch = Math.min(0.08, Math.hypot(ox, oy) / 150);
  const along = Math.abs(ox) >= Math.abs(oy);
  held.el.style.transition = 'scale 0.18s ease-out, translate 0.12s ease-out, filter 0.2s';
  held.el.style.translate = `${ox}px ${oy}px`;
  held.el.style.scale = `${held.big + (along ? stretch : -stretch / 2)} ${held.big + (along ? -stretch / 2 : stretch)}`;
  const r = held.el.getBoundingClientRect();
  light(e.clientX - r.left, e.clientY - r.top);
}

function release() {
  if (!held) return;
  const { el, glow, restore } = held;
  held = null;
  el.classList.remove('is-pressed');
  el.style.transition = `scale 0.62s ${SETTLE}, translate 0.62s ${SETTLE}, filter 0.3s`;
  el.style.scale = '';
  el.style.translate = '';
  el.style.filter = '';
  glow.style.opacity = '0';
  setTimeout(() => {
    glow.remove();
    if (!el.classList.contains('is-pressed')) { el.style.transition = ''; el.style.position = restore; }
  }, 650);
}

/** Turns the press feel on (once, at start). Also makes Safari show :active on taps (it needs a touch listener). */
export function initPress(): void {
  document.addEventListener('touchstart', () => {}, { passive: true });
  document.addEventListener('pointerdown', down, { passive: true });
  document.addEventListener('pointermove', move, { passive: true });
  for (const type of ['pointerup', 'pointercancel', 'dragstart', 'blur'] as const) window.addEventListener(type, release, { passive: true });
  document.addEventListener('scroll', release, { capture: true, passive: true });
}
