const CACHE_NAME = 'x3e-offline-v5';
let preloadSession = false;

// Keep this in sync with X3E_PROXY_ORIGIN in index.html, otherwise offline
// caching ignores everything the proxy serves. Empty string = disabled.
const X3E_PROXY_ORIGIN = '';

// The origins whose responses belong in the offline cache.
function isX3eUrl(url) {
  // Same origin as this worker: the live site, and also local previews
  // (127.0.0.1 / localhost) where the hostname is not gamebackup.github.io.
  if (url.startsWith(self.location.origin + '/')) return true;
  if (url.includes('gamebackup.github.io')) return true;
  if (!X3E_PROXY_ORIGIN) return false;
  return url.startsWith(X3E_PROXY_ORIGIN.replace(/\/+$/, '') + '/');
}

// Keep this in sync with X3E_MIRRORS in index.html. Between an activated preload
// session, a filtered game is cached under a mirror rather than its own URL, so
// these hosts are served back from the cache when we have them.
const X3E_MIRROR_HOSTS = [
  'cdn.jsdelivr.net',
  'fastly.jsdelivr.net',
  'gcore.jsdelivr.net',
  'quantil.jsdelivr.net',
  'originfastly.jsdelivr.net',
  'testingcf.jsdelivr.net',
  'cdn.statically.io',
  'raw.githack.com',
  'rawcdn.githack.com'
];

function hostOf(url) {
  try { return new URL(url).hostname; } catch (e) { return ''; }
}
function isMirrorUrl(url) { return X3E_MIRROR_HOSTS.includes(hostOf(url)); }

/* A cancelled mirror probe must still settle respondWith(), otherwise the
   browser logs "a ServiceWorker passed a promise ... that rejected" for what is
   an intentional abort by the winning host. */
function mirrorUnavailable() {
  return new Response('', { status: 504, statusText: 'Mirror unavailable' });
}

/* A CLEAR_GAME request is only honoured for prefixes that really belong to a game:
   the real origin, the configured proxy, or a known mirror host. */
function isSafeClearPrefix(prefix) {
  if (typeof prefix !== 'string' || !prefix.startsWith('https://')) return false;
  if (prefix.startsWith('https://gamebackup.github.io/') && prefix !== 'https://gamebackup.github.io/') return true;
  if (X3E_PROXY_ORIGIN && prefix.startsWith(X3E_PROXY_ORIGIN.replace(/\/+$/, '') + '/')) return true;
  if (!X3E_MIRROR_HOSTS.includes(hostOf(prefix))) return false;
  return new URL(prefix).pathname.length > 1;
}

/* ── Cross-origin isolation ───────────────────────────────────────
   GitHub Pages cannot send response headers, so this worker stamps the two
   that make a document crossOriginIsolated onto every same-origin response it
   serves: that is what gives the 3DS emulator access to SharedArrayBuffer.
   A nested document only counts as isolated when it carries COEP itself, not
   just its parent, so the overlay iframe needs this too. credentialless (not
   require-corp) keeps cross-origin images, scripts and iframes working
   without CORP headers; they are simply fetched without credentials. */
function withCoi(response) {
  if (!response || response.status === 0 || response.type === 'opaque') return response;
  const headers = new Headers(response.headers);
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

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
  // 'basic' = same-origin, 'cors' = a CORS read of a mirror/proxy origin. Both
  // are real, readable responses. Opaque responses have status 0 and are still
  // rejected, so a failed cross-origin load is never cached as a game.
  return res && res.ok && res.status !== 0 && (res.type === 'basic' || res.type === 'cors');
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
    return withCoi(res);
  } catch (err) {
    const cached = await cache.match(request);
    if (cached && validCached(cached)) return withCoi(cached);
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
    return withCoi(cached);
  }
  return networkFirst(request);
}

// ── Fetch handler ────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  /*
     Poptropica mirrors call two legacy endpoints with a leading slash, so they land
     on the site root rather than beside the game: /getPrefix.php (POST) tells the
     client which base to resolve every asset against, and when it fails the client
     falls back to "/" and then asks for /framework/data/config.xml, which does not
     exist at the root either. GitHub Pages answers a POST with 405 and the file with
     404, and no folder-scoped worker can reach either path - this root worker is the
     only place they can be answered.
  */
  const rootPath = new URL(e.request.url).pathname;

  if (rootPath === '/getPrefix.php') {
    // Empty rather than ".": the client concatenates this onto paths such as
    // "images//flags/flag-index.txt", where a leading dot produces ".images/...".
    e.respondWith(new Response('prefix=', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    }));
    return;
  }

  if (e.request.method !== 'GET') return;

  // During a preload session, fetch everything fresh from the network and
  // cache it for offline use (any origin).
  if (preloadSession) {
    e.respondWith(
      networkFirst(e.request).catch(err => {
        // Same intentional cancellation as below: a mirror probe is aborted as
        // soon as another host wins, so answer it instead of rejecting.
        if (isMirrorUrl(e.request.url)) return mirrorUnavailable();
        throw err;
      })
    );
    return;
  }

  // Normal operation – only the x3e origins. Mirror responses are also served
  // back from the cache when it holds them (so a game preloaded through a mirror
  // still runs offline), but are otherwise left completely alone, so ordinary
  // CDN traffic is never intercepted or written to the cache here.
  if (!isX3eUrl(e.request.url)) {
    if (isMirrorUrl(e.request.url)) {
      e.respondWith(
        caches.open(CACHE_NAME).then(cache =>
          cache.match(e.request).then(hit => {
            if (hit && validCached(hit)) return hit;
            // A mirror probe can be cancelled the moment another host wins.
            // Returning a failed response keeps respondWith() from rejecting and
            // filling the console with a network error for an intentional cancel.
            return fetch(e.request).catch(mirrorUnavailable);
          })
        )
      );
    }
    return;
  }

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

    if (isSafeClearPrefix(prefix)) {
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