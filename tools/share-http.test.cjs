// Run only on Box C after building the server. Ephemeral loopback listeners and
// isolated retained data directories; no production process or data is touched.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { createServer } = require('node:http');
const { PNG } = require('pngjs');
const { WebSocket } = require('ws');
const { FIXTURES } = require('../server/dist/shared/derive/fixtures.js');
const { deriveGarden } = require('../server/dist/shared/derive/index.js');
const { LOT_W, LOT_H, TILE } = require('../server/dist/shared/world.js');
const root = path.resolve(__dirname, '..');
async function start(extra = {}) {
  const env = { ...process.env }; for (const key of Object.keys(env)) if (key.startsWith('PONS_')) delete env[key];
  Object.assign(env, { PONS_DATA: mkdtempSync(path.join(tmpdir(), 'pons-share-http-')), PONS_PORT: '0', PONS_HOST: '127.0.0.1',
    PONS_SPRITES: path.join(root, 'client/public/sprites'), ...extra });
  const child = spawn(process.execPath, ['server/dist/server/src/index.js'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; child.stdout.on('data', chunk => { log += chunk; }); child.stderr.on('data', chunk => { log += chunk; });
  const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 22000);
    try { const result = await exited; assert.equal(result.code, 0, log); } finally { clearTimeout(timer); }
  };
  try {
    const until = Date.now() + 15000;
    while (!/pons server :(\d+)/.test(log)) {
      if (child.exitCode !== null || Date.now() > until) throw new Error('Test server startup failed: ' + log);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return { base: `http://127.0.0.1:${log.match(/pons server :(\d+)/)[1]}`, stop };
  } catch (error) { await stop(); throw error; }
}
const get = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
function waitSocket(ws, event, predicate = () => true, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Socket ${event} timeout`)); }, timeout);
    const handler = (...args) => { if (predicate(...args)) { cleanup(); resolve(args); } };
    const cleanup = () => { clearTimeout(timer); ws.off(event, handler); };
    ws.on(event, handler);
  });
}
async function verifyProtocol(base) {
  const hello = { t: 'hello', id: 'wiretest123', secret: 'wiretestsecret123', name: 'Wire tester' };
  let originalSap;
  for (const payload of ['{bad json', 'null', JSON.stringify({ t: 'buy', slot: '__proto__' }), JSON.stringify({ t: 'cosmetic', item: 'constructor' }), JSON.stringify({ t: 'input', x: 'NaN' })]) {
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws');
    ws.on('error', () => {});
    try {
      await waitSocket(ws, 'open');
      const welcome = waitSocket(ws, 'message', raw => JSON.parse(String(raw)).t === 'welcome');
      ws.send(JSON.stringify(hello));
      const state = JSON.parse(String((await welcome)[0])).you;
      originalSap ??= state.sap;
      assert.equal(state.sap, originalSap, 'Invalid intent must not change persisted balance on reconnect');
      const closed = waitSocket(ws, 'close'); ws.send(payload);
      assert.equal((await closed)[0], 1008);
    } finally { ws.terminate(); }
  }
  const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws'); ws.on('error', () => {});
  try {
    await waitSocket(ws, 'open');
    const welcome = waitSocket(ws, 'message', raw => JSON.parse(String(raw)).t === 'welcome');
    ws.send(JSON.stringify(hello));
    const state = JSON.parse(String((await welcome)[0])).you;
    assert.equal(state.sap, originalSap);
    const pong = waitSocket(ws, 'message', raw => JSON.parse(String(raw)).t === 'pong');
    ws.send(JSON.stringify({ t: 'ping', n: 42 })); assert.equal(JSON.parse(String((await pong)[0])).n, 42);
    const correction = waitSocket(ws, 'message', raw => JSON.parse(String(raw)).t === 'correction');
    ws.send(JSON.stringify({ t: 'input', dx: 1, dy: 0, x: 1e9, y: 1e9, d: 'side', f: false, m: true }));
    const corrected = JSON.parse(String((await correction)[0]));
    assert(Number.isFinite(corrected.x) && corrected.x < 1e9);
    assert(Number.isFinite(corrected.y) && corrected.y < 1e9);
    const slot = state.conveyor.slots.findIndex(s => !s.sold && s.price <= state.sap); assert(slot >= 0);
    const purchased = waitSocket(ws, 'message', raw => { const m = JSON.parse(String(raw)); return m.t === 'state' && m.you.conveyor?.slots[slot].sold; });
    ws.send(JSON.stringify({ t: 'buy', slot }));
    const after = JSON.parse(String((await purchased)[0])).you;
    assert.equal(after.sap, state.sap - state.conveyor.slots[slot].price);
    assert.equal(after.seeds.length, state.seeds.length + 1);
  } finally { ws.terminate(); }
  console.log('PASS real WebSocket malformed-message rejection, unchanged balance on reconnect, rejected teleport correction, valid ping and exact purchase');
}
async function verifyLifecycle(base) {
  const url = base.replace('http:', 'ws:') + '/ws';
  const idle = new WebSocket(url), active = new WebSocket(url), premature = new WebSocket(url);
  for (const ws of [idle, active, premature]) ws.on('error', () => {});
  try {
    const idleClosed = waitSocket(idle, 'close', () => true, 25000);
    const prematureClosed = waitSocket(premature, 'close');
    const heartbeat = waitSocket(active, 'ping', () => true, 40000);
    const welcome = waitSocket(active, 'message', raw => JSON.parse(String(raw)).t === 'welcome');
    await Promise.all([waitSocket(idle, 'open'), waitSocket(active, 'open'), waitSocket(premature, 'open')]);
    active.send(JSON.stringify({ t: 'hello', id: 'heartbeat123', secret: 'heartbeatsecret', name: 'Heartbeat tester' }));
    premature.send(JSON.stringify({ t: 'ping', n: 1 }));
    assert.equal((await prematureClosed)[0], 1008);
    await welcome;
    assert.equal((await idleClosed)[0], 1006);
    await heartbeat; // ws automatically responds to protocol pings, like browsers.
    const pong = waitSocket(active, 'message', raw => JSON.parse(String(raw)).t === 'pong');
    active.send(JSON.stringify({ t: 'ping', n: 77 }));
    assert.equal(JSON.parse(String((await pong)[0])).n, 77);
    console.log('PASS real idle-login expiry, pre-login intent rejection and authenticated heartbeat responsiveness');
  } finally { for (const ws of [idle, active, premature]) ws.terminate(); }
}
async function verifyOrigins(base) {
  const url = base.replace('http:', 'ws:') + '/ws';
  for (const origin of ['https://attacker.example', 'null', 'https://prometheus7.com.attacker.example']) {
    const ws = new WebSocket(url, { origin }); ws.on('error', () => {});
    try {
      const [, response] = await waitSocket(ws, 'unexpected-response');
      assert.equal(response.statusCode, 401); response.resume();
    } finally { ws.terminate(); }
  }
  for (const origin of ['https://prometheus7.com', 'http://localhost:8124']) {
    const ws = new WebSocket(url, { origin }); ws.on('error', () => {});
    try { await waitSocket(ws, 'open'); } finally { ws.terminate(); }
  }
  console.log('PASS real upgrade rejects hostile/null origins and permits canonical and loopback-preview origins');
}
async function verifySignupBudget() {
  const service = await start({ PONS_SIGNUP_BURST: '1', PONS_SIGNUP_REFILL_MS: '3600000' });
  const url = service.base.replace('http:', 'ws:') + '/ws';
  const hello = { t: 'hello', id: 'signupone123', secret: 'signupsecret123', name: 'Signup tester' };
  async function connect(message, rejected = false) {
    const ws = new WebSocket(url); ws.on('error', () => {});
    try {
      await waitSocket(ws, 'open');
      const result = rejected ? waitSocket(ws, 'close') : waitSocket(ws, 'message', raw => JSON.parse(String(raw)).t === 'welcome');
      ws.send(JSON.stringify(message));
      const args = await result; if (rejected) assert.equal(args[0], 1013);
    } finally { ws.terminate(); }
  }
  try {
    await connect(hello);
    await connect({ ...hello, id: 'signuptwo123' }, true);
    await connect(hello); // Returning players bypass the exhausted signup budget.
    const health = await get(service.base + '/health');
    assert.equal((await health.json()).players, 1, 'Rejected signup must not create persistent state');
    console.log('PASS signup exhaustion rejects new identities without saving them and permits existing identity reconnect');
  } finally { await service.stop(); }
}
(async () => {
  await verifySignupBudget();
  const service = await start();
  try {
    await verifyOrigins(service.base);
    await verifyProtocol(service.base);
    await verifyLifecycle(service.base);
    const address = FIXTURES[2].snapshot.address, spec = deriveGarden(address, FIXTURES[2].snapshot);
    const response = await get(service.base + '/garden/' + address); assert.equal(response.status, 200);
    const html = await response.text(); assert(html.includes(`${spec.plotCount} plots`)); assert(html.includes(`${spec.rarityFloor} floor`));
    assert(html.includes(`https://prometheus7.com/ponsgarden/garden/${address}.png`));
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    const upper = await get(service.base + '/garden/0x' + address.slice(2).toUpperCase()); assert.equal(await upper.text(), html);
    const pngResponse = await get(service.base + '/garden/' + address + '.png'); assert.equal(pngResponse.headers.get('content-type'), 'image/png');
    const buffer = Buffer.from(await pngResponse.arrayBuffer()), image = PNG.sync.read(buffer);
    assert.equal(image.width, (LOT_W + 4) * TILE * 2); assert.equal(image.height, (LOT_H + 4) * TILE * 2);
    const colors = new Set(); for (let i = 0; i < image.data.length; i += 4) colors.add(image.data.readUInt32BE(i));
    const artifact = path.join(mkdtempSync(path.join(tmpdir(), 'pons-share-render-')), 'garden.png'); writeFileSync(artifact, buffer);
    console.log(JSON.stringify({ artifact, distinctColors: colors.size, width: image.width, height: image.height }));
    // This fixture legitimately uses a 16-color palette. Verify visible scene
    // regions, not an arbitrary palette-size threshold (also visually reviewed).
    const pixel = (x, y) => image.data.readUInt32BE((y * image.width + x) * 4);
    assert.notEqual(pixel(288, 288), pixel(32, 32), 'Plot interior must differ from surrounding grass');
    assert.notEqual(pixel(160, 160), pixel(32, 32), 'Fence must differ from surrounding grass');
    for (let i = 3; i < image.data.length; i += 4) assert.equal(image.data[i], 255, 'Garden must be fully composited');
    const again = await get(service.base + '/garden/' + address + '.png'); assert(buffer.equals(Buffer.from(await again.arrayBuffer())));
    for (const route of ['/garden/bad', '/garden/0x1234.png', '/missing']) { const r = await get(service.base + route); assert.equal(r.status, 404); await r.text(); }
    const head = await get(service.base + '/garden/' + address, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
    const post = await get(service.base + '/garden/' + address, { method: 'POST' }); assert.equal(post.status, 405); await post.text();
    console.log('PASS share HTML derivation, canonical address/URLs, valid PNG dimensions/content, cache repeat, 404, HEAD, method guard');
  } finally { await service.stop(); }
  const brokenRpc = createServer((req, res) => { req.resume(); res.writeHead(503).end('provider unavailable'); });
  await new Promise(resolve => brokenRpc.listen(0, '127.0.0.1', resolve));
  try {
    const failing = await start({ PONS_RPC_URL: `http://127.0.0.1:${brokenRpc.address().port}`, PONS_TOKEN: '0x' + '1'.repeat(40), PONS_CHAIN_ID: '1', PONS_FROM_BLOCK: '0' });
    try {
      const response = await get(failing.base + '/garden/' + FIXTURES[2].snapshot.address); assert.equal(response.status, 500); assert.equal(await response.text(), 'error');
      const health = await get(failing.base + '/health'); assert.equal(health.status, 200); assert((await health.json()).ok);
      console.log('PASS provider failure returns bounded error and leaves game health responsive');
    } finally { await failing.stop(); }
  } finally { brokenRpc.closeAllConnections(); await new Promise(resolve => brokenRpc.close(resolve)); }
  console.log('PASS both isolated services shut down cleanly');
})().catch(error => { console.error(error); process.exitCode = 1; });
