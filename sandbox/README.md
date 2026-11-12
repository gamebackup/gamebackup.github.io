# x3e sandbox

A byte-for-byte copy of the site (`index.html`, `style.css`, `sw.js`, `coi-boot.js`,
the static pages and `images/`), created to try experiments without touching the
live site.

It is deliberately small: `.git`, `.freebuff` and `proxy/` docs are the only things
left out, and `proxy/` is copied as-is.

## What was changed, and why

Only these things differ from the real site, all of them so the copy cannot fight it:

| Change | Where | Reason |
| --- | --- | --- |
| `register('/sandbox/sw.js', { scope: '/sandbox/' })` | `index.html` | The live worker is registered at `/sw.js` with scope `/`. Two workers cannot control the same page, and a root-scoped worker would otherwise capture sandbox requests into its own cache. |
| `CACHE_NAME = 'x3e-sandbox-offline'` | `sw.js` | A separate, *stable* cache bucket: sandbox experiments never touch the live cache, and preloaded games survive a rebuild. Staleness is handled by content hashing, not by throwing the cache away. |
| `localStorage` keys renamed `x3e-*` → `x3e-sb-*` | `index.html` | `localStorage` is shared per origin; the cached-games list, mirror dead-host list and theme would otherwise leak between live and sandbox. |
| preloader hold `3000–7000ms` → `0` | `index.html` | The random hold is the only per-request randomness on the site and it makes every test run slow and non-deterministic. |
| preload flag persisted as a cache sentinel | `sw.js` | The flag used to be a plain variable, which resets when the browser terminates an idle worker — the rest of a game's files were then fetched uncached while the UI reported success. |
| navigation requests are network-first | `sw.js` | With hashed assets a stale HTML shell would point at files that no longer exist after a deploy. |
| block-page detection + failure panel | `index.html` | A filter's block page is served with HTTP 200, so the mirror race used to treat it as the game and inject it into the frame. It is now rejected, and the user gets an honest message. |

`<link rel="stylesheet">` also points at `/sandbox/style.css` instead of
`https://gamebackup.github.io/style.css`, so stylesheet edits in the sandbox
actually show up.

## Block-page detection

`x3eLooksLikeBlockPage(html)` rejects a candidate whose document contains no
`<script>`, `<canvas>` or `<iframe>`. Real games run code; filter block pages —
FortiGuard/Fortinet and Securly included — are static HTML. It deliberately uses
no size heuristic and matches no vendor wording, so a small single-file game is
still accepted and an unseen filter still gets caught.

When every host is filtered, `x3eShowFailurePanel()` draws x3e's own panel inside
the existing game overlay (the one that already carries `← Back to x3e`) with the
reason, plus **Try again**, **Open directly** and **Back to x3e**. It explains what
happened instead of covering the browser's error with a blank screen: a certificate
error is diagnostic information and stays visible.

It does **not** make a blocked game playable — blocked bytes are still blocked.
The only lever there is which hostname the game comes from.

## Content-hashed build

`build-assets.mjs` implements option B: every local asset is copied under a name
that carries a hash of its own contents, and every reference is rewritten to
match, so a changed file always gets a new URL and caches never serve stale CSS
or images.

```sh
node build-assets.mjs            # -> sandbox/dist/ (git-ignored)
```

- Hashed: `style.css`, `coi-boot.js`, `favicon.ico`, everything in `images/`.
- Not hashed: `sw.js` — a service worker's URL is its scope, so it keeps its
  name, and its cache name is deliberately stable (`x3e-sandbox-offline`). That
  is the point of hashing: preloaded games survive a deploy because the cache no
  longer has to be thrown away to avoid stale files. The HTML shell is
  network-first so a new build is picked up on the first load; hashed assets stay
  cache-first because their URL changes when their content does.
- Untouched: remote URLs on `cdn.jsdelivr.net`. Those are not local files and
  rewriting them would break the icons.
- Rewrites are anchored to whole attribute values (`href="style.css"`) and
  `url()` calls. A bare substring replace would also hit `el.style.cssText` and
  silently break the page — that happened once during development; the build
  now avoids it.
- Deterministic: same inputs produce the same file names, so unchanged assets
  keep their URLs across deploys and stay cached.

## Run it

```sh
python3 -m http.server 8000 --bind 127.0.0.1
# then open http://localhost:8000/sandbox/dist/
```

`localhost` counts as a secure context, so the service worker and offline
preloading work there exactly as they do on the real site.

## What this copy can and cannot test

Can test, purely in the browser:

- whether offline preloading actually caches a game (open Settings → Offline Play,
  pick a game, then reload with the network disabled in devtools)
- cache partitioning / eviction behaviour of `sw.js`
- deep links, the overlay, mirror failover, the cloak presets
- block-page rejection and the failure panel (stub `window.fetch` to return a
  filter-style block page — see the tests run during development)
- client-side experiments: renamed classes/IDs, cache-busting query strings on
  assets, hashed asset paths generated at runtime

Cannot test: anything that needs a different response per request from the server.
GitHub Pages serves static files and has no server-side rewriting, so a scheme
where every request gets fresh identifiers and asset paths requires an actual
rewriting origin (the `proxy/worker.js` pattern — a Worker in front of the files).
That is a deployment decision, not something this folder can demonstrate.
