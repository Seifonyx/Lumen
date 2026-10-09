// Service worker: keeps a copy of the app on the device so it opens without a connection, and
// installs new versions in the background (the app then offers "Reload" to switch).
// The version and file list below are filled in at build time (see vite.config.ts).

const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `model-router-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })))),
  );
  // No skipWaiting here: an open app switches only when you choose "Reload".
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('model-router-') && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only the app's own files; AI providers, Firebase and Google sign-in go straight to the network.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/__/')) return;
  if (req.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then((c) => c.match('/')).then((hit) => hit || fetch(req)));
    return;
  }
  event.respondWith(caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true })).then((hit) => hit || fetch(req)));
});
