// Content-hashed asset build for the x3e sandbox.
// Emits dist/ where every local asset carries a hash of its own contents, and
// rewrites every reference to match. Deterministic: same inputs, same names.
//
// Rewrites are anchored to whole attribute values / url() calls, never bare
// substrings: `style.css` also occurs inside `el.style.cssText`, and a naive
// replace corrupts live JavaScript.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(SRC, 'dist');

const h8 = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 8);
const rename = (rel, h) => {
  const ext = path.extname(rel);
  return rel.slice(0, rel.length - ext.length) + '.' + h + ext;
};

async function walk(dir, base = '') {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) out.push(...await walk(path.join(dir, e.name), rel));
    else out.push(rel);
  }
  return out;
}

const map = new Map();   // original relative path -> hashed relative path
const files = new Map(); // hashed relative path -> Buffer

// 1. Static assets first: images, favicon, coi-boot.js
const images = (await walk(path.join(SRC, 'images'))).map((p) => 'images/' + p);
for (const rel of [...images, 'favicon.ico', 'coi-boot.js']) {
  let buf;
  try { buf = await readFile(path.join(SRC, rel)); } catch { console.warn('missing, skipped:', rel); continue; }
  const target = rename(rel, h8(buf));
  map.set(rel, target);
  files.set(target, buf);
}

// 2. CSS: rewrite local url() references, then hash the rewritten content.
//    Remote urls (jsDelivr) are left exactly as they are.
let css = await readFile(path.join(SRC, 'style.css'), 'utf8');
css = css.replace(/url\((['"]?)(images\/[^)'"]+)\1\)/g, (m, q, p) => map.has(p) ? `url(${q}${map.get(p)}${q})` : m);
map.set('style.css', rename('style.css', h8(css)));
files.set(map.get('style.css'), Buffer.from(css));

// 3. HTML: rewrite whole attribute values only.
const htmlFiles = (await readdir(SRC, { withFileTypes: true }))
  .filter((e) => e.isFile() && e.name.endsWith('.html'))
  .map((e) => e.name);

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const page of htmlFiles) {
  let html = await readFile(path.join(SRC, page), 'utf8');
  const attr = (from, to) => {
    if (!to) return;
    html = html.split('="' + from + '"').join('="' + to + '"');
  };
  attr('/sandbox/style.css', map.get('style.css'));
  attr('style.css', map.get('style.css'));
  attr('coi-boot.js', map.get('coi-boot.js'));
  attr('favicon.ico', map.get('favicon.ico'));
  for (const [from, to] of map) if (from.startsWith('images/')) attr(from, to);
  // The service worker keeps its own name (its URL is its scope); only its path
  // and scope move, from /sandbox/ to wherever dist/ is served.
  html = html.replace("register('/sandbox/sw.js', { scope: '/sandbox/' })", "register('sw.js', { scope: './' })");
  await writeFile(path.join(OUT, page), html);
}

// 4. Emit assets under their hashed names
for (const [rel, buf] of files) {
  const dest = path.join(OUT, rel);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buf);
}

// 5. sw.js is copied verbatim. Its cache name stays stable on purpose, so
//    preloaded games survive a deploy: staleness is impossible because the
//    assets themselves get new names when their contents change.
const stamp = h8(await readFile(path.join(OUT, 'index.html')));
await writeFile(path.join(OUT, 'sw.js'), await readFile(path.join(SRC, 'sw.js')));

console.log('build ' + stamp + ' -> ' + OUT);
for (const [from, to] of map) console.log('  ' + from.padEnd(42) + to);
console.log('  ' + 'sw.js'.padEnd(42) + 'sw.js (cache: x3e-sandbox-offline, unchanged)');
