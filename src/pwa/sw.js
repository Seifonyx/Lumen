// Service worker: keeps a copy of the app on the device so it opens without a connection, and installs new versions in
// the background. A new version waits: the browser hands over once no window runs the old one (Lumen closed or ended
// by iOS, then opened again), or when someone chooses Update in Settings (src/pwa/register.ts); an open app is never
// switched under the person using it.
// The version and file list below are filled in at build time (see vite.config.ts).

const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `model-router-${VERSION}`;
const PYTHON_CACHE = 'model-router-python-0.26.4';
// Which version's files were in use before this one took over (kept for windows still running it; see activate).
const META = 'lumen-sw-meta';
const ACTIVE = '/__lumen-active-cache';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE);
        await cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })));
      } catch (error) {
        // A half-stored version (no connection, storage full) is removed; the running version stays as it is and the
        // next check tries again.
        await caches.delete(CACHE).catch(() => {});
        throw error;
      }
    })(),
  );
  // No skipWaiting here: an open app switches only when it is safe (register.ts).
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // A window still running the previous version may yet ask for one of its own lazily loaded files, which the
      // server no longer has once a new release is deployed: that version's files stay one more release. Older ones,
      // and versions that waited but never ran, are removed.
      const meta = await caches.open(META);
      const others = (await caches.keys()).filter((key) => key.startsWith('model-router-') && key !== CACHE && key !== PYTHON_CACHE);
      // (Before the first version that records itself, the newest other copy is taken to be the previous version.)
      const previous = (await (await meta.match(ACTIVE))?.text()) ?? others.at(-1);
      for (const key of others) if (key !== previous) await caches.delete(key);
      if (previous !== CACHE) await meta.put(ACTIVE, new Response(CACHE));
      await self.clients.claim();
    })(),
  );
});

// A waiting version takes over when told to (Update in Settings, src/pwa/register.ts).
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
  // This version's own copy first; a file it doesn't have (a lazily loaded part of the previous version, asked for by a
  // window still running it) from the copy kept for it; then the network.
  event.respondWith((async () => (await (await caches.open(CACHE)).match(req, { ignoreSearch: true }))
    || (await caches.match(req, { ignoreSearch: true }))
    || fetch(req))());
});
