import assert from 'node:assert/strict';

const realFetch = globalThis.fetch;
const worker = (await import('./worker.js')).default;
const req = p => new Request('https://proxy.test' + p, { method: 'GET' });

// 1. health page
const home = await worker.fetch(req('/'), {}, {});
assert.equal(home.status, 200);
assert.match(await home.text(), /x3e game proxy is running/);
console.log('ok 1: health page');

// 2. real pass-through
const game = await worker.fetch(req('/standalone_games/2048/'), {}, {});
const ct = game.headers.get('content-type') || '';
const body = await game.text();
assert.equal(game.status, 200);
assert.match(ct, /text\/html/);
assert.ok(body.length > 200, 'expected a real HTML body, got ' + body.length);
assert.equal(game.headers.get('access-control-allow-origin'), '*');
console.log('ok 2: pass-through', game.status, ct, body.length, 'bytes');

// 3. a game that is a single .html file, not a directory
const fileGame = await worker.fetch(req('/standalone_games/hk/hollow%20knight.html'), {}, {});
console.log('ok 3: file game', fileGame.status, fileGame.headers.get('content-type'));
assert.equal(fileGame.status, 200);

// 4. jsDelivr fallback when the real origin is blocked
let sawJsdelivr = false;
globalThis.fetch = async (input, init) => {
  const u = typeof input === 'string' ? input : input.url;
  if (u.startsWith('https://gamebackup.github.io')) throw new Error('simulated filter block');
  if (u.startsWith('https://cdn.jsdelivr.net')) sawJsdelivr = true;
  return realFetch(input, init);
};
const fb = await worker.fetch(req('/standalone_games/2048/'), {}, {});
const fbBody = await fb.text();
globalThis.fetch = realFetch;
assert.ok(sawJsdelivr, 'fallback should have consulted jsDelivr');
assert.equal(fb.status, 200);
assert.ok(fbBody.length > 200, 'fallback body too short: ' + fbBody.length);
console.log('ok 4: jsDelivr fallback', fb.status, fbBody.length, 'bytes');

// 5. an unknown path still fails rather than inventing content
const missing = await worker.fetch(req('/definitely-not-a-repo/nope/'), {}, {});
assert.ok([403, 404].includes(missing.status), 'expected 403/404, got ' + missing.status);
console.log('ok 5: unknown path ->', missing.status);

// 6. upstream total failure -> 502, not a crash
globalThis.fetch = async () => null;
const dead = await worker.fetch(req('/standalone_games/2048/'), {}, {});
globalThis.fetch = realFetch;
assert.equal(dead.status, 502);
console.log('ok 6: upstream down ->', dead.status);

console.log('\nall proxy checks passed');
