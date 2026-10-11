import { isIOS } from './device';

/**
 * iOS Safari can pan the visual viewport to keep a focused input visible while the keyboard opens.
 * Follow late keyboard pans as well as resizes. Defer offset changes during a finger drag to
 * keep scrolling stable, then reconcile when the gesture finishes.
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
  let touching = false;

  const isEditableFocused = (): boolean => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return false;
    return active.isContentEditable ||
      active.matches('input, textarea, select, [contenteditable="true"]');
  };

  const apply = () => {
    frame = 0;
    // Pinch zoom also shrinks visualViewport; it isn't a keyboard.
    if (Math.abs(vv.scale - 1) > 0.05) return;
    const keyboard = layoutHeight - vv.height > 120;

    if (keyboard) {
      root.style.setProperty('--vv-h', `${vv.height}px`);
      if (!touching || !keyboardOpen) root.style.setProperty('--vv-top', `${vv.offsetTop}px`);
    }

    if (keyboard !== keyboardOpen) {
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

  // Keep the composer from panning Safari's page, while allowing settings, dialogs and other
  // scrollable panels to scroll with the keyboard open.
  const preventPageScroll = (event: TouchEvent) => {
    if (!keyboardOpen || !(event.target instanceof Element)) return;
    if (event.target.closest('.messages')) return;
    if (!event.target.closest('.composer')) {
      for (let element: Element | null = event.target; element && element !== document.body; element = element.parentElement) {
        if (element.matches('textarea, [contenteditable="true"]')) return;
        const style = getComputedStyle(element);
        if ((/^(auto|scroll)$/.test(style.overflowY) && element.scrollHeight > element.clientHeight) ||
            (/^(auto|scroll)$/.test(style.overflowX) && element.scrollWidth > element.clientWidth)) return;
      }
    }
    event.preventDefault();
  };

  vv.addEventListener('resize', schedule);
  vv.addEventListener('scroll', schedule);
  document.addEventListener('touchstart', () => { touching = true; }, { passive: true });
  const endTouch = (event: TouchEvent) => {
    touching = event.touches.length > 0;
    if (!touching) schedule();
  };
  document.addEventListener('touchend', endTouch, { passive: true });
  document.addEventListener('touchcancel', endTouch, { passive: true });
  window.addEventListener('pageshow', schedule);
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', () => {
    window.setTimeout(() => {
      layoutHeight = root.clientHeight;
      schedule();
    }, 250);
  });
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', () => {
    schedule();
    window.setTimeout(schedule, 350);
  });
  document.addEventListener('touchmove', preventPageScroll, { passive: false });
}
