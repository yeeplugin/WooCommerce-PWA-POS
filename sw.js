const CACHE_NAME = 'yeepos-cache-v1';
const ASSETS_TO_CACHE = [
  './index.php?yeepos_app=1',
  './wp-content/plugins/yeepos/app/dist/assets/main.js',
  './wp-content/plugins/yeepos/app/dist/assets/main.css',
  './wp-content/plugins/yeepos/app/dist/assets/material-icons-outlined-latin-400-normal.woff2',
  './wp-content/plugins/yeepos/app/dist/assets/material-icons-outlined-latin-400-normal.woff',
  './yeepos-manifest.json'
];

// Install Event: Cache app shell with error handling
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[YeePOS SW] Caching app shell assets');
      // We use map to avoid one failure blocking the whole installation
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => cache.add(url).catch(err => console.warn(`[YeePOS SW] Failed to cache: ${url}`, err)))
      );
    })
  );
  self.skipWaiting();
});

// Activate Event: Cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[YeePOS SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Smart Caching Strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(event.request.url);

  if (request.method !== 'GET') {
    return;
  }

  // Handle Navigation Requests (The POS URL itself)
  if (request.mode === 'navigate' || (url.pathname.endsWith('/pos') || url.pathname.endsWith('/pos/'))) {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('./index.php?yeepos_app=1');
      })
    );
    return;
  }

  if (!(url.protocol === 'http:' || url.protocol === 'https:')) {
    return;
  }

  // 1. Skip API calls - we want fresh data or IndexedDB handle
  if (url.pathname.includes('/wp-json/')) {
    return;
  }

  // 2. Cache-First for Images (Products)
  if (
    request.destination === 'image' ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cacheCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, cacheCopy);
            });
          }
          return networkResponse;
        }).catch(() => {});
      })
    );
    return;
  }

  // 3. Stale-While-Revalidate for other assets (CSS, JS, Fonts)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, cacheCopy);
          });
        }
        return networkResponse;
      }).catch(() => {});

      return cachedResponse || fetchPromise;
    })
  );
});
