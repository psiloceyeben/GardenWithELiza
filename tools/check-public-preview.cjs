const { WebSocket } = require('ws');
const assert = require('node:assert/strict');
(async () => {
  const base = 'https://prometheus7.com/ponsgarden/';
  const response = await fetch(base, { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200); const html = await response.text();
  assert(html.includes('DEVELOPMENT PREVIEW'));
  const asset = html.match(/src="([^"]+\.js)"/)[1];
  assert.equal((await fetch(new URL(asset, base), { signal: AbortSignal.timeout(15000) })).status, 200);
  const ws = new WebSocket('wss://prometheus7.com/ponsgarden/ws', { origin: 'https://prometheus7.com' });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.terminate(); reject(new Error('Public socket timeout')); }, 15000);
    ws.once('open', () => { clearTimeout(timer); ws.close(); resolve(); });
    ws.once('error', e => { clearTimeout(timer); reject(e); });
  });
  console.log('PASS public HTTPS preview, built entry asset and canonical-origin secure WebSocket upgrade; no player created');
})().catch(e => { console.error(e); process.exitCode = 1; });
