const CACHE_NAME = 'overtime-pwa-cache-v7.0.0'; // Resilient Offline Edition
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  // Add external dependencies for true offline capability
  'https://unpkg.com/jalali-moment/dist/jalali-moment.browser.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700&display=swap',
  'https://www.iranalumina.ir/Files/HeaderLogo.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Opened cache and caching all assets');
      // Use addAll which is atomic, if one fails, all fail.
      return cache.addAll(urlsToCache).catch(error => {
          console.error('Failed to cache one or more resources:', error);
          // This prevents the service worker from installing if it can't cache a crucial resource.
      });
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => cacheName !== CACHE_NAME)
                  .map(cacheName => {
                      console.log('Deleting old cache:', cacheName);
                      return caches.delete(cacheName);
                  })
      );
    }).then(() => {
        console.log('Service worker activated and old caches cleared.');
        return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
    // Network-first strategy for all GET requests.
    // This ensures users get the latest content, with a fallback to cache.
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // If the fetch is successful, clone it and cache it.
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
                return caches.match(event.request).then(cachedResponse => {
                    return cachedResponse || Response.error(); // Or a custom offline page
                });
            })
    );
});
