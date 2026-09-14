// Minimal Service Worker for Virtual Car Hire Driver Portal PWA installability

const CACHE_NAME = 'vch-portal-cache-v1';
const ASSETS_TO_CACHE = [
  '/portal/login',
  '/portal/signup',
  '/portal/dashboard',
  '/assets/style.css',
  '/assets/app.js',
  '/assets/portal.js',
  '/assets/logo.png',
  '/assets/favicon-32x32.png',
  '/assets/android-chrome-192x192.png',
  '/assets/android-chrome-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Continue install even if optional offline assets fail
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Bypass service worker for cross-origin requests (CDN assets like Font Awesome, Google Fonts, Supabase API calls)
  if (url.origin !== self.location.origin) {
    return;
  }

  // Network first with fallback to cache for same-origin GET requests
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response('Network error', { status: 480, statusText: 'Network Error' });
      })
  );
});
