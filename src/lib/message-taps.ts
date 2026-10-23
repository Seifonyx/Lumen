// Canvas on touch screens: your own messages keep their actions (Copy, Edit, Branch) folded away until you tap the
// message; tapping anywhere else folds them again. Long-press keeps its menu. Keyboard and VoiceOver focus also
// reveals them, so they are never out of reach.
export function installMessageActionTaps(): () => void {
  if (!window.matchMedia?.('(hover: none)').matches) return () => {};
  const onClick = (e: MouseEvent) => {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('.msg.user .msg-actions')) return;
    const msg = target?.closest('.msg.user') || null;
    document.querySelectorAll('.msg.user[data-actions]').forEach((m) => { if (m !== msg) m.removeAttribute('data-actions'); });
    if (msg && target?.closest('.bubble') && !window.getSelection()?.toString()) msg.toggleAttribute('data-actions');
  };
  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}
