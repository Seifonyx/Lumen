import { isIOS } from './device';

/**
 * iOS Safari can pan the visual viewport to keep a focused input visible while the keyboard opens.
 * Keep the app aligned to that visible viewport so the top bar and composer don't drift off-screen.
 */
export function initViewport(): void {
  const vv = window.visualViewport;
  if (!vv || !isIOS()) return;

  const root = document.documentElement;
  // Capture the layout viewport before the keyboard opens. innerHeight can change during iOS's
  // keyboard animation, so comparing against it on every event can miss the keyboard entirely.
  let layoutHeight = root.clientHeight;
  let keyboardOpen = false;
  let frame = 0;

  const isEditableFocused = (): boolean => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return false;
    return active.isContentEditable ||
      active.matches('input, textarea, select, [contenteditable="true"]');
  };

  const apply = () => {
    frame = 0;
    const heightLoss = layoutHeight - vv.height;
    const keyboard = heightLoss > 120;

    if (keyboard) {
      // Refresh these on both resize and scroll: iOS can pan the visual viewport after focus.
      root.style.setProperty('--vv-h', `${vv.height}px`);
      root.style.setProperty('--vv-top', `${vv.offsetTop}px`);
    }

    if (keyboard !== keyboardOpen) {
      // Keep the newest message in view when the visible area changes size.
      const list = document.querySelector<HTMLElement>('.messages');
      const atBottom = list ? list.scrollHeight - list.scrollTop - list.clientHeight < 80 : false;
      keyboardOpen = keyboard;
      root.classList.toggle('kb-open', keyboard);

      if (!keyboard) {
        root.style.removeProperty('--vv-h');
        root.style.removeProperty('--vv-top');
      }
      if (list && atBottom) requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
    }

    // Refresh the baseline only when the keyboard is closed and focus won't immediately open it.
    if (!keyboardOpen && !isEditableFocused()) {
      layoutHeight = root.clientHeight;
    }
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(apply);
  };

  vv.addEventListener('resize', schedule);
  vv.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', () => {
    // Let iOS finish rotating before recording the new layout viewport size.
    window.setTimeout(() => {
      layoutHeight = root.clientHeight;
      schedule();
    }, 250);
  });
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', () => {
    schedule();
    // Some iOS versions finish dismissing the keyboard after the focus event has fired.
    window.setTimeout(schedule, 350);
  });
}
