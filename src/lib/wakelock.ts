let sentinel: WakeLockSentinel | null = null;
let wanted = false;

async function acquire(): Promise<void> {
  if (!wanted || sentinel || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
  try {
    const lock = await navigator.wakeLock.request('screen');
    if (!wanted) {
      void lock.release().catch(() => {});
      return;
    }
    sentinel = lock;
    lock.addEventListener('release', () => {
      if (sentinel === lock) sentinel = null;
    });
  } catch {
    // Not allowed right now (low battery, unsupported): the reply simply streams as usual.
  }
}

/**
 * Keeps the screen on while a reply is being written. A phone that locks mid-reply pauses the page and
 * cuts the connection, so the answer would stop halfway.
 */
export function keepScreenAwake(on: boolean): void {
  wanted = on;
  if (on) {
    void acquire();
    return;
  }
  const lock = sentinel;
  sentinel = null;
  if (lock) void lock.release().catch(() => {});
}

// The browser drops the lock when the page is hidden; take it again when the user comes back mid-reply.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void acquire();
});
