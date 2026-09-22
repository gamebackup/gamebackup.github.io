const CACHE_NAME = 'x3e-offline-v3';
let preloadSession = false;

// ── Lifecycle ────────────────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      ),
      caches.open(CACHE_NAME).then(cache =>
        cache.keys().then(requests =>
          Promise.all(requests.map(req =>
            cache.match(req).then(res => {
              if (!res || res.status === 0) return cache.delete(req);
            })
          ))
        )
      )
    ])
  );
});

function validCached(res) {
  return res && res.ok && res.status !== 0 && res.type === 'basic';
}

// Network-first: always fetch the latest from the network, and refresh the
// cache copy. Only fall back to the cache when the network is unavailable
// (e.g. offline play of a preloaded game). Used for the emulator runtime and
// core blobs, so that updated cores are always picked up instead of being
// served stale forever.
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(request);
    if (validCached(res)) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached && validCached(cached)) return cached;
    throw err;
  }
}

// Cache-first: serve the cached copy immediately (fast, offline-capable) and
// update the cache copy from the network in the background.
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached && !validCached(cached)) {
    await cache.delete(request);
    return networkFirst(request);
  }
  if (cached && validCached(cached)) {
    networkFirst(request).catch(() => {});
    return cached;
  }
  return networkFirst(request);
}

// ── Fetch handler ────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // During a preload session, fetch everything fresh from the network and
  // cache it for offline use (any origin).
  if (preloadSession) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  // Normal operation – only cache gamebackup.github.io
  if (!e.request.url.includes('gamebackup.github.io')) return;

  // Emulator runtime + core files must always revalidate so that updated
  // cores (e.g. picodrive-wasm.data) never get pinned to an old, broken copy.
  if (e.request.url.includes('/emulatorjs/')) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  // Everything else: cache-first for preloaded offline games.
  e.respondWith(cacheFirst(e.request));
});

// ── Message handler ──────────────────────────────────────────────
self.addEventListener('message', e => {
  if (!e.data) return;

  // Enable / disable preload session
  if (e.data.type === 'START_SESSION') {
    preloadSession = true;
    console.log('[SW] Preload session started – caching all requests');
    return;
  }
  if (e.data.type === 'STOP_SESSION') {
    preloadSession = false;
    console.log('[SW] Preload session stopped');
    return;
  }

  // Existing commands
  if (e.data.type === 'GET_CACHED_URLS') {
    const target = (e.ports && e.ports.length) ? e.ports[0] : e.source;
    if (!target) return;
    caches.open(CACHE_NAME)
      .then(c => c.keys())
      .then(keys => target.postMessage({
        type: 'CACHED_URLS',
        urls: keys.map(r => r.url)
      })).catch(() => {});
  }

  if (e.data.type === 'CLEAR_GAME' && e.data.prefix) {
    const prefix = e.data.prefix;
    const port = e.ports ? e.ports[0] : null;
    const respond = () => { if (port) port.postMessage('done'); };

    if (prefix.startsWith('https://gamebackup.github.io/') && prefix !== 'https://gamebackup.github.io/') {
      caches.open(CACHE_NAME).then(c =>
        c.keys().then(keys =>
          Promise.all(
            keys.filter(r => r.url.startsWith(prefix)).map(r => c.delete(r))
          )
        )
      ).then(respond).catch(respond);
    } else {
      console.warn('[SW] Ignoring unsafe CLEAR_GAME prefix:', prefix);
      respond();
    }
  }
});