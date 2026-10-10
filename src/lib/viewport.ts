import { isIOS } from './device';

/**
 * iPhones don't shrink the page when the keyboard opens: they pan it instead, which pushes the top bar
 * out of view and can leave a gap above the keyboard. While the keyboard is up, this pins the app to the
 * visible area (CSS: `html.kb-open .app`). Other browsers already resize the page, so they are untouched.
 */
export function initViewport(): void {
  const vv = window.visualViewport;
  if (!vv || !isIOS()) return;
  const root = document.documentElement;
  let keyboardOpen = false;
  let frame = 0;

  const apply = () => {
    frame = 0;
    const keyboard = window.innerHeight - vv.height > 120;
    if (keyboard) {
      root.style.setProperty('--vv-h', `${vv.height}px`);
      root.style.setProperty('--vv-top', `${vv.offsetTop}px`);
    }
    if (keyboard === keyboardOpen) return;
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
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(apply);
  };
  vv.addEventListener('resize', schedule);
  vv.addEventListener('scroll', schedule);
}
