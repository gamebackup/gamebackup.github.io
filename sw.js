// ================================================================
//  x3e unblocked games — Service Worker
//  Caches gamebackup.github.io resources for offline play.
//  Place this file at the ROOT of your repo: /sw.js
// ================================================================

const CACHE_NAME = 'x3e-offline-v1';

// ── Lifecycle ────────────────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

// ── Fetch handler ────────────────────────────────────────────────
// Only intercept GET requests to gamebackup.github.io.
// Strategy: cache-first with background network refresh.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.includes('gamebackup.github.io')) return;

  e.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(e.request).then(cached => {
        // Always attempt a fresh network fetch in the background
        const networkFetch = fetch(e.request)
          .then(res => {
            if (res && res.ok) cache.put(e.request, res.clone());
            return res;
          })
          .catch(() => null);

        // Return cache hit immediately, fall back to network
        return cached || networkFetch;
      })
    ).catch(() => caches.match(e.request))
  );
});

// ── Message handler ──────────────────────────────────────────────
self.addEventListener('message', e => {
  if (!e.data || !e.source) return;

  // Main page asking: "what URLs are in the cache?"
  if (e.data.type === 'GET_CACHED_URLS') {
    caches.open(CACHE_NAME)
      .then(c => c.keys())
      .then(keys =>
        e.source.postMessage({
          type: 'CACHED_URLS',
          urls: keys.map(r => r.url)
        })
      );
  }

  // Main page asking: "delete everything for this game path"
  if (e.data.type === 'CLEAR_GAME' && e.data.prefix) {
    caches.open(CACHE_NAME).then(c =>
      c.keys().then(keys =>
        Promise.all(
          keys
            .filter(r => r.url.startsWith(e.data.prefix))
            .map(r => c.delete(r))
        )
      )
    );
  }
});
