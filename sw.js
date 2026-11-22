/* «Тю і Шо глянемо» — офлайн: сторінки беремо з мережі, а без неї — з кешу; картинки кешуємо. */
const V = 'tyuisho-v15';
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

/* push-сповіщення про нові серії */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: 'Тю і Шо глянемо', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Нова серія', { body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: d.tag || undefined, data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const w = list.find(c => c.url.startsWith(self.registration.scope));
    if (w) return w.navigate(url).then(c => (c || w).focus());
    return clients.openWindow(url);
  }));
});
