const SHELL_CACHE = 'brewlite-shell-v1';
const API_CACHE = 'brewlite-public-api-v1';
const CURRENT_CACHES = new Set([SHELL_CACHE, API_CACHE]);
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.svg',
  '/icon-512.svg',
];
const PUBLIC_API_PATHS = new Set(['/products', '/pricing/options']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith('brewlite-') && !CURRENT_CACHES.has(key),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.origin === self.location.origin && request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(SHELL_CACHE);
            await cache.put('/', response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match('/');
          return (
            cachedPage ??
            new Response('BrewLite is unavailable offline.', { status: 503 })
          );
        }),
    );
    return;
  }

  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/_next/static/') ||
      url.pathname === '/manifest.webmanifest' ||
      url.pathname === '/icon-192.svg' ||
      url.pathname === '/icon-512.svg')
  ) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (PUBLIC_API_PATHS.has(url.pathname)) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        try {
          const response = await fetch(request);
          if (response.ok && response.type !== 'opaque') {
            await cache.put(request, response.clone());
          }
          return response;
        } catch {
          const cached = await cache.match(request);
          return (
            cached ??
            new Response(
              JSON.stringify({ message: 'BrewLite is offline.' }),
              {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          );
        }
      }),
    );
  }
});
