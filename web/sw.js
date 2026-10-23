const CACHE = 'cyanwrite-shell-v1.2.4-review-r1';
const ASSETS = ['./', './index.html', './style.css', './app.js', './check-policy.js', './ai.js', './native-ai.js', './engine.js', './highlights.js', './structure.js', './learning.js', './icon.svg', './manifest.webmanifest', './vendor/xlsx.full.min.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('cyanwrite-shell-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (!ASSETS.some(asset => new URL(asset, self.registration.scope).pathname === url.pathname)) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then(cached => cached || Response.error())));
});
