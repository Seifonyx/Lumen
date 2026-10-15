// Like Messages: with the keyboard open, drag the conversation down and the keyboard goes away when you lift
// your finger (what you typed stays). It waits for the lift so the scroll in progress isn't interrupted: you
// can drag down and back up in one go. Touch screens only.
const PULL = 36; // px of downward drag that dismisses

export function installKeyboardDismiss(): () => void {
  let start: { y: number; id: number; last: number } | null = null;
  const typing = () => {
    const el = document.activeElement;
    return el instanceof HTMLTextAreaElement && Boolean(el.closest('.composer')) ? el : null;
  };
  const down = (e: TouchEvent) => {
    start = null;
    if (e.touches.length !== 1 || !typing() || !(e.target instanceof Element) || !e.target.closest('.messages, .main.is-empty')) return;
    start = { y: e.touches[0].clientY, id: e.touches[0].identifier, last: e.touches[0].clientY };
  };
  const move = (e: TouchEvent) => {
    const t = start && [...e.touches].find((x) => x.identifier === start!.id);
    if (t && start) start.last = t.clientY;
  };
  const up = (e: TouchEvent) => {
    const s = start;
    start = null;
    if (!s || e.type === 'touchcancel') return;
    const t = [...e.changedTouches].find((x) => x.identifier === s.id);
    const y = t ? t.clientY : s.last;
    // Ended lower than it started (and far enough): the keyboard goes.
    if (y - s.y > PULL) typing()?.blur();
  };
  document.addEventListener('touchstart', down, { passive: true });
  document.addEventListener('touchmove', move, { passive: true });
  document.addEventListener('touchend', up, { passive: true });
  document.addEventListener('touchcancel', up, { passive: true });
  return () => {
    document.removeEventListener('touchstart', down);
    document.removeEventListener('touchmove', move);
    document.removeEventListener('touchend', up);
    document.removeEventListener('touchcancel', up);
  };
}
