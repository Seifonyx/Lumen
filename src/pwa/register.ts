// Registers the service worker and reports when a new version is ready.

let applying = false;

/** Calls `onUpdate(apply)` when a new version has been downloaded; `apply()` switches to it. */
export function registerServiceWorker(onUpdate: (apply: () => void) => void) {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const start = async () => {
    let reg: ServiceWorkerRegistration;
    try {
      reg = await navigator.serviceWorker.register('/sw.js');
    } catch {
      return; // e.g. private browsing; the app still works online
    }
    if (!reg) return; // some browsers resolve without a registration when workers are blocked
    const offer = (worker: ServiceWorker) =>
      onUpdate(() => {
        applying = true;
        worker.postMessage('SKIP_WAITING');
      });
    // A new version was already waiting from an earlier visit.
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        // With no controller this is the first install, not an update.
        if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker);
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (applying) location.reload();
    });
    // Look for new versions every 30 minutes and whenever the app comes back to the front.
    const check = () => void reg.update().catch(() => {});
    setInterval(check, 30 * 60_000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
  };
  if (document.readyState === 'complete') void start();
  else window.addEventListener('load', () => void start(), { once: true });
}
