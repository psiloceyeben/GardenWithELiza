import { WebSocketServer, type WebSocket } from 'ws';
import path from 'node:path';
import { Game } from './game';
import * as P from '../../shared/protocol';
import type { ClientMsg } from '../../shared/protocol';

const PORT = Number(process.env.PONS_PORT ?? 8130);
const DATA = process.env.PONS_DATA ?? path.resolve(__dirname, '../../../data');
const game = new Game(DATA);
const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0', maxPayload: 64 * 1024 });

wss.on('connection', (ws: WebSocket, req) => {
  let liveId: string | null = null; let msgs = 0; let window = Date.now();
  ws.on('message', (raw) => {
    const now = Date.now(); if (now - window > 1000) { window = now; msgs = 0; }
    if (++msgs > 60) { ws.close(1008, 'rate'); return; } // 60 msg/s per socket
    let m: ClientMsg; try { m = JSON.parse(String(raw)); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    if (!liveId) { if (m.t !== 'hello') return; const l = game.join(ws, m); if (l) liveId = l.id; return; }
    const l = game.live.get(liveId); if (!l || l.ws !== ws) return;
    try { game.handle(l, m); } catch (e) { console.error('handle', m.t, e); }
  });
  ws.on('close', () => { if (liveId) { const l = game.live.get(liveId); if (l && l.ws === ws) game.leave(liveId); } });
  ws.on('error', () => undefined);
  void req;
});

setInterval(() => { try { game.tick(Date.now()); } catch (e) { console.error('tick', e); } }, P.TICK_MS);
setInterval(() => { try { game.snapshot(Date.now()); } catch (e) { console.error('snap', e); } }, P.SNAP_MS);
setInterval(() => { try { game.economy(Date.now()); } catch (e) { console.error('econ', e); } }, 1000);
setInterval(() => game.store.flush(), 10_000);
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => { game.store.flush(); process.exit(0); });
console.log(`pons server :${PORT} data=${DATA} players=${game.players.size} villages=${game.villages.size}`);
