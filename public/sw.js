// WhiteBox service worker — installability and offline shell only.
//
// This worker makes the site installable and keeps the already-visited shell
// usable offline. It never tries to be a full offline games platform: game
// chunks are cached after first use, but progress and publishing still need the
// network, and pretending otherwise would corrupt saves.
//
// Version the cache name on every meaningful change to this file. There is no
// update UI, so an old worker must age itself out rather than wait for the
// player to notice. v2 exists because v1 cached an SPA-fallback HTML page
// under a hashed CSS URL during a deploy window — cacheFirst stored the 200
// HTML response as if it were the stylesheet, and every later load reused it.
const CACHE_VERSION = 'whitebox-shell-v2';
const APP_SHELL = [
  '/',
  '/site.webmanifest',
  '/favicon.svg',
  '/logo.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((response) => {
      // Only cache clean, complete responses. Opaque or error responses would
      // poison the cache with something the player cannot inspect.
      //
      // And never cache HTML under an asset URL: during a deploy window the
      // SPA fallback can answer a hashed-asset request with index.html (still
      // HTTP 200), and storing that poisons every later load with an
      // unstyled — or blank — page that no server-side fix can reach.
      const contentType = response?.headers.get('Content-Type') || '';
      if (response && response.ok && !contentType.includes('text/html')) {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
      }
      return response;
    });
  });
}

function networkFirst(request, fallback) {
  return fetch(request)
    .then((response) => {
      // Same poison rule as cacheFirst, except a navigation legitimately IS
      // an HTML document. A stable-name file that answers with HTML is the
      // SPA fallback talking, not the file.
      const contentType = response?.headers.get('Content-Type') || '';
      const htmlExpected = request.mode === 'navigate';
      if (response && response.ok && (htmlExpected || !contentType.includes('text/html'))) {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(fallback, copy));
      }
      return response;
    })
    .catch(() => caches.match(fallback));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Hashed build output is immutable by construction: cache it aggressively
  // after first use and never revalidate.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Every navigation is the SPA shell (the hash route never reaches the
  // server). Prefer the network so deploys land immediately, and fall back to
  // the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/'));
    return;
  }

  // Stable-name public files: network first so a replaced icon or manifest
  // wins, cache second so they still resolve offline.
  event.respondWith(networkFirst(request, request));
});
