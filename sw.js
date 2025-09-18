const CACHE_NAME = 'overtime-pwa-cache-v5.0.0'; // Final stable version
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
  // We are no longer caching external CDN assets to ensure stability.
  // The browser will handle caching for tailwind, fonts, moment, etc.
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Force the new service worker to activate immediately.
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Opened cache for core assets');
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('activate', event => {
  // This event fires when the new service worker takes control.
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          // Delete all old caches that are not our current one.
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          console.log('Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      console.log('Service worker activated and old caches cleared.');
      return self.clients.claim(); // Take control of all open pages.
    })
  );
});

self.addEventListener('fetch', event => {
    // We only handle GET requests for our core assets.
    if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // Cache-first strategy for core app shell.
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // If we have a match in the cache, return it.
                if (cachedResponse) {
                    return cachedResponse;
                }
                // Otherwise, fetch from the network.
                return fetch(event.request).then(networkResponse => {
                    // And cache the new response for next time.
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
            .catch(error => {
                console.error('Fetching failed:', error);
                // This could be a fallback page if needed, but for now, we just log.
            })
    );
});
