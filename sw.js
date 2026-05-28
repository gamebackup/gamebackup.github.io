const CACHE_NAME = 'x3e-offline-v2';
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

// ── Fetch handler ────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // During a preload session, cache everything (any origin)
  if (preloadSession) {
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        fetch(e.request).then(res => {
          if (validCached(res)) cache.put(e.request, res.clone());
          return res;
        }).catch(() => caches.match(e.request).then(r => validCached(r) ? r : null))
      )
    );
    return;
  }

  // Normal operation – only cache gamebackup.github.io
  if (!e.request.url.includes('gamebackup.github.io')) return;

  e.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(e.request).then(cached => {
        if (cached && !validCached(cached)) {
          cache.delete(e.request);
          cached = null;
        }
        const networkFetch = fetch(e.request).then(res => {
          if (validCached(res)) cache.put(e.request, res.clone());
          return res;
        }).catch(() => null);
        return cached || networkFetch;
      })
    ).catch(() => fetch(e.request))
  );
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
  if (e.data.type === 'GET_CACHED_URLS' && e.source) {
    caches.open(CACHE_NAME)
      .then(c => c.keys())
      .then(keys => e.source.postMessage({
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
