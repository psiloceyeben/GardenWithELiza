const assert = require('node:assert/strict');
const { WebSocket } = require('ws');
const { PNG } = require('pngjs');
const port = Number(process.argv[2]), existing = process.argv[3] === 'existing';
assert(Number.isInteger(port) && port > 0 && port < 65536);
const base = `http://127.0.0.1:${port}`;
(async () => {
  const health = await fetch(base + '/health').then(r => r.json()); assert(health.ok); assert.equal(health.storage, 'file');
  const ws = new WebSocket(base.replace('http:', 'ws:'));
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Hardened client timeout')), 15000);
      const finish = error => { clearTimeout(timer); error ? reject(error) : resolve(); };
      ws.on('error', finish);
      ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', id: 'hardeningqa123', secret: 'hardeningqasecret', name: 'Sandbox QA' })));
      ws.on('message', raw => { try {
        const m = JSON.parse(String(raw));
        if (m.t === 'welcome') {
          if (existing) { assert.equal(m.you.seeds.length, 1); finish(); }
          else {
            assert.equal(m.you.seeds.length, 0);
            const slot = m.you.conveyor.slots.findIndex(s => !s.sold && s.price <= m.you.sap);
            assert(slot >= 0); ws.send(JSON.stringify({ t: 'buy', slot }));
          }
        }
        if (!existing && m.t === 'state' && m.you.seeds) { assert.equal(m.you.seeds.length, 1); finish(); }
      } catch (error) { finish(error); } });
    });
  } finally { ws.terminate(); }
  const image = await fetch(base + '/garden/0x' + '1'.repeat(40) + '.png');
  assert.equal(image.status, 200); const png = PNG.sync.read(Buffer.from(await image.arrayBuffer()));
  assert(png.width > 100 && png.height > 100);
  console.log(`PASS hardened service ${existing ? 'restart persistence' : 'guest signup and purchase'}, health and real share PNG`);
})().catch(error => { console.error(error); process.exitCode = 1; });
