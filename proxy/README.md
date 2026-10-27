# x3e game proxy

`worker.js` re-serves the x3e game files from a hostname you control, so the
games keep loading when `gamebackup.github.io` (or jsDelivr) is filtered.

It is a one-to-one pass-through:

```
https://<your-host>/standalone_games/2048/     ->  https://gamebackup.github.io/standalone_games/2048/
https://<your-host>/flash_games/games/btd1/    ->  https://gamebackup.github.io/flash_games/games/btd1/
```

So the games' relative *and* root-relative asset paths keep resolving, and no
HTML rewriting is needed. If the real origin is unreachable or missing a file,
the proxy falls back to jsDelivr. The upstream host is hard-coded, so this is
not an open proxy.

The same file runs on Cloudflare Workers, Deno Deploy and Vercel edge
functions, because they all accept a `fetch(request)` handler.

---

## Read this first: the hostname is the whole problem

The proxy only helps if **its own hostname is not categorized/blocked**. Shared
platform subdomains — `*.workers.dev`, `*.deno.dev`, `*.vercel.app`,
`*.netlify.app` — are used by thousands of sites doing exactly this, so filters
usually categorize them wholesale, and they can change under you because you
don't control them.

**A domain you own (~$10/year) pointed at any of these platforms is the only
durable answer.** Deploying to a platform default and hoping is a coin flip.
Test from the actual filtered network, not from home.

---

## Deploy

### Deno Deploy (no Cloudflare account needed)

1. Push this repo to GitHub.
2. In the [Deno Deploy](https://dash.deno.com) dashboard, create a project and
   connect the repo.
3. Set the entrypoint to `proxy/worker.js`. It auto-detects the default export.
4. Add your custom domain under the project's Domains settings.

Or from the CLI:

```sh
deployctl deploy --project=<your-project> proxy/worker.js
```

### Cloudflare Workers

```sh
npx wrangler deploy proxy/wrangler.toml
```

Then add a custom domain: Workers → your worker → Settings → Domains & Routes.
The `*.workers.dev` hostname is commonly filtered on its own.

### Vercel / Netlify

Both can run this, but they need a thin wrapper so the `fetch`-style handler is
detected. On Vercel, add `api/[[...path]].js`:

```js
export const config = { runtime: 'edge' };
export { default } from '../../proxy/worker.js';
```

On Netlify, put a wrapper in `netlify/edge-functions/proxy.js` and route it with
`export default (request, context) => handler(request, context);` plus a
`[[path]]` entry in `netlify.toml`.

---

## Verify it works

Locally, against the real upstream (6 checks, including a simulated filter block
to prove the jsDelivr fallback engages):

```sh
node proxy/smoke-test.mjs
```

After deploying, from the filtered network:

```sh
curl -i https://<your-host>/
# -> "x3e game proxy is running."

curl -sI https://<your-host>/standalone_games/2048/
# -> HTTP/2 200, content-type: text/html
```

A 200 here from a *filtered* connection is the only result that means anything.

---

## Wire it into the site

Set the same value in **two** places — clicking a game has to route through the
proxy, and offline caching has to accept the proxied responses:

1. `X3E_PROXY_ORIGIN` in **index.html** (in the `── Mirror failover ──` block).
2. `X3E_PROXY_ORIGIN` in **sw.js** (at the top).

Use just the origin, no trailing slash or path:

```js
const X3E_PROXY_ORIGIN = 'https://x3e.example.com';
```

Leave it as `''` to disable the proxy. The proxy is tried second, right after a
quick probe of the real origin, and it is remembered as the winner once it
serves a game — so a filtered origin only costs one short probe per session.

`finalproduct-v2.html` does **not** need to change: it fetches `index.html` at
runtime, so existing users pick the new config up automatically.
