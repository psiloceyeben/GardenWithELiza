// Phase one "life in the village": wild seeds on the grounds, clock events, the sprint lap.
// Owned by Game (server-authoritative); all state is per village and rebuilt from nothing on restart.
import type { Game, PlayerRec } from './game';
import * as P from '../../shared/protocol';
import type { Wild, VillageEvent, EventKind, SprintEntry } from '../../shared/protocol';
import * as E from '../../shared/economy';
import { uid } from '../../shared/rng';
import { isWalkableTile, lotAtPx, tileAt, T, TILE, VILLAGE_W, VILLAGE_H, type Village } from '../../shared/world';
import { ROSTER } from './roster';
import copyJson from '../../content/copy.json';

const SP = new Map(ROSTER.map((s) => [s.id, s]));
const UI = copyJson.ui as Record<string, string>;
const EVENT_ORDER: EventKind[] = ['seed_rain', 'screaming_hour', 'golden_hour'];
const SPAWN_MS = Number(process.env.PONS_WILD_SPAWN_MS ?? P.WILD_SPAWN_MS);
const EVENT_COPY: Record<EventKind, string> = { seed_rain: UI.evSeedRain, screaming_hour: UI.evScreaming, golden_hour: UI.evGolden };

interface Sprint { startedAt: number; turned: boolean; villageId:string; socket:import('ws').WebSocket; }

export class Life {
  wild = new Map<string, Wild[]>();
  events = new Map<string, VillageEvent | null>();
  sprints = new Map<string, Sprint>();
  lastSpawn = new Map<string, number>();
  private period = -1;

  constructor(private game: Game) {}

  // ------------------------------------------------------------ helpers
  private track(v: Village): { x: number; y: number } { return { x: v.track.tx * TILE + TILE, y: v.track.ty * TILE + 16 }; }
  private fountain(v: Village): { x: number; y: number } { const f = v.props.find((p) => p.kind === 'fountain')!; return { x: f.tx * TILE + TILE, y: f.ty * TILE + TILE }; }
  event(villageId: string): VillageEvent | null { return this.events.get(villageId) ?? null; }
  board(villageId: string): SprintEntry[] { return this.game.villages.get(villageId)?.sprint ?? []; }
  welcome(villageId: string): P.ServerMsg[] {
    return [{ t: 'wild', all: this.wild.get(villageId) ?? [] }, { t: 'event', ev: this.event(villageId) }, { t: 'board', sprint: this.board(villageId) }];
  }

  private spawnSpot(v: Village, plaza: boolean, rng: () => number): { x: number; y: number } | null {
    for (let i = 0; i < 60; i++) {
      let tx: number; let ty: number;
      if (plaza) { tx = v.plaza.x + 1 + Math.floor(rng() * (v.plaza.w - 2)); ty = v.plaza.y + 1 + Math.floor(rng() * (v.plaza.h - 2)); }
      else { tx = 2 + Math.floor(rng() * (VILLAGE_W - 4)); ty = 2 + Math.floor(rng() * (VILLAGE_H - 4)); }
      const t = tileAt(v, tx, ty);
      const grassy = t === T.grass || t === T.grass2 || t === T.grass3 || t === T.flowers;
      if (!plaza && !grassy) continue;
      if (!isWalkableTile(v, tx, ty, () => false)) continue;
      if (v.lots.some((l) => tx >= l.x - 1 && tx < l.x + l.w + 1 && ty >= l.y - 1 && ty < l.y + l.h + 1)) continue;
      if (!plaza && tx >= v.plaza.x - 2 && tx < v.plaza.x + v.plaza.w + 2 && ty >= v.plaza.y - 2 && ty < v.plaza.y + v.plaza.h + 2) continue;
      return { x: tx * TILE + 16, y: ty * TILE + 16 };
    }
    return null;
  }

  private spawn(villageId: string, n: number, plaza: boolean, now: number): void {
    const v = this.game.maps.get(villageId)!; const list = this.wild.get(villageId) ?? []; const add: Wild[] = [];
    for (let i = 0; i < n && list.length + add.length < (plaza ? P.WILD_MAX * 3 : P.WILD_MAX); i++) {
      const spot = this.spawnSpot(v, plaza, this.game.rng); if (!spot) break;
      const tier = E.rollTier(this.game.rng, 'common'); const pool = ROSTER.filter((s) => s.tier === tier && !s.hybrid);
      const sp = pool[Math.floor(this.game.rng() * pool.length)];
      add.push({ id: uid('w'), x: spot.x, y: spot.y, speciesId: sp.id, tier, until: now + P.WILD_TTL_MS });
      if (E.tierIndex(tier) >= E.tierIndex('rare')) this.game.feed(villageId, 'reveal', `${UI.wildSpawn} ${sp.name} ${UI.wildSpawnTail}`);
    }
    if (add.length) { this.wild.set(villageId, list.concat(add)); this.game.broadcast(villageId, { t: 'wild', add }); }
  }

  // ------------------------------------------------------------ per second
  second(now: number): void {
    // events on a shared clock: every EVENT_PERIOD a new one starts and runs EVENT_LEN
    const period = Math.floor(now / P.EVENT_PERIOD_MS);
    if (period !== this.period) {
      this.period = period; const kind = EVENT_ORDER[period % EVENT_ORDER.length];
      const ev: VillageEvent = { kind, startedAt: period * P.EVENT_PERIOD_MS, endsAt: period * P.EVENT_PERIOD_MS + P.EVENT_LEN_MS };
      if (now < ev.endsAt) for (const vid of this.game.villages.keys()) {
        this.events.set(vid, ev); this.game.broadcast(vid, { t: 'event', ev }); this.game.feed(vid, 'gate', EVENT_COPY[kind]);
        if (kind === 'seed_rain') this.spawn(vid, 10, true, now);
      }
    }
    for (const vid of this.game.villages.keys()) {
      const ev = this.events.get(vid);
      if (ev && now >= ev.endsAt) { this.events.set(vid, null); this.game.broadcast(vid, { t: 'event', ev: null }); }
      // wild spawns + expiry (only villages with someone online)
      const online = [...this.game.live.values()].some((l) => { const r = this.game.players.get(l.id); return !!r && this.game.vid(r) === vid; });
      if (!online) continue;
      const list = this.wild.get(vid) ?? []; const gone = list.filter((w) => now > w.until).map((w) => w.id);
      if (gone.length) { this.wild.set(vid, list.filter((w) => now <= w.until)); this.game.broadcast(vid, { t: 'wild', remove: gone }); }
      if (now - (this.lastSpawn.get(vid) ?? 0) >= SPAWN_MS) { this.lastSpawn.set(vid, now); this.spawn(vid, 2, false, now); }
    }
  }

  // ------------------------------------------------------------ per tick: sprint laps
  tick(now: number): void {
    for (const [id, s] of this.sprints) {
      const l = this.game.live.get(id); const rec = l && this.game.players.get(id);
      if (!l || !rec) { this.sprints.delete(id); continue; }
      if(s.socket!==l.ws || s.villageId!==this.game.vid(rec)){
        this.sprints.delete(id);this.game.send(l.ws,{t:'sprint',phase:'cancel'});continue;
      }
      const v = this.game.map(rec); const tr = this.track(v); const fo = this.fountain(v);
      if (now - s.startedAt > 30_000 || l.carry) { this.sprints.delete(id); this.game.send(l.ws, { t: 'sprint', phase: 'cancel' }); continue; }
      if (!s.turned) { if (Math.hypot(l.x - fo.x, l.y - fo.y) < 60) { s.turned = true; this.game.send(l.ws, { t: 'sprint', phase: 'turn' }); } continue; }
      if (Math.hypot(l.x - tr.x, l.y - tr.y) < 40) {
        const ms = now - s.startedAt; this.sprints.delete(id); rec.lastSprintAt=now;
        const vrec = this.game.villages.get(this.game.vid(rec))!; const board = (vrec.sprint ?? []).slice();
        const record = !board.length || ms < board[0].ms;
        board.push({ name: rec.name, ms, at: now }); board.sort((a, b) => a.ms - b.ms); vrec.sprint = board.slice(0, 5); this.game.store.touch();
        const reward = P.SPRINT_REWARD + (record ? P.SPRINT_RECORD_BONUS : 0); this.game.addSap(rec, reward, 'sprint');
        const best = Math.min(ms, ...board.filter((b) => b.name === rec.name).map((b) => b.ms));
        this.game.send(l.ws, { t: 'sprint', phase: 'finish', ms, best, record }); this.game.pushState(rec, { sap: rec.sap }); this.game.progress(rec, "sprint");
        this.game.broadcast(this.game.vid(rec), this.game.boardMsg(this.game.vid(rec), now));
        if (record) this.game.feed(this.game.vid(rec), 'tag', `${rec.name} set the sprint record: ${(ms / 1000).toFixed(2)} s`);
      }
    }
  }

  // ------------------------------------------------------------ intents
  forage(l: { x: number; y: number; ws: import('ws').WebSocket }, rec: PlayerRec, id: string, now=Date.now()): void {
    const list = this.wild.get(this.game.vid(rec)) ?? []; const w = list.find((x) => x.id === id);
    if (!w || now >= w.until) return this.game.send(l.ws, { t: 'toast', text: UI.wildGone });
    if (Math.hypot(w.x - l.x, w.y - l.y) > 44) return this.game.send(l.ws, { t: 'toast', text: UI.raidTooFar });
    if (rec.seeds.length >= 40) return;
    this.wild.set(this.game.vid(rec), list.filter((x) => x.id !== id)); this.game.broadcast(this.game.vid(rec), { t: 'wild', remove: [id] });
    rec.seeds.push({ uid: uid('s'), speciesId: w.speciesId, tier: w.tier }); this.game.store.touch();
    this.game.pushState(rec, { seeds: rec.seeds }); this.game.send(l.ws, { t: 'toast', text: `${UI.wildFound} ${SP.get(w.speciesId)!.name}!` }); this.game.progress(rec, "forage");
  }

  sprintStart(l: { x: number; y: number; ws: import('ws').WebSocket; carry: unknown }, rec: PlayerRec, now: number): void {
    if (this.sprints.has(rec.id) || l.carry) return;
    const last=Number.isFinite(rec.lastSprintAt)?Math.max(0,rec.lastSprintAt!):0;
    if (now - last < P.SPRINT_COOLDOWN_MS) return this.game.send(l.ws, { t: 'toast', text: UI.sprintCooldown });
    const tr = this.track(this.game.map(rec)); if (Math.hypot(l.x - tr.x, l.y - tr.y) > 48) return this.game.send(l.ws, { t: 'toast', text: UI.raidTooFar });
    this.sprints.set(rec.id, { startedAt: now, turned: false, villageId:this.game.vid(rec),socket:l.ws }); this.game.send(l.ws, { t: 'sprint', phase: 'start' });
  }

  /** Golden Hour: a reveal that rolled no mutation gets one more roll. */
  goldenReroll(villageId: string, mutation: string, rng: () => number): string {
    const ev = this.event(villageId); if (!ev || ev.kind !== 'golden_hour' || mutation !== 'none') return mutation;
    return E.rollReveal(rng).mutation;
  }

  inLot(rec: PlayerRec, x: number, y: number): boolean { const l = lotAtPx(this.game.map(rec), x, y); return !!l && l.id === rec.lotId; }
}
