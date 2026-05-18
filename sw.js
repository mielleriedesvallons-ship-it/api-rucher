const CACHE_NAME = 'api-rucher-v1';
const URLS_TO_CACHE = [
  './',
  './formulaire_inventaire.html',
  './app.js',
  './manifest.json'
];

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxOBbHJ9exRvwmEluGfT5WfOeXFKfCYxrK8pYofSDYcKlclWvefqOZQA1zwGkpvR7Uszw/exec";

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // API calls go online-first
  if (event.request.url.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.status === 200) {
          const cache = caches.open(CACHE_NAME);
          cache.then((c) => c.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => {
        return caches.match(event.request);
      })
    );
  } 
  // Static assets are cache-first
  else {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((response) => {
          if (response.status === 200) {
            const cache = caches.open(CACHE_NAME);
            cache.then((c) => c.put(event.request, response.clone()));
          }
          return response;
        });
      }).catch(() => {
        return new Response('Offline - Page not available', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain'
          })
        });
      })
    );
  }
});
