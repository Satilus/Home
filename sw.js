/* «Тю і Шо» — офлайн: сторінки беремо з мережі, а без неї — з кешу; картинки кешуємо. */
const V = 'tyuisho-v10';
const SHELL = ['./', 'index.html', 'kino.html', 'phrases.js', 'shared.js', 'glass.css', 'motion.js', 'manifest.webmanifest', 'icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== V + '-img').map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); return res; }).catch(() => caches.match(r, { ignoreSearch: true })));
  } else if (r.destination === 'image') {
    /* спершу мережа, кеш — лише без інтернету (щоб не застрягали зламані картинки) */
    e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(V + '-img').then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r)));
  }
});
