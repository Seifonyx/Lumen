import { isIOS } from './device';

/**
 * iOS Safari can pan the visual viewport to keep a focused input visible while the keyboard opens.
 * Keep the app aligned to the visible viewport without following every scroll-offset change: updating
 * the app's top position during a finger drag makes the whole interface jitter.
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
    const keyboard = layoutHeight - vv.height > 120;

    if (keyboard) {
      // The height follows keyboard animation, but freeze top offset once open. iOS changes
      // offsetTop during touch drags; following it makes the topbar flicker under the finger.
      root.style.setProperty('--vv-h', `${vv.height}px`);
      if (!keyboardOpen) root.style.setProperty('--vv-top', `${vv.offsetTop}px`);
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
  // Deliberately don't follow visualViewport scroll events: they are often caused by finger drags.
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
