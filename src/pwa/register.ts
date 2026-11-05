// Registers the service worker and moves Lumen to a new version only when that cannot disturb anyone.
//
// A new version downloads in the background and waits (sw.js). It is used:
//  - when Lumen next starts after no window was left running the old version (the app closed, or iOS ended it in the
//    background): the browser hands over by itself;
//  - when someone chooses Update in Settings (`apply`, after src/lib/update-safety.ts has checked nothing would be lost).
// Nothing reloads because the app was hidden, came back, started, or another window updated. No banner: `onUpdate` only
// tells the app that an update can be applied, for Settings to offer. (Taking a waiting version over while Lumen starts
// was tried and left out: Chromium holds the handover until the starting page is closed, so it could not be made
// dependable, and a version that waits is used at the next start anyway.)

let reloading = false;
const reload = () => { if (reloading) return; reloading = true; location.reload(); };

/** Calls `onUpdate(apply)` once when a newer version is ready for this window; `apply()` switches to it (once). */
export function registerServiceWorker(onUpdate: (apply: () => void) => void) {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const sw = navigator.serviceWorker;
  // The version this window started with. A change of controller later means another window (or Lumen starting) moved
  // to a new version: this window keeps running what it loaded, and offers to reload.
  const startedWith = sw.controller;
  let reg: ServiceWorkerRegistration | null = null;
  let applying = false, offered = false;

  // Switches to the new version: a waiting one is told to take over, and the reload follows once it has (never before,
  // or the old version would load again). If it stops waiting first (a newer one replaced it), the newest is asked; if
  // none waits, another window already switched and this one just loads it.
  const apply = () => {
    if (reloading) return;
    applying = true;
    const waiting = reg?.waiting;
    if (!waiting) { reload(); return; }
    waiting.addEventListener('statechange', () => { if (waiting.state === 'redundant' && !reloading) apply(); });
    waiting.postMessage('SKIP_WAITING');
  };
  const offer = () => { if (offered) return; offered = true; onUpdate(apply); };

  sw.addEventListener('controllerchange', () => {
    if (applying) reload();
    else if (startedWith) offer(); // (no controller at first: the first install, not an update)
  });

  const start = async () => {
    try {
      reg = await sw.register('/sw.js');
    } catch {
      return; // e.g. private browsing; the app still works online
    }
    if (!reg) return; // some browsers resolve without a registration when workers are blocked
    // A version already waiting from an earlier visit (another window kept the old one running).
    if (reg.waiting && sw.controller) offer();
    reg.addEventListener('updatefound', () => {
      const worker = reg!.installing;
      worker?.addEventListener('statechange', () => {
        // With no controller this is the first install, not an update. A version that fails to install becomes
        // redundant and is never offered.
        if (worker.state === 'installed' && sw.controller) offer();
      });
    });
    // Look for new versions every 30 minutes and whenever the app comes back to the front. A failed check (offline)
    // changes nothing.
    const check = () => { if (!reloading) void reg!.update().catch(() => {}); };
    setInterval(check, 30 * 60_000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
  };
  if (document.readyState === 'complete') void start();
  else window.addEventListener('load', () => void start(), { once: true });
}
