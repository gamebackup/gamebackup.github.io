/**
 * x3e game proxy.
 *
 * Re-serves the x3e game files from a hostname you control, so the games keep
 * loading when gamebackup.github.io (or jsDelivr) is filtered.
 *
 * It is a path-preserving pass-through: /<repo>/<path> maps to
 * https://gamebackup.github.io/<repo>/<path>, with a jsDelivr fallback when the
 * real origin is unreachable or missing the file. Root-relative asset paths
 * inside the games keep working, because the proxy root is the github.io root.
 *
 * The upstream host is hard-coded, so this is not an open proxy.
 *
 * The same file runs on Cloudflare Workers, Deno Deploy and Vercel edge
 * functions — they all accept a `fetch(request)` handler.
 */

const PRIMARY_ORIGIN = 'https://gamebackup.github.io';
const JSDELIVR = 'https://cdn.jsdelivr.net/gh/gamebackup/';
const TIMEOUT_MS = 20000;
const CACHE_TTL = 3600; // seconds, used only when upstream sends no cache-control

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, OPTIONS',
  'access-control-allow-headers': '*'
};

// Headers that must not survive the hop: they either break framing or would
// bind a cookie to this hostname instead of the game's real origin.
const STRIP = [
  'content-disposition',
  'x-frame-options',
  'content-security-policy',
  'set-cookie',
  'set-cookie2'
];

const HOME = [
  'x3e game proxy is running.',
  '',
  'It mirrors https://gamebackup.github.io/ one-to-one, for example:',
  '  /standalone_games/2048/  ->  https://gamebackup.github.io/standalone_games/2048/',
  '',
  'To use it, set X3E_PROXY_ORIGIN in index.html AND in sw.js to this origin.',
  ''
].join('\n');

/** Map a proxy path onto the equivalent jsDelivr URL (which needs index.html). */
function jsDelivrFor(pathname) {
  const parts = pathname.replace(/^\/+/, '').split('/');
  const repo = parts.shift();
  if (!repo || !/^[A-Za-z0-9._-]+$/.test(repo)) return null;
  let rest = parts.join('/');
  if (rest === '' || rest.endsWith('/')) rest += 'index.html';
  return JSDELIVR + repo + '@main/' + rest;
}

/** Fetch upstream, returning null instead of throwing on timeout/network error. */
async function tryFetch(url, method) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      method,
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'x3e-proxy' }
    });
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function handler(request, env, ctx) {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed\n', { status: 405, headers: CORS });
  }
  if (url.pathname === '/' || url.pathname === '') {
    return new Response(HOME, {
      status: 200,
      headers: { ...CORS, 'content-type': 'text/plain; charset=utf-8' }
    });
  }

  // Edge cache. Only Cloudflare provides caches.default; elsewhere this is null
  // and the proxy simply streams from upstream every time.
  const cache = (typeof caches !== 'undefined' && caches.default) ? caches.default : null;
  if (cache && request.method === 'GET') {
    const hit = await cache.match(request);
    if (hit) return hit;
  }

  let upstream = await tryFetch(PRIMARY_ORIGIN + url.pathname + url.search, request.method);
  if (!upstream || !upstream.ok) {
    const alt = jsDelivrFor(url.pathname);
    if (alt) {
      const altRes = await tryFetch(alt + url.search, request.method);
      if (altRes && altRes.ok) upstream = altRes;
    }
  }
  if (!upstream) return new Response('Upstream unreachable\n', { status: 502, headers: CORS });

  const headers = new Headers();
  headers.set('content-type', upstream.headers.get('content-type') || 'application/octet-stream');
  headers.set('cache-control', upstream.headers.get('cache-control') || `public, max-age=${CACHE_TTL}`);
  for (const h of STRIP) headers.delete(h); // we never copy them; explicit for clarity
  for (const k in CORS) headers.set(k, CORS[k]);

  const response = new Response(
    request.method === 'HEAD' ? null : upstream.body,
    { status: upstream.status, headers }
  );

  if (cache && request.method === 'GET' && upstream.ok) {
    const put = cache.put(request, response.clone()).catch(() => {});
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(put);
  }
  return response;
}

// Cloudflare Workers wants `export default { fetch }`. Vercel/Deno edge want a
// default-exported function. A function that also carries a `fetch` property
// satisfies both, so this exact file deploys to any of them.
export default Object.assign(handler, { fetch: handler });
