// System notifications for scheduled tasks, shown only when the app isn't in front (otherwise a toast is enough).
// On iPhone they need the app added to the Home Screen (iOS 16.4+).

export type NotifyState = 'on' | 'off' | 'blocked' | 'unsupported';

export function notifyState(): NotifyState {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission === 'granted' ? 'on' : Notification.permission === 'denied' ? 'blocked' : 'off';
}

export async function enableNotifications(): Promise<NotifyState> {
  if (typeof Notification === 'undefined') return 'unsupported';
  try { await Notification.requestPermission(); } catch { /* older Safari: callback form only */ }
  return notifyState();
}

/** Shows a notification that opens `chatId` when tapped. Does nothing while the app is in front. */
export async function notify(title: string, body: string, chatId?: string) {
  if (notifyState() !== 'on' || (document.visibilityState === 'visible' && document.hasFocus())) return;
  const options: NotificationOptions = { body: body.slice(0, 180), icon: '/icon-192.png', badge: '/icon-192.png', tag: chatId || title, data: { chatId } };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) { await reg.showNotification(title, options); return; }
    const n = new Notification(title, options);
    n.onclick = () => { window.focus(); if (chatId) window.dispatchEvent(new CustomEvent('mr-open-chat', { detail: chatId })); n.close(); };
  } catch { /* blocked or unsupported here; the toast still shows */ }
}

/** Opens the chat a tapped notification points to (the service worker forwards the tap). Returns a cleanup. */
export function listenForNotificationTaps(open: (chatId: string) => void) {
  const fromPage = (e: Event) => { const id = (e as CustomEvent).detail; if (typeof id === 'string' && id) open(id); };
  const fromWorker = (e: MessageEvent) => { if (e.data?.type === 'open-chat' && typeof e.data.chatId === 'string') open(e.data.chatId); };
  window.addEventListener('mr-open-chat', fromPage);
  navigator.serviceWorker?.addEventListener('message', fromWorker);
  const url = new URL(location.href);
  const fromUrl = url.searchParams.get('openChat');
  if (fromUrl) { url.searchParams.delete('openChat'); history.replaceState(null, '', url.pathname + url.search + url.hash); open(fromUrl); }
  return () => { window.removeEventListener('mr-open-chat', fromPage); navigator.serviceWorker?.removeEventListener('message', fromWorker); };
}
