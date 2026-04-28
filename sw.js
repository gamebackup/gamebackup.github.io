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
if (e.data.type === 'CLEAR_GAME' && e.data.prefix) {
  const prefix = e.data.prefix;
  // Only purge if the prefix is a game sub‑path, not the root of the site
  if (prefix.startsWith('https://gamebackup.github.io/') && prefix !== 'https://gamebackup.github.io/') {
    caches.open(CACHE_NAME).then(c =>
      c.keys().then(keys =>
        Promise.all(
          keys
            .filter(r => r.url.startsWith(prefix))
            .map(r => c.delete(r))
        )
      )
    );
  } else {
    console.warn('[SW] Ignoring unsafe CLEAR_GAME prefix:', prefix);
  }
}
});
