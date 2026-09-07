import http from 'node:http';
import path from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { Game } from './game';
import * as P from '../../shared/protocol';
import type { ClientMsg } from '../../shared/protocol';
import { deriveGarden } from '../../shared/derive';
import { renderLot, type ShareLot } from '../../share/render';
import copyJson from '../../content/copy.json';

const PORT = Number(process.env.PONS_PORT ?? 8130);
const DATA = process.env.PONS_DATA ?? path.resolve(__dirname, '../../../../data');
const SPRITES = process.env.PONS_SPRITES ?? path.resolve(__dirname, '../../../../client/public/sprites');
const PUBLIC_BASE = (process.env.PONS_PUBLIC_BASE ?? 'https://prometheus7.com/pons').replace(/\/$/, '');
const game = new Game(DATA);

// ------------------------------------------------------------ share pages (bible §6.4): any wallet is a garden
const pngCache = new Map<string, { at: number; buf: Buffer }>();
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

async function shareLot(address: string): Promise<ShareLot> {
  const rec = [...game.players.values()].find((r) => r.address === address);
  const spec = rec?.garden ?? deriveGarden(address, await game.reader.snapshot(address));
  const plants = rec ? rec.plots.map((p, i) => p ? { i, speciesId: p.speciesId, revealed: p.revealed, mutation: p.mutation, size: p.size } : null).filter((x): x is NonNullable<typeof x> => !!x) : [];
  return { spec, plants, name: rec?.name ?? null };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  try {
    if (url.pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, players: game.players.size, online: game.live.size, villages: game.villages.size, reader: game.reader.kind })); return; }
    const m = url.pathname.match(/^\/garden\/(0x[0-9a-fA-F]{40})(\.png)?$/);
    if (!m) { res.writeHead(404); res.end('not found'); return; }
    const address = m[1].toLowerCase();
    if (m[2]) {
      const hit = pngCache.get(address);
      const buf = hit && Date.now() - hit.at < 300_000 ? hit.buf : renderLot(SPRITES, await shareLot(address));
      pngCache.set(address, { at: Date.now(), buf });
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
const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });
wss.on('connection', (ws: WebSocket) => {
  let liveId: string | null = null; let msgs = 0; let window = Date.now();
  ws.on('message', (raw) => {
    const now = Date.now(); if (now - window > 1000) { window = now; msgs = 0; }
    if (++msgs > 60) { ws.close(1008, 'rate'); return; }
    let m: ClientMsg; try { m = JSON.parse(String(raw)); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    if (!liveId) { if (m.t !== 'hello') return; const l = game.join(ws, m); if (l) liveId = l.id; return; }
    const l = game.live.get(liveId); if (!l || l.ws !== ws) return;
    try { const r = game.handle(l, m); if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch((e) => console.error('handle', m.t, e)); } catch (e) { console.error('handle', m.t, e); }
  });
  ws.on('close', () => { if (liveId) { const l = game.live.get(liveId); if (l && l.ws === ws) game.leave(liveId); } });
  ws.on('error', () => undefined);
});

setInterval(() => { try { game.tick(Date.now()); } catch (e) { console.error('tick', e); } }, P.TICK_MS);
setInterval(() => { try { game.snapshot(Date.now()); } catch (e) { console.error('snap', e); } }, P.SNAP_MS);
setInterval(() => { try { game.economy(Date.now()); } catch (e) { console.error('econ', e); } }, 1000);
setInterval(() => game.store.flush(), 10_000);
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => { game.store.flush(); process.exit(0); });
server.listen(PORT, '0.0.0.0', () => console.log(`pons server :${PORT} data=${DATA} reader=${game.reader.kind} players=${game.players.size} villages=${game.villages.size}`));
