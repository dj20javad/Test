const CACHE_NAME = 'overtime-pwa-cache-v9.0.0'; // Stable V2 with Persian Datepicker
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
  // We will NOT cache external resources. 
  // The browser will handle them. This is the key to stability.
];

// Install the service worker and cache the app shell.
self.addEventListener('install', event => {
  self.skipWaiting(); // Activate worker immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('Failed to cache app shell:', err);
      })
  );
});

// Clean up old caches when the new service worker activates.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
        console.log('Service worker activated and old caches cleared.');
        return self.clients.claim(); // Take control of all open pages immediately.
    })
  );
});

// Serve cached content when offline.
self.addEventListener('fetch', event => {
  // We only handle requests for our own app (local origin).
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          // If the resource is in the cache, return it.
          if (cachedResponse) {
            return cachedResponse;
          }
          // Otherwise, fetch it from the network.
          // We don't cache it here. The browser handles external resources.
          return fetch(event.request);
        })
    );
  }
  // For all other requests (CDNs, etc.), do nothing and let the browser handle it normally.
});
