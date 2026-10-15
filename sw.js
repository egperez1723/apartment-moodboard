// Service worker: makes the app installable and lets it open offline.
// Network-first so updates always show up; the cache is only a fallback.
const CACHE = 'hq-shell-v1';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'store.js', 'shared.js', 'chrome.js', 'lists.js',
  'moodboard.js', 'course.js', 'costumes.js', 'budget.js', 'icon.png', 'manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if(req.method !== 'GET' || url.origin !== location.origin) return;   // leave Firebase/fonts alone
  e.respondWith(fetch(req).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy));
    return res;
  }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
});
