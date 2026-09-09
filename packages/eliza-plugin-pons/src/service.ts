// The socket, the world model, and the rules of engagement for an agent player.
//
// This is deliberately a thin, honest client: it speaks the same websocket protocol a
// browser speaks, obeys the same server-authoritative movement, and is subject to the same
// rate limits and steal caps. An agent has no capability a human lacks.
//
// It declares itself with `agent: true` on connect. That is not decoration - the server
// records it and the closing bell makes agent players permanently prize-ineligible. They
// rank on the public board and can never take money off it.

import { WebSocket } from 'ws';
import type { ClientMsg, ServerMsg, PrivateState, PublicLot, SnapPlayer, Wild } from './protocol-types';
import { buildVillage, TILE, type Village } from '../../../shared/world';

export interface PonsConfig {
  /** e.g. wss://ponsgarden.com/ws */
  url: string;
  /** Display name. The server badges agents regardless of what this says. */
  name: string;
  /** Stable per-agent identity. Generated and persisted if absent. */
  id?: string;
  secret?: string;
  /** Reconnect backoff ceiling. */
  maxBackoffMs?: number;
}

export interface WorldView {
  connected: boolean;
  you: PrivateState | null;
  village: { id: string; name: string; biome: number } | null;
  lots: PublicLot[];
  players: SnapPlayer[];
  wilds: Wild[];
  feed: string[];
  market: { sectors: Record<string, number>; headline: string; season: { n: number; endsAt: number }; standing?: { score: number; rank: number; players: number; eligible: boolean } } | null;
  carrying: string | null;
  /** Our own position, tracked from server corrections. */
  pos: { x: number; y: number };
}

const rid = (): string => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

/**
 * One agent's connection to one village. Owns reconnection, the world model, and a small
 * command surface. Everything the actions do goes through here.
 */
export class PonsClient {
  private ws: WebSocket | null = null;
  private closed = false;
  private backoff = 1000;
  private readonly maxBackoff: number;
  readonly id: string;
  readonly secret: string;

  /** The village map, rebuilt locally from the seed exactly as the browser does. */
  map: Village | null = null;

  view: WorldView = {
    connected: false, you: null, village: null, lots: [], players: [], wilds: [],
    feed: [], market: null, carrying: null, pos: { x: 0, y: 0 },
  };

  constructor(private cfg: PonsConfig) {
    this.id = cfg.id ?? rid().slice(0, 16);
    this.secret = cfg.secret ?? rid();
    this.maxBackoff = cfg.maxBackoffMs ?? 30_000;
  }

  /** Resolves once the village is known, or rejects on timeout. */
  connect(timeoutMs = 30_000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('pons: join timed out')), timeoutMs);
      const open = () => { clearTimeout(timer); resolve(); };
      this.openSocket(open);
    });
  }

  private openSocket(onReady?: () => void): void {
    if (this.closed) return;
    const ws = new WebSocket(this.cfg.url);
    this.ws = ws;

    ws.on('open', () => {
      this.backoff = 1000;
      this.send({
        t: 'hello', id: this.id, secret: this.secret, name: this.cfg.name,
        agent: true,   // never omitted: prize-ineligibility depends on it
      });
    });

    ws.on('message', (raw) => {
      let m: ServerMsg;
      try { m = JSON.parse(String(raw)) as ServerMsg; } catch { return; }
      this.apply(m);
      if (m.t === 'welcome' && onReady) { onReady(); onReady = undefined; }
    });

    ws.on('close', () => {
      this.view.connected = false;
      if (this.closed) return;
      // Reconnect with backoff. A flapping agent is worse than an absent one.
      setTimeout(() => this.openSocket(), this.backoff);
      this.backoff = Math.min(this.maxBackoff, this.backoff * 2);
    });

    ws.on('error', () => { /* close handler owns recovery */ });
  }

  private apply(m: ServerMsg): void {
    switch (m.t) {
      case 'welcome':
        this.view.connected = true;
        this.view.you = m.you;
        this.view.village = { id: m.village.id, name: m.village.name, biome: m.village.biome };
        this.map = buildVillage(m.village.seed);
        this.view.lots = m.lots;
        this.view.players = m.players;
        break;
      case 'state': this.view.you = { ...(this.view.you as PrivateState), ...m.you }; break;
      case 'snap': this.view.players = m.p; break;
      case 'players': /* name registry, not positions */ break;
      case 'lot': {
        const i = this.view.lots.findIndex((l) => l.ownerId === m.lot.ownerId);
        if ((m as { removed?: boolean }).removed) { if (i >= 0) this.view.lots.splice(i, 1); }
        else if (i >= 0) this.view.lots[i] = m.lot; else this.view.lots.push(m.lot);
        break;
      }
      case 'wild': {
        if (m.all) this.view.wilds = m.all;
        if (m.add) this.view.wilds = [...this.view.wilds, ...m.add];
        if (m.remove) this.view.wilds = this.view.wilds.filter((w) => !m.remove!.includes(w.id));
        break;
      }
      case 'correction': this.view.pos = { x: m.x, y: m.y }; break;
      case 'carry': this.view.carrying = m.speciesId ?? null; break;
      case 'market': this.view.market = { sectors: m.sectors, headline: m.headline, season: m.season, standing: m.standing }; break;
      case 'feed':
        this.view.feed.unshift(m.e?.text ?? '');
        this.view.feed = this.view.feed.slice(0, 30);
        break;
      default: break;
    }
  }

  send(m: ClientMsg): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  /**
   * Walk toward a point, one step of intent. Movement stays server-authoritative: this
   * sends the same `input` the browser's joystick sends, the client-side position is only
   * a prediction, and the server's `correction` is always the truth. An agent cannot
   * teleport, outrun the distance budget, or reach through a fence.
   */
  moveToward(x: number, y: number, speed = 1): void {
    const dx = x - this.view.pos.x, dy = y - this.view.pos.y;
    const len = Math.hypot(dx, dy);
    if (len < 2) return this.stop();
    const nx = (dx / len) * speed, ny = (dy / len) * speed;
    this.view.pos = { x: this.view.pos.x + nx, y: this.view.pos.y + ny };   // prediction only
    this.send({
      t: 'input', dx: nx, dy: ny, x: this.view.pos.x, y: this.view.pos.y,
      d: Math.abs(dx) > Math.abs(dy) ? 'side' : dy < 0 ? 'up' : 'down',
      f: dx < 0, m: true,
    });
  }

  stop(): void {
    this.send({
      t: 'input', dx: 0, dy: 0, x: this.view.pos.x, y: this.view.pos.y,
      d: 'down', f: false, m: false,
    });
  }

  /** Walk until within `within` px of a point, or until the deadline. */
  async walkTo(x: number, y: number, within = 24, timeoutMs = 20_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const d = Math.hypot(x - this.view.pos.x, y - this.view.pos.y);
      if (d <= within) { this.stop(); return true; }
      this.moveToward(x, y, 4);
      await new Promise((r) => setTimeout(r, 100));
    }
    this.stop();
    return false;
  }

  disconnect(): void {
    this.closed = true;
    this.view.connected = false;
    try { this.ws?.close(); } catch { /* already gone */ }
  }
}

/** Pixel position of a lot's gate, for walking to somebody's garden. */
export function lotGate(client: PonsClient, lotId: number): { x: number; y: number } | null {
  const lot = client.map?.lots?.[lotId];
  if (!lot) return null;
  return { x: (lot.gate.tx + 0.5) * TILE, y: (lot.gate.ty + 0.5) * TILE };
}
