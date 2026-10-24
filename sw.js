/* Service Worker: statische Dateien cachen (Netz zuerst, Cache als Rückfall). /api/ wird nie gecacht. */
const VERSION = 'sb40k-v4-' + '2026-10-24a';
const CORE = ['/index.html', '/manifest.webmanifest', '/css/app.css', '/css/lobby.css', '/css/setup.css', '/css/player.css', '/css/table.css',
  '/js/main.js', '/js/net.js', '/js/ui/components.js', '/js/ui/lobby.js', '/js/ui/setup.js', '/js/ui/setup-steps.js',
  '/js/ui/table.js', '/js/ui/player.js', '/js/ui/player-tabs.js', '/js/ui/player-sheets.js', '/js/ui/player-common.js', '/js/ui/table3d.js', '/css/table3d.css', '/vendor/three.module.min.js', '/data/layouts11.js',
  '/engine/index.js', '/engine/reduce.js', '/engine/derive.js', '/engine/scoring.js', '/engine/stratagems.js', '/engine/geometry.js', '/engine/layoutgen.js', '/data/half-table.js', '/js/ui/random-layout.js', '/js/ui/sequence.js', '/engine/rng.js',
  '/data/rules.js', '/data/core.js', '/data/terrain.js', '/data/factions/index.js', '/data/factions/seed.js', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.allSettled(CORE.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            // Fonts etc. überlässt der Browser sich selbst
  if (url.pathname.startsWith('/api/')) return;           // Spielstand nie cachen (SSE, Aktionen)
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('/index.html') : undefined))));
});
