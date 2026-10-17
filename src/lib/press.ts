// One bounded press language for glass and solid controls. The action stays under the finger;
// scrolling, cancellation and releasing outside always remove the feedback.
const BUTTONS = [
  '.btn', '.icon-btn', '.tool-btn', '.send-btn', '.sidebar-chip', '.model-button', '.to-bottom',
  '.hub-close', '.composer-chip', '.project-topbar-pill', 'button.tool-card',
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
  if (!held || e.pointerId !== held.id) return;
  if (Math.hypot(e.clientX - held.x, e.clientY - held.y) > 12) release();
}

export function initPress(): void {
  if (initialized) return;
  initialized = true;
  document.addEventListener('touchstart', () => {}, { passive: true });
  document.addEventListener('pointerdown', down, { passive: true });
  document.addEventListener('pointermove', move, { passive: true });
  for (const type of ['pointerup', 'pointercancel', 'dragstart', 'blur'] as const) window.addEventListener(type, release, { passive: true });
  document.addEventListener('scroll', event => {
    // Streaming can scroll the conversation while a composer control is held. Only a scroll
    // of the pressed control's own container should cancel its feedback.
    if (held && (event.target === document || (event.target instanceof Node && event.target.contains(held.el)))) release();
  }, { capture: true, passive: true });
  document.addEventListener('visibilitychange', release);
}
