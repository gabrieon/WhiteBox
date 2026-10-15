// WhiteBox service worker — installability and offline shell only.
//
// This worker makes the site installable and keeps the already-visited shell
// usable offline. It never tries to be a full offline games platform: game
// chunks are cached after first use, but progress and publishing still need the
// network, and pretending otherwise would corrupt saves.
//
// Version the cache name on every meaningful change to this file. There is no
// update UI, so an old worker must age itself out rather than wait for the
// player to notice.
const CACHE_VERSION = 'whitebox-shell-v1';
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
      if (response && response.ok) {
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
      if (response && response.ok) {
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
