// Service worker: keeps a copy of the app on the device so it opens without a connection, and
// installs new versions in the background (the app then offers "Reload" to switch).
// The version and file list below are filled in at build time (see vite.config.ts).

const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `model-router-${VERSION}`;
const PYTHON_CACHE = 'model-router-python-0.26.4';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })))),
  );
  // No skipWaiting here: an open app switches only when you choose "Reload".
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('model-router-') && key !== CACHE && key !== PYTHON_CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// Push messages (for when a server sends them; Lumen shows them like its own notifications).
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'Lumen', body: event.data?.text() || '' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Lumen', { body: data.body || '', icon: '/icon-192.png', badge: '/icon-192.png', tag: data.chatId || 'lumen', data: { chatId: data.chatId } }));
});

// A tapped task notification brings the app forward on that task's chat.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const chatId = event.notification.data?.chatId;
  event.waitUntil((async () => {
    const open = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).find((c) => new URL(c.url).origin === self.location.origin);
    if (open) { await open.focus(); if (chatId) open.postMessage({ type: 'open-chat', chatId }); return; }
    await self.clients.openWindow(chatId ? `/?openChat=${encodeURIComponent(chatId)}` : '/');
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === 'https://cdn.jsdelivr.net' && url.pathname.startsWith('/pyodide/v0.26.4/full/')) {
    event.respondWith((async () => {
      const cache = await caches.open(PYTHON_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const response = await fetch(req);
      if (response.ok || response.type === 'opaque') {
        // Cache failure (for example device storage pressure) must not prevent an online run.
        await cache.put(req, response.clone()).catch(() => {});
      }
      return response;
    })());
    return;
  }
  // Only the app's own files; AI providers, Firebase and Google sign-in go straight to the network.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/__/')) return;
  // Stand-alone pages (privacy policy, terms) load as themselves, not as the app.
  if (req.mode === 'navigate' && /^\/(privacy|terms)\.html$/.test(url.pathname)) return;
  if (req.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then((c) => c.match('/')).then((hit) => hit || fetch(req)));
    return;
  }
  event.respondWith(caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true })).then((hit) => hit || fetch(req)));
});
