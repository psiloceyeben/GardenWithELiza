#!/usr/bin/env node
// Guest gardens are ephemeral; wallet-linked gardens persist. Box C only.
//   node tools/guest-session.test.cjs
// Starts an isolated server with a short guest TTL, then proves:
//   1. a guest who leaves and returns inside the grace window keeps their garden
//   2. a guest who leaves and stays away is purged and their lot is freed
//   3. a wallet-linked player who leaves is NOT purged
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const WebSocket = require('/opt/pons/node_modules/ws');
const SIG = require('/opt/pons/server/dist/server/src/sig.js');

const TTL = 2500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hex = (n) => [...Array(n)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pons-guest-'));
let fails = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}`); if (!ok) fails++; };

function connect(url, id, secret, name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url); const state = { ws, welcome: null, msgs: [] };
    const timer = setTimeout(() => reject(new Error('welcome timeout for ' + name)), 15000);
    ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', id, secret, name })));
    ws.on('message', (raw) => {
      const m = JSON.parse(raw); state.msgs.push(m);
      if (m.t === 'welcome' && !state.welcome) { state.welcome = m; clearTimeout(timer); resolve(state); }
      if (m.t === 'nonce') state.nonce = m;
      if (m.t === 'linked') state.linked = m;
    });
    ws.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}
const health = async (port) => (await fetch(`http://127.0.0.1:${port}/health`)).json();

(async () => {
  const port = 8140 + Math.floor(Math.random() * 40);
  const node = process.execPath;
  const srv = spawn(node, ['/opt/pons/server/dist/server/src/index.js'], {
    env: { PATH: process.env.PATH, PONS_PORT: String(port), PONS_DATA: dir, PONS_GUEST_TTL_MS: String(TTL), PONS_GRACE_MS: '1000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = [];
  srv.stdout.on('data', (d) => log.push(String(d)));
  srv.stderr.on('data', (d) => log.push(String(d)));
  const url = `ws://127.0.0.1:${port}`;
  try {
    for (let i = 0; i < 60 && !log.join('').includes('pons server'); i++) await sleep(250);

    // 1. guest returns inside the grace window
    const gid = hex(16), gsec = hex(32);
    let g = await connect(url, gid, gsec, 'Ghost');
    const lot = g.welcome.you.lotId;
    g.ws.close(); await sleep(TTL / 3);
    g = await connect(url, gid, gsec, 'Ghost');
    check(g.welcome.you.lotId === lot && g.welcome.you.id === gid, `guest returning inside the grace window keeps lot ${lot}`);

    // 2. guest stays away: purged, lot freed
    g.ws.close(); await sleep(TTL + 2500);
    let h = await health(port);
    check(h.players === 0, `guest purged after the grace window (players now ${h.players})`);
    const back = await connect(url, gid, gsec, 'Ghost');
    check(back.welcome.you.sap === 25 && back.welcome.you.plots.every((p) => !p), 'returning later starts a brand new garden');
    back.ws.close(); await sleep(TTL + 2500);

    // 3. wallet-linked player survives leaving
    const wid = hex(16), wsec = hex(32);
    const priv = 'c'.repeat(63) + '1';
    const w = await connect(url, wid, wsec, 'Holder');
    const { address } = SIG.signForTest('probe', priv);
    w.ws.send(JSON.stringify({ t: 'nonce', address }));
    for (let i = 0; i < 40 && !w.nonce; i++) await sleep(100);
    w.ws.send(JSON.stringify({ t: 'link', address, signature: SIG.signForTest(w.nonce.message, priv).signature }));
    for (let i = 0; i < 60 && !w.linked; i++) await sleep(100);
    check(!!w.linked && w.linked.address === address, 'wallet linked');
    w.ws.close(); await sleep(TTL + 2500);
    h = await health(port);
    check(h.players === 1, `wallet-linked garden survives leaving (players ${h.players})`);
  } catch (e) {
    console.log('FAIL: ' + e.message); fails++;
  } finally {
    srv.kill('SIGTERM'); await sleep(1500); srv.kill('SIGKILL');
    if (fails) console.log('--- server log ---\n' + log.join('').split('\n').slice(-15).join('\n'));
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})();
