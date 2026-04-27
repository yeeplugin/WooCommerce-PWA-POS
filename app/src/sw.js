import { syncOrders } from './utils/syncEngine';

const CACHE_NAME = 'yeepos-cache-v2';
const APP_SHELL_KEY = 'yeepos-app-shell';

/**
 * BACKGROUND SYNC - Primary feature
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'yeepos-sync-orders') {
    console.log('[YeePOS SW] Background Sync Triggered: yeepos-sync-orders');
    event.waitUntil(syncOrders());
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'yeepos-periodic-sync-orders') {
    event.waitUntil(syncOrders());
  }
});

// Install & Activate
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.pathname.includes('/wp-json/')) return;
  if (!(url.protocol === 'http:' || url.protocol === 'https:')) return;

  // === NAVIGATION (HTML page) ===
  // Network-first: try network, cache the response, fallback to cached app shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the POS HTML page for offline use
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(APP_SHELL_KEY, copy);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline: serve the cached app shell
          return caches.open(CACHE_NAME).then((cache) => cache.match(APP_SHELL_KEY));
        })
    );
    return;
  }

  // === IMAGES: Cache-First ===
  if (
    request.destination === 'image' ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        }).catch(() => new Response('', { status: 408 }));
      })
    );
    return;
  }

  // === JS / CSS / FONTS: Stale-While-Revalidate ===
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    url.pathname.match(/\.(js|css|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        }).catch(() => {});

        return cached || fetchPromise;
      })
    );
    return;
  }
});
