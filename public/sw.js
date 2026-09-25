/* Only a public offline message is cached. Journal pages, APIs and credentials
   always go to the network and are never copied into Cache Storage. */
const CACHE = 'jayananda-pwa-v1';
// Cloudflare serves offline.html at its canonical extensionless URL.
const OFFLINE_PAGE = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_PAGE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('jayananda-pwa-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    request.mode !== 'navigate' ||
    url.origin !== self.location.origin ||
    url.pathname === '/api' ||
    url.pathname.startsWith('/api/')
  )
    return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (
        (await cache.match(OFFLINE_PAGE)) ||
        new Response('You are offline. Reconnect to open your journal.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
        })
      );
    }),
  );
});
