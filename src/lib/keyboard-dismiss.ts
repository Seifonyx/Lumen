// Like Messages: with the keyboard open, drag the conversation down and the keyboard goes away (the
// message box keeps what you typed). Touch screens only; scrolling up through the chat is unchanged.
const PULL = 36; // px of downward drag that dismisses

export function installKeyboardDismiss(): () => void {
  let start: { y: number; id: number } | null = null;
  const typing = () => {
    const el = document.activeElement;
    return el instanceof HTMLTextAreaElement && Boolean(el.closest('.composer')) ? el : null;
  };
  const down = (e: TouchEvent) => {
    start = null;
    if (e.touches.length !== 1 || !typing() || !(e.target instanceof Element) || !e.target.closest('.messages')) return;
    start = { y: e.touches[0].clientY, id: e.touches[0].identifier };
  };
  const move = (e: TouchEvent) => {
    if (!start) return;
    const t = [...e.touches].find((x) => x.identifier === start!.id);
    if (!t) return;
    if (t.clientY - start.y > PULL) { typing()?.blur(); start = null; }
    else if (start.y - t.clientY > 12) start = null; // scrolling the other way
  };
  const up = () => { start = null; };
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
