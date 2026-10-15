// A short tap you can feel when a gesture commits something (a sheet snaps shut, a swipe goes through, a long
// press opens a menu, a switch flips, a message is sent). Android browsers vibrate. iPhone Safari has no
// vibration API, but flipping a native switch control plays its system tick (Safari 18+), so that is used there.
import { useStore } from '../store';

let tick: HTMLLabelElement | null = null;
const apple = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

export function haptic(kind: 'light' | 'medium' | 'success' = 'light') {
  if (useStore.getState().settings.haptics === false) return;
  try {
    if (typeof navigator.vibrate === 'function') { navigator.vibrate(kind === 'light' ? 8 : kind === 'medium' ? 14 : [8, 50, 10]); return; }
    if (!apple()) return;
    if (!tick?.isConnected) {
      tick = document.createElement('label');
      tick.className = 'haptic-switch';
      tick.setAttribute('aria-hidden', 'true');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      tick.append(input);
      tick.addEventListener('click', (e) => e.stopPropagation());
      document.body.append(tick);
    }
    tick.click();
  } catch { /* no haptics here */ }
}
