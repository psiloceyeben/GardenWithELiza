import http from 'node:http';
import path from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { Game } from './game';
import * as P from '../../shared/protocol';
import { isClientMsg } from './validate-message';
import { deriveGarden } from '../../shared/derive';
import { renderLot, type ShareLot } from '../../share/render';
import copyJson from '../../content/copy.json';
import { ImageCache } from './image-cache';
import { SocketLifecycle } from './socket-lifecycle';
import { originPolicy } from './origin-policy';
import { SignupBudget } from './signup-budget';

const PORT = Number(process.env.PONS_PORT ?? 8130);
const DATA = process.env.PONS_DATA ?? path.resolve(__dirname, '../../../../data');
const SPRITES = process.env.PONS_SPRITES ?? path.resolve(__dirname, '../../../../client/public/sprites');
const PUBLIC_BASE = (process.env.PONS_PUBLIC_BASE ?? 'https://prometheus7.com/ponsgarden').replace(/\/$/, '');
const allowOrigin = originPolicy(PUBLIC_BASE, process.env.PONS_ALLOWED_ORIGINS);
const game = new Game(DATA);
let stopping = false;
const pendingHandlers = new Set<Promise<void>>();
const signupBudget = new SignupBudget(Number(process.env.PONS_SIGNUP_BURST ?? 200), Number(process.env.PONS_SIGNUP_REFILL_MS ?? 30000));

// ------------------------------------------------------------ share pages (bible §6.4): any wallet is a garden
const pngCache = new ImageCache();
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

async function shareLot(address: string): Promise<ShareLot> {
  const rec = [...game.players.values()].find((r) => r.address === address);
  const derived = rec?.garden ?? deriveGarden(address, await game.reader.snapshot(address));
  const spec = rec ? { ...derived, plotCount: rec.plotCount } : derived;
  const plants = rec ? rec.plots.map((p, i) => p ? { i, speciesId: p.speciesId, revealed: p.revealed, mutation: p.mutation, size: p.size } : null).filter((x): x is NonNullable<typeof x> => !!x) : [];
  return { spec, plants, name: rec?.name ?? null };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://x');
    res.setHeader('x-content-type-options', 'nosniff');
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { allow: 'GET, HEAD' }); res.end('method not allowed'); return; }
    if (url.pathname === '/health') { const ok = !stopping && !game.store.failed; res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok, players: game.players.size, online: game.live.size, villages: game.villages.size, reader: game.reader.kind, storage: game.store.kind, lastSavedAt: game.store.lastSavedAt })); return; }
    const m = url.pathname.match(/^\/garden\/(0x[0-9a-fA-F]{40})(\.png)?$/);
    if (!m) { res.writeHead(404); res.end('not found'); return; }
    const address = m[1].toLowerCase();
    if (m[2]) {
      const hit = pngCache.get(address);
      const buf = hit ?? renderLot(SPRITES, await shareLot(address));
      if (!hit) pngCache.set(address, buf);
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=300' }); res.end(buf); return;
    }
    const lot = await shareLot(address); const s = lot.spec; const img = `${PUBLIC_BASE}/garden/${address}.png`;
    const stages = (copyJson.ui as Record<string, string>).treeStages.split('|');
    const title = `${lot.name ? esc(lot.name) + "'s garden" : (copyJson.ui as Record<string, string>).shareTitle} · ${address.slice(0, 6)}…${address.slice(-4)}`;
    const desc = `${s.plotCount} plots · ${s.rarityFloor} floor · ${stages[s.treeStage]} conviction tree · ${s.witherMarks} wither-marks`;
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=120' });
    res.end(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<meta property="og:title" content="${title}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${img}"><meta name="twitter:card" content="summary_large_image"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;background:#181220;color:#f0e8d2;font-family:monospace;text-align:center;padding:24px}img{image-rendering:pixelated;max-width:96vw;border:3px solid #bc8c5a}a{color:#f0c434}p{font-size:13px}</style></head>
<body><h2>${title}</h2><img src="${img}" alt="garden"><p>${esc(desc)}</p><p>${esc((copyJson.ui as Record<string, string>).tagline)}</p><p><a href="${PUBLIC_BASE}/">Play Pons Garden</a></p></body></html>`);
  } catch (e) { console.error('share', e); res.writeHead(500); res.end('error'); }
});

// ------------------------------------------------------------ websocket
const wss = new WebSocketServer({ server, maxPayload: 64 * 1024,
  verifyClient: (info: { req: http.IncomingMessage }) => !stopping && allowOrigin(info.req.headers.origin, info.req.socket.remoteAddress),
});
const socketLifecycles = new Map<WebSocket, SocketLifecycle>();
wss.on('connection', (ws: WebSocket) => {
  // Leave headroom above the 200-player target, while bounding idle sockets too.
  if (stopping || wss.clients.size > 512) { ws.terminate(); return; }
  const lifecycle = new SocketLifecycle(ws, Date.now()); socketLifecycles.set(ws, lifecycle);
  ws.on('pong', () => lifecycle.pong());
  let liveId: string | null = null; let msgs = 0; let window = Date.now();
  ws.on('message', (raw) => {
    if (stopping || game.store.failed) { ws.close(1013, 'storage unavailable'); return; }
    const now = Date.now(); if (now - window > 1000) { window = now; msgs = 0; }
    if (++msgs > 60) { ws.close(1008, 'rate'); return; }
    let m: unknown; try { m = JSON.parse(String(raw)); } catch { ws.close(1008, 'invalid message'); return; }
    if (!isClientMsg(m)) { ws.close(1008, 'invalid message'); return; }
    if (!liveId) {
      if (m.t !== 'hello') { ws.close(1008, 'hello required'); return; }
      if (!game.players.has(m.id) && !signupBudget.take(now)) { ws.close(1013, 'new gardens busy; retry later'); return; }
      try { const l = game.join(ws, m); if (l) { liveId = l.id; lifecycle.authenticate(); } else ws.close(1008, 'invalid hello'); }
      catch { ws.close(1008, 'invalid hello'); }
      return;
    }
    const l = game.live.get(liveId); if (!l || l.ws !== ws) return;
    try { const r = game.handle(l, m); if (r && typeof (r as Promise<void>).catch === 'function') { const task = (r as Promise<void>).catch(() => console.error('handle failed', m.t)).finally(() => pendingHandlers.delete(task)); pendingHandlers.add(task); } } catch { console.error('handle failed', m.t); }
  });
  ws.on('close', () => { socketLifecycles.delete(ws); if (liveId) { const l = game.live.get(liveId); if (l && l.ws === ws) game.leave(liveId); } });
  ws.on('error', () => undefined);
});

async function start(): Promise<void> {
  await game.initialize();
  game.purgeStaleGuests();          // only wallet-linked gardens survive a restart
  await game.commit().catch(() => undefined);
  const timers = [
    setInterval(() => { const now = Date.now(); for (const lifecycle of socketLifecycles.values()) lifecycle.check(now); }, 5000),
    setInterval(() => { if (!stopping && !game.store.failed) try { game.tick(Date.now()); } catch { console.error('tick failed'); } }, P.TICK_MS),
    setInterval(() => { if (!stopping && !game.store.failed) try { game.snapshot(Date.now()); } catch { console.error('snapshot failed'); } }, P.SNAP_MS),
    setInterval(() => { if (!stopping && !game.store.failed) try { game.economy(Date.now()); } catch { console.error('economy failed'); } }, 1000),
    setInterval(() => { if (!stopping) void game.commit().catch(() => console.error('persistence failed; gameplay paused')); }, P.TICK_MS),
  ];
  for (const sig of ['SIGINT','SIGTERM'] as const) process.on(sig, () => {
    if (stopping) return; stopping = true;
    timers.forEach(clearInterval); server.close();
    const deadline = setTimeout(() => process.exit(1), 20000); deadline.unref();
    void (async () => {
      await Promise.allSettled([...pendingHandlers]);
      for (const id of [...game.live.keys()]) game.leave(id, true);
      await game.commit(); await game.store.close();
      for (const ws of wss.clients) ws.terminate();
      clearTimeout(deadline); process.exit(0);
    })().catch(() => { console.error('shutdown save failed'); process.exit(1); });
  });
  server.listen(PORT, process.env.PONS_HOST ?? '0.0.0.0', () => {
    const address = server.address();
    console.log(`pons server :${address && typeof address !== 'string' ? address.port : PORT} storage=${game.store.kind} reader=${game.reader.kind} players=${game.players.size} villages=${game.villages.size}`);
  });
}
void start().catch(() => { console.error('Startup failed: check storage configuration and migration inputs'); process.exit(1); });
