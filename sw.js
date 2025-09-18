const CACHE_NAME = 'overtime-pwa-cache-v3.0.0'; // Major version bump
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700&display=swap',
  'https://unpkg.com/jalali-moment/dist/jalali-moment.browser.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://www.iranalumina.ir/Files/HeaderLogo.png',
  'https://placehold.co/192x192/4a90e2/ffffff?text=App',
  'https://placehold.co/512x512/4a90e2/ffffff?text=App'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting(); // Force the waiting service worker to become the active service worker.
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => cacheName !== CACHE_NAME)
                  .map(cacheName => caches.delete(cacheName)) // Delete old caches
      );
    })
  );
  return self.clients.claim(); // Become the controller for all clients within its scope.
});

self.addEventListener('fetch', event => {
    // Network first, then cache strategy
    if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // If the fetch is successful, clone the response and cache it.
                if (networkResponse.ok) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // If the network fails, try to serve from the cache.
                return caches.match(event.request)
                    .then(cachedResponse => {
                        return cachedResponse || Response.error(); // Return error if not in cache
                    });
            })
    );
});
