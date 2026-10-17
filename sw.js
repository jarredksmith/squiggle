// Squiggle service worker: keeps the web copy of the game playable offline.
// Bump VERSION whenever index.html changes so phones pick up the update.
const VERSION = 'squiggle-v17';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './fonts/ibm-plex-sans-latin-400-normal.woff2',
  './fonts/ibm-plex-sans-latin-500-normal.woff2',
  './fonts/ibm-plex-sans-latin-600-normal.woff2',
  './fonts/ibm-plex-sans-latin-700-normal.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('squiggle-') && k !== VERSION).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// App shell: serve from cache, refresh in the background. Fonts: cache on first use.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then((hit) => {
        const refresh = fetch(event.request).then((res) => {
          if (res.ok) caches.open(VERSION).then((c) => c.put(event.request, res.clone()));
          return res;
        }).catch(() => hit);
        return hit || refresh;
      })
    );
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.host)) {
    event.respondWith(
      caches.open(VERSION + '-fonts').then((c) => c.match(event.request).then((hit) => hit || fetch(event.request).then((res) => { c.put(event.request, res.clone()); return res; })))
    );
  }
});
