// Authoritative simulation. Owns every Layer G value. Clients only send intents (bible §6.2).
import type { WebSocket } from 'ws';
import type { GameState, Plant, Seed, Tier, ConveyorSlot } from '../../shared/types';
import * as E from '../../shared/economy';
import { mulberry32, randomSeed, uid } from '../../shared/rng';
import { buildVillage, lotAtPx, lotGatePx, moveActor, TILE, BIOME_NAMES, LOTS_PER_VILLAGE, type Village, type Lot } from '../../shared/world';
import * as P from '../../shared/protocol';
import type { ClientMsg, ServerMsg, PrivateState, PublicLot, SnapPlayer, Defenses, FeedEvent, Dir } from '../../shared/protocol';
import { Store } from './store';
import { deriveGarden, type GardenSpec } from '../../shared/derive';
import { readerFromEnv, type ChainReader } from '../../chain-reader/src';
import { verifySignature, newNonce } from './sig';
import { signMessage } from '../../shared/chain';
import { Life } from './life';
import * as Oracle from './oracle';
import { NPCS, MISSIONS, MISSION_MAX_ACTIVE, npcById, type MissionKind, type MissionView } from '../../shared/missions';
import rosterJson from '../../content/roster.json';
import copyJson from '../../content/copy.json';

const ROSTER = rosterJson.species as import('../../shared/types').Species[];
const SP = new Map(ROSTER.map((s) => [s.id, s]));
const MUT = copyJson.mutations as Record<string, string>;
const UI = copyJson.ui as Record<string, string>;
const DEFAULT_PLOTS = 10; // Ben 2026-09-07: ten empty plots to start; existing players are raised to this on login (land never shrinks)
const GRACE_MS = Number(process.env.PONS_GRACE_MS ?? P.GRACE_MS);

export interface PlayerRec {
  id: string; secret: string; name: string; color: number;
  sap: number; seeds: Seed[]; plots: (Plant | null)[]; plotCount: number; lockedUntil: number[];
  conveyor: { slots: ConveyorSlot[]; refreshAt: number };
  speedLevel: number; rarityFloor: Tier; defenses: Defenses;
  villageId: string; lotId: number;
  createdAt: number; lastSeen: number;
  stats: PrivateState['stats'];
  stolenLog: number[];
  address?: string | null;      // linked wallet (proved by signature); null/undefined = guest
  garden?: GardenSpec | null;   // Layer C, derived; re-derived on every link
  visiting?: string | null;     // village id while away from home
  stolenBy?: P.Thief[];         // who robbed me in the last hour (bounty targets)
  cosmetics?: P.Cosmetics;      // Sap sinks, zero gameplay effect
  hat?: number; hats?: number[];
  weekly?: P.Weekly;            // trophies, reset each ISO week
  missions?: P.MissionState;    // town missions: active progress + day each was last completed
}
const dayKey = (now: number): string => new Date(now).toISOString().slice(0, 10);
const DEFAULT_COS: P.Cosmetics = { fence: 'wood', lantern: false, nameplate: false, path: false, gnomeHat: -1 };
function weekKey(now: number): string { const d = new Date(now); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10); }
export interface VillageRec { id: string; seed: number; lots: (string | null)[]; n: number; sprint?: P.SprintEntry[]; bounties?: P.Bounty[]; }
const LOT_CAP = Math.min(LOTS_PER_VILLAGE, Number(process.env.PONS_LOT_CAP ?? LOTS_PER_VILLAGE));

interface Live {
  id: string; ws: WebSocket; x: number; y: number; d: Dir; f: boolean; m: boolean;
  carry: { plant: Plant; from: string; fromPlot: number } | null;
  channel: { kind: 'uproot' | 'break'; target: string; plotId: number; startedAt: number; endsAt: number; sx: number; sy: number } | null;
  shieldUntil: number; lastInputAt: number; lastChatAt: number; connectedAt: number;
  nonce: { value: string; address: string; issuedAt: string; at: number } | null;
  lastLot: number;
  lastAskAt: number;
}

export class Game {
  store: Store<PlayerRec, VillageRec>;
  players = new Map<string, PlayerRec>();
  villages = new Map<string, VillageRec>();
  maps = new Map<string, Village>();
  live = new Map<string, Live>();
  feeds = new Map<string, FeedEvent[]>();
  rng = mulberry32(randomSeed());
  nextVillage = 1;
  reader: ChainReader = readerFromEnv(process.env);
  life = new Life(this);

  constructor(dataDir: string) {
    this.store = new Store(dataDir, this.players, this.villages);
    this.store.load();
    for (const v of this.villages.values()) { this.maps.set(v.id, buildVillage(v.seed)); this.nextVillage = Math.max(this.nextVillage, v.n + 1); }
  }

  // ------------------------------------------------------------ helpers
  send(ws: WebSocket, m: ServerMsg): void { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m)); }
  sendTo(id: string, m: ServerMsg): void { const l = this.live.get(id); if (l) this.send(l.ws, m); }
  broadcast(villageId: string, m: ServerMsg, except?: string): void {
    const s = JSON.stringify(m);
    for (const l of this.live.values()) { const r = this.players.get(l.id); if (r && l.id !== except && this.vid(r) === villageId && l.ws.readyState === l.ws.OPEN) l.ws.send(s); }
  }
  /** The village a player is currently standing in (home unless visiting). */
  vid(rec: PlayerRec): string { return rec.visiting ?? rec.villageId; }
  homeMap(rec: PlayerRec): Village { return this.maps.get(rec.villageId)!; }
  villageName(id: string): string { const v = this.villages.get(id)!; const m = this.maps.get(id)!; return `${BIOME_NAMES[m.biome]} #${v.n}`; }
  villageList(): P.VillageInfo[] {
    return [...this.villages.values()].map((v) => ({ id: v.id, name: this.villageName(v.id), online: [...this.live.values()].filter((l) => this.vid(this.players.get(l.id)!) === v.id).length, free: v.lots.filter((x) => !x).length }));
  }
  feed(villageId: string, kind: FeedEvent['kind'], text: string): void {
    const e: FeedEvent = { at: Date.now(), kind, text };
    const f = this.feeds.get(villageId) ?? []; f.unshift(e); if (f.length > 40) f.length = 40; this.feeds.set(villageId, f);
    this.broadcast(villageId, { t: 'feed', e });
  }
  map(rec: PlayerRec): Village { return this.maps.get(this.vid(rec))!; }
  lot(rec: PlayerRec): Lot { return this.homeMap(rec).lots[rec.lotId]; }
  isShielded(rec: PlayerRec, now: number): boolean { const l = this.live.get(rec.id); return !l || now < l.shieldUntil; }
  gateClosedFn(villageId: string): (tx: number, ty: number) => boolean {
    const v = this.villages.get(villageId)!; const m = this.maps.get(villageId)!;
    return (tx, ty) => {
      for (let i = 0; i < m.lots.length; i++) {
        const l = m.lots[i];
        if (l.gate.tx === tx && l.gate.ty === ty) { const o = v.lots[i]; const rec = o ? this.players.get(o) : null; return !!rec && rec.defenses.gateHp > 0; }
      }
      return false;
    };
  }
  speedOf(l: Live, rec: PlayerRec, now: number): number {
    let s = P.BASE_SPEED * E.speedMult(rec.speedLevel);
    const inLot = lotAtPx(this.map(rec), l.x, l.y);
    const owner = inLot ? this.ownerOfLot(this.vid(rec), inLot.id) : null;
    const foreign = !!owner && owner.id !== rec.id;
    if (foreign && owner!.defenses.mud) s *= P.MUD_SPEED;
    if (l.carry) { s *= P.CARRY_SPEED; if (foreign && owner!.defenses.sprinkler) s *= P.SPRINKLER_SPEED; }
    return s;
  }
  ownerOfLot(villageId: string, lotId: number): PlayerRec | null {
    const id = this.villages.get(villageId)?.lots[lotId]; return id ? this.players.get(id) ?? null : null;
  }
  gnomePos(rec: PlayerRec, now: number): { x: number; y: number } {
    const c = this.lot(rec).center; const a = now / 1500;
    return { x: c.x + Math.cos(a) * 52, y: c.y + Math.sin(a) * 40 };
  }

  cos(rec: PlayerRec): P.Cosmetics { return rec.cosmetics ?? (rec.cosmetics = { ...DEFAULT_COS }); }
  weekly(rec: PlayerRec, now: number): P.Weekly {
    const k = weekKey(now);
    if (!rec.weekly || rec.weekly.week !== k) rec.weekly = { week: k, steals: 0, tags: 0, heistTier: -1, heistSpecies: '' };
    return rec.weekly;
  }
  plantName(p: Plant): string { const n = SP.get(p.speciesId)!.name; return p.nick ? `${n} "${p.nick}"` : n; }
  nameEntry(rec: PlayerRec): P.NameEntry { return { name: rec.name, color: rec.color, hat: rec.hat ?? 0 }; }
  trophies(villageId: string, now: number): P.Trophies {
    const week = weekKey(now); const recs = [...this.players.values()].filter((r) => r.villageId === villageId && r.weekly?.week === week);
    const top = (f: (w: P.Weekly) => number) => recs.filter((r) => f(r.weekly!) > 0).sort((a, b) => f(b.weekly!) - f(a.weekly!)).slice(0, 3).map((r) => ({ name: r.name, n: f(r.weekly!) }));
    const heists = recs.filter((r) => r.weekly!.heistTier >= 0).sort((a, b) => b.weekly!.heistTier - a.weekly!.heistTier).slice(0, 3).map((r) => ({ name: r.name, species: SP.get(r.weekly!.heistSpecies)?.name ?? '', tier: E.TIERS[r.weekly!.heistTier] }));
    return { week, steals: top((w) => w.steals), tags: top((w) => w.tags), heists };
  }
  boardMsg(villageId: string, now: number): ServerMsg { return { t: 'board', sprint: this.life.board(villageId), bounties: this.bountiesIn(villageId, now), trophies: this.trophies(villageId, now) }; }

  landView(rec: PlayerRec): P.LandView {
    const g = rec.garden ?? null;
    return { address: rec.address ?? null, biome: g ? g.biome : this.homeMap(rec).biome, treeStage: g ? g.treeStage : 0, witherMarks: g ? g.witherMarks : 0, decorFlora: g ? g.decorFlora : 0, hybrids: g ? g.hybridsUnlocked : false };
  }
  privateState(rec: PlayerRec): PrivateState {
    return { id: rec.id, name: rec.name, color: rec.color, sap: rec.sap, seeds: rec.seeds, plots: rec.plots, plotCount: rec.plotCount, conveyor: rec.conveyor, speedLevel: rec.speedLevel, rarityFloor: rec.rarityFloor, defenses: rec.defenses, lotId: rec.lotId, villageId: rec.villageId, stats: rec.stats, lockedUntil: rec.lockedUntil, land: this.landView(rec), visiting: rec.visiting ?? null, stolenBy: (rec.stolenBy ?? []).filter((t) => Date.now() - t.at < P.BOUNTY_TTL_MS), cosmetics: this.cos(rec), hat: rec.hat ?? 0, weekly: this.weekly(rec, Date.now()), missions: this.missionsOf(rec) };
  }

  // ------------------------------------------------------------ town: NPCs, missions, the Oracle
  missionsOf(rec: PlayerRec): P.MissionState { return rec.missions ?? (rec.missions = { active: {}, done: {} }); }
  missionViews(rec: PlayerRec, npcId: string, now: number): MissionView[] {
    const ms = this.missionsOf(rec); const today = dayKey(now);
    return MISSIONS.filter((m) => m.npc === npcId).map((m) => {
      const progress = ms.active[m.id] ?? 0;
      const status: MissionView['status'] = ms.done[m.id] === today ? 'done' : m.id in ms.active ? (progress >= m.target ? 'ready' : 'active') : 'available';
      return { ...m, progress: Math.min(progress, m.target), status };
    });
  }
  /** Advance every active mission of this kind; tell the player when one is ready to claim. */
  progress(rec: PlayerRec, kind: MissionKind, n = 1): void {
    const ms = this.missionsOf(rec); let changed = false;
    for (const m of MISSIONS) {
      if (m.kind !== kind || !(m.id in ms.active) || ms.active[m.id] >= m.target) continue;
      ms.active[m.id] = Math.min(m.target, ms.active[m.id] + n); changed = true;
      if (ms.active[m.id] >= m.target) this.sendTo(rec.id, { t: 'toast', text: `${UI.missionReady}: ${m.title}` });
    }
    if (changed) { this.store.touch(); this.pushState(rec, { missions: ms }); }
  }
  npcNear(rec: PlayerRec, l: Live, npcId: string): boolean {
    const n = this.map(rec).npcs.find((x) => x.id === npcId); if (!n) return false;
    return Math.hypot(n.tx * TILE + 16 - l.x, n.ty * TILE + 16 - l.y) <= 56;
  }
  onTalk(l: Live, rec: PlayerRec, npcId: string, now: number): void {
    const npc = npcById(npcId); if (!npc || !this.npcNear(rec, l, npcId)) return;
    const line = npc.lines[Math.floor(this.rng() * npc.lines.length)];
    this.send(l.ws, { t: 'npc', npc: npc.id, name: npc.name, line, missions: this.missionViews(rec, npc.id, now) });
  }
  onMission(l: Live, rec: PlayerRec, id: string, action: 'accept' | 'claim', now: number): void {
    const m = MISSIONS.find((x) => x.id === id); if (!m || !this.npcNear(rec, l, m.npc)) return;
    const ms = this.missionsOf(rec); const today = dayKey(now);
    if (action === 'accept') {
      if (ms.done[m.id] === today) return this.send(l.ws, { t: 'toast', text: UI.missionTomorrow });
      if (m.id in ms.active) return;
      if (Object.keys(ms.active).length >= MISSION_MAX_ACTIVE) return this.send(l.ws, { t: 'toast', text: UI.missionFull });
      ms.active[m.id] = 0; this.send(l.ws, { t: 'toast', text: `${UI.missionAccepted}: ${m.title}` });
    } else {
      if ((ms.active[m.id] ?? -1) < m.target) return;
      delete ms.active[m.id]; ms.done[m.id] = today; this.addSap(rec, m.reward, `mission:${m.id}`);
      this.send(l.ws, { t: 'toast', text: `${UI.missionDone}: ${m.title} (+${m.reward} ${copyJson.ui.sap})` });
      this.send(l.ws, { t: 'say', npc: m.npc, name: npcById(m.npc)!.name, text: m.done, oracle: false });
    }
    this.store.touch(); this.pushState(rec, { sap: rec.sap, missions: ms });
    this.send(l.ws, { t: 'npc', npc: m.npc, name: npcById(m.npc)!.name, line: '', missions: this.missionViews(rec, m.npc, now) });
  }
  async onAsk(l: Live, rec: PlayerRec, npcId: string, text: string, now: number): Promise<void> {
    const npc = npcById(npcId); if (!npc || !this.npcNear(rec, l, npcId)) return;
    if (now - l.lastAskAt < 3000) return; l.lastAskAt = now;
    const q = String(text ?? '').replace(/[<>]/g, '').trim().slice(0, 160); if (!q) return;
    this.progress(rec, 'ask');
    const shrug = () => npc.unsure[Math.floor(this.rng() * npc.unsure.length)];
    const r = await Oracle.ask(Oracle.frame(npc, this.villageName(this.vid(rec)), rec.name, q));
    if (!this.live.has(rec.id)) return;
    if (!r) return this.send(l.ws, { t: 'say', npc: npc.id, name: npc.name, text: shrug(), oracle: false });
    this.send(l.ws, { t: 'say', npc: npc.id, name: npc.name, text: r.withheld ? shrug() : r.text, oracle: !r.withheld });
  }
  /** Defenses as others may see them: a scarecrow reads as a gnome; the bell stays private. */
  publicDefenses(d: Defenses): Defenses { return { gateMax: d.gateMax, gateHp: d.gateHp, gnome: d.gnome || !!d.scarecrow, sprinkler: d.sprinkler, mud: !!d.mud }; }
  publicLot(rec: PlayerRec, now: number): PublicLot {
    return { lotId: rec.lotId, ownerId: rec.id, name: rec.name, color: rec.color, online: this.live.has(rec.id), shielded: this.isShielded(rec, now), plotCount: rec.plotCount, defenses: this.publicDefenses(rec.defenses), land: this.landView(rec), cosmetics: this.cos(rec),
      plots: rec.plots.map((p, i) => p ? ({ i, speciesId: p.speciesId, tier: p.tier, revealed: p.revealed, size: p.size, mutation: p.mutation, lockedUntil: rec.lockedUntil[i] ?? 0, weedy: E.isWeedy(p, now), ...(p.nick ? { nick: p.nick } : {}) }) : null).filter((x): x is P.PublicPlot => !!x) };
  }
  pushLot(rec: PlayerRec): void { this.broadcast(rec.villageId, { t: 'lot', lot: this.publicLot(rec, Date.now()) }); }
  pushState(rec: PlayerRec, part: Partial<PrivateState>): void { this.sendTo(rec.id, { t: 'state', you: part }); }
  names(villageId: string): Record<string, P.NameEntry> {
    const out: Record<string, P.NameEntry> = {};
    for (const l of this.live.values()) { const r = this.players.get(l.id)!; if (this.vid(r) === villageId) out[r.id] = this.nameEntry(r); }
    return out;
  }
  snapOf(villageId: string, now: number): SnapPlayer[] {
    const out: SnapPlayer[] = [];
    for (const l of this.live.values()) {
      const r = this.players.get(l.id)!; if (this.vid(r) !== villageId) continue;
      const s: SnapPlayer = { id: l.id, x: Math.round(l.x), y: Math.round(l.y), d: l.d, f: l.f, m: l.m, c: l.carry ? l.carry.plant.speciesId : '', ch: l.channel ? Math.min(1, (now - l.channel.startedAt) / (l.channel.endsAt - l.channel.startedAt)) : 0 };
      if (this.bountyOn(r, now)) s.b = true;
      out.push(s);
    }
    return out;
  }
  bountyOn(thief: PlayerRec, now: number): P.Bounty | null {
    const v = this.villages.get(thief.villageId); if (!v?.bounties) return null;
    v.bounties = v.bounties.filter((b) => b.until > now);
    return v.bounties.find((b) => b.thiefId === thief.id) ?? null;
  }
  bountiesIn(villageId: string, now: number): P.Bounty[] { const v = this.villages.get(villageId); return (v?.bounties ?? []).filter((b) => b.until > now); }
  addSap(rec: PlayerRec, delta: number, reason: string): void { rec.sap += delta; if (reason !== 'tick') this.store.ledger(rec.id, delta, reason); this.store.touch(); }

  // ------------------------------------------------------------ join / leave
  join(ws: WebSocket, m: Extract<ClientMsg, { t: 'hello' }>): Live | null {
    const now = Date.now();
    const id = String(m.id).replace(/[^a-z0-9]/gi, '').slice(0, 32); const secret = String(m.secret).slice(0, 64);
    if (id.length < 8 || secret.length < 8) { this.send(ws, { t: 'error', text: 'bad identity' }); return null; }
    let rec = this.players.get(id);
    if (rec && rec.secret !== secret) { this.send(ws, { t: 'error', text: 'identity mismatch' }); return null; }
    if (!rec) {
      rec = this.newPlayer(id, secret, m.name, m.save ?? null, now);
      this.feed(rec.villageId, 'join', `${rec.name} moved into lot ${rec.lotId + 1}`);
    } else if (this.live.has(id)) {
      const old = this.live.get(id)!; this.send(old.ws, { t: 'error', text: 'signed in elsewhere' }); old.ws.close(); this.leave(id, true);
    }
    // offline accrual (cap 8 h)
    const elapsed = Math.min(Math.max(0, now - rec.lastSeen), E.OFFLINE_CAP_MS);
    let off = 0; for (const p of rec.plots) if (p) off += E.sapPerSec(p, SP.get(p.speciesId)!) * (elapsed / 1000);
    if (off >= 1) { this.addSap(rec, Math.floor(off), 'offline'); }
    rec.lastSeen = now;
    if (rec.visiting && !this.villages.has(rec.visiting)) rec.visiting = null;
    if (rec.plotCount < DEFAULT_PLOTS) { while (rec.plots.length < DEFAULT_PLOTS) { rec.plots.push(null); rec.lockedUntil.push(0); } rec.plotCount = DEFAULT_PLOTS; this.store.touch(); }
    const spawn = this.spawnFor(rec);
    const live: Live = { id, ws, x: spawn.x, y: spawn.y, d: 'down', f: false, m: false, carry: null, channel: null, shieldUntil: now + GRACE_MS, lastInputAt: now, lastChatAt: 0, connectedAt: now, nonce: null, lastLot: -1, lastAskAt: 0 };
    this.live.set(id, live);
    this.sendWelcome(live, rec, now);
    if (off >= 1) this.send(ws, { t: 'toast', text: `${copyJson.ui.offlineBack} ${Math.floor(off)} ${copyJson.ui.sap}.` });
    this.broadcast(this.vid(rec), { t: 'players', names: { [id]: this.nameEntry(rec) } }, id);
    this.pushLot(rec);
    return live;
  }

  spawnFor(rec: PlayerRec): { x: number; y: number } {
    if (rec.visiting) return this.map(rec).spawn;
    const gate = lotGatePx(this.lot(rec)); const l = this.lot(rec);
    return { x: gate.x + (l.gateSide === 'left' ? -TILE : l.gateSide === 'right' ? TILE : 0), y: gate.y + (l.gateSide === 'top' ? -TILE : l.gateSide === 'bottom' ? TILE : 0) };
  }

  sendWelcome(live: Live, rec: PlayerRec, now: number): void {
    const vid = this.vid(rec); const village = this.villages.get(vid)!; const map = this.maps.get(vid)!;
    const lots = village.lots.map((o) => o ? this.players.get(o) : null).filter((r): r is PlayerRec => !!r).map((r) => this.publicLot(r, now));
    this.send(live.ws, { t: 'welcome', you: this.privateState(rec), village: { id: village.id, seed: village.seed, biome: map.biome, name: this.villageName(vid) }, lots, players: this.snapOf(vid, now), names: this.names(vid), feed: this.feeds.get(vid) ?? [], now, villages: this.villageList() });
    for (const extra of this.life.welcome(vid)) this.send(live.ws, extra);
    this.send(live.ws, this.boardMsg(vid, now));
  }

  // ------------------------------------------------------------ visits (villages are rooms; friends can cross)
  onVisit(l: Live, rec: PlayerRec, villageId: string | null, now: number): void {
    const target = villageId ?? rec.villageId;
    if (!this.villages.has(target) || target === this.vid(rec)) return;
    if (l.carry && villageId) return this.send(l.ws, { t: 'toast', text: UI.cantVisitCarrying });
    if (l.channel) this.cancelChannel(l, UI.channelMoved);
    const from = this.vid(rec);
    this.broadcast(from, { t: 'players', names: {}, left: [rec.id] }, rec.id);
    rec.visiting = villageId && villageId !== rec.villageId ? villageId : null; this.store.touch();
    const spawn = this.spawnFor(rec); l.x = spawn.x; l.y = spawn.y; l.lastLot = -1;
    this.sendWelcome(l, rec, now);
    this.broadcast(this.vid(rec), { t: 'players', names: { [rec.id]: this.nameEntry(rec) } }, rec.id);
    if (rec.visiting) { this.feed(rec.visiting, 'join', `${rec.name} ${UI.visitorArrived} ${this.villageName(rec.villageId)}`); this.progress(rec, 'visit'); }
    else { this.feed(from, 'join', `${rec.name} ${UI.wentHome}`); if (l.carry) this.score(l, rec, now); }
  }

  // ------------------------------------------------------------ phase three: cosmetics, wardrobe, nicknames (pure Sap sinks)
  onCosmetic(l: Live, rec: PlayerRec, item: P.CosmeticItem): void {
    const price = P.COSMETIC_PRICES[item]; if (price === undefined) return;
    const c = this.cos(rec);
    const owned = item === 'fence_wood' ? c.fence === 'wood' : item === 'fence_stone' ? c.fence === 'stone' : item === 'fence_hedge' ? c.fence === 'hedge' : item === 'lantern' ? c.lantern : item === 'nameplate' ? c.nameplate : item === 'path' ? c.path : c.gnomeHat === Number(item.slice(4));
    if (owned) return;
    if (item.startsWith('ghat') && !rec.defenses.gnome && !rec.defenses.scarecrow) return;
    if (rec.sap < price) return this.send(l.ws, { t: 'toast', text: copyJson.ui.cantAfford });
    if (price) this.addSap(rec, -price, `cosmetic:${item}`);
    if (item === 'fence_wood') c.fence = 'wood'; else if (item === 'fence_stone') c.fence = 'stone'; else if (item === 'fence_hedge') c.fence = 'hedge';
    else if (item === 'lantern') c.lantern = true; else if (item === 'nameplate') c.nameplate = true; else if (item === 'path') c.path = true; else c.gnomeHat = Number(item.slice(4));
    this.store.touch(); this.pushState(rec, { sap: rec.sap, cosmetics: c }); this.pushLot(rec);
  }

  onWardrobe(l: Live, rec: PlayerRec, shirt?: number, hat?: number): void {
    let changed = false;
    if (Number.isInteger(shirt) && shirt! >= 0 && shirt! < 6 && shirt !== rec.color) {
      if (rec.sap < P.SHIRT_PRICE) return this.send(l.ws, { t: 'toast', text: copyJson.ui.cantAfford });
      this.addSap(rec, -P.SHIRT_PRICE, 'shirt'); rec.color = shirt!; changed = true;
    }
    if (Number.isInteger(hat) && hat! >= 0 && hat! < P.HAT_COUNT && hat !== (rec.hat ?? 0)) {
      rec.hats = rec.hats ?? [0];
      if (!rec.hats.includes(hat!)) { const price = P.HAT_PRICES[hat!]; if (rec.sap < price) return this.send(l.ws, { t: 'toast', text: copyJson.ui.cantAfford }); this.addSap(rec, -price, `hat:${hat}`); rec.hats.push(hat!); }
      rec.hat = hat!; changed = true;
    }
    if (!changed) return;
    this.store.touch(); this.pushState(rec, { sap: rec.sap, color: rec.color, hat: rec.hat ?? 0 });
    this.broadcast(this.vid(rec), { t: 'players', names: { [rec.id]: this.nameEntry(rec) } }); this.pushLot(rec);
  }

  onNick(rec: PlayerRec, plotId: number, name: string): void {
    const p = rec.plots[plotId]; if (!p) return;
    const n = String(name ?? '').replace(/[^\w \-'.!?]/g, '').trim().slice(0, 14);
    p.nick = n || undefined; this.store.touch(); this.pushState(rec, { plots: rec.plots }); this.pushLot(rec);
  }

  onBounty(l: Live, rec: PlayerRec, thiefId: string, amount: number, now: number): void {
    const thief = this.players.get(thiefId); const a = Math.floor(Number(amount));
    if (!thief || thief.id === rec.id || !Number.isFinite(a) || a < P.BOUNTY_MIN_POST || a > P.BOUNTY_MAX_POST) return;
    if (!(rec.stolenBy ?? []).some((t) => t.id === thiefId && now - t.at < P.BOUNTY_TTL_MS)) return;
    if (rec.sap < a) return this.send(l.ws, { t: 'toast', text: copyJson.ui.cantAfford });
    const v = this.villages.get(thief.villageId)!; v.bounties = (v.bounties ?? []).filter((b) => b.until > now && b.thiefId !== thiefId);
    const prev = this.bountyOn(thief, now); const total = a + (prev?.amount ?? 0);
    v.bounties.push({ thiefId, thiefName: thief.name, byName: rec.name, amount: total, until: now + P.BOUNTY_TTL_MS });
    this.addSap(rec, -a, `bounty:${thiefId}`); this.pushState(rec, { sap: rec.sap });
    this.send(l.ws, { t: 'toast', text: `${UI.bountyPosted} ${thief.name}: ${total} ${copyJson.ui.sap}` });
    for (const vid of new Set([this.vid(rec), thief.villageId, this.vid(thief)])) { this.feed(vid, 'tag', `${rec.name} posted a ${total} Sap bounty on ${thief.name}`); this.broadcast(vid, this.boardMsg(vid, now)); }
  }

  newPlayer(id: string, secret: string, name: string, save: GameState | null, now: number): PlayerRec {
    // find a village with a free lot
    let village = [...this.villages.values()].find((v) => v.lots.some((x) => !x));
    if (!village) {
      village = { id: `v${this.nextVillage}`, seed: (randomSeed() % 100000) + this.nextVillage * 7, lots: Array(LOT_CAP).fill(null), n: this.nextVillage };
      this.nextVillage += 1; this.villages.set(village.id, village); this.maps.set(village.id, buildVillage(village.seed));
    }
    const lotId = village.lots.findIndex((x) => !x);
    const plotCount = DEFAULT_PLOTS;
    const rec: PlayerRec = {
      id, secret, name: cleanName(name) || `Gardener ${Math.floor(Math.random() * 900 + 100)}`, color: Math.floor(Math.random() * 6),
      sap: E.STARTING_SAP, seeds: [], plots: Array(plotCount).fill(null), plotCount, lockedUntil: Array(plotCount).fill(0),
      conveyor: { slots: E.rollConveyor(this.rng, ROSTER, 'common', plotCount), refreshAt: now + E.CONVEYOR_REFRESH_MS },
      speedLevel: 0, rarityFloor: 'common', defenses: { gateMax: 0, gateHp: 0, gnome: false, sprinkler: false, scarecrow: false, mud: false, bell: false },
      villageId: village.id, lotId, createdAt: now, lastSeen: now,
      stats: { seedsBought: 0, reveals: 0, steals: 0, tags: 0, stolenFrom: 0 }, stolenLog: [],
      address: null, garden: null, visiting: null, stolenBy: [],
    };
    // migrate the M1 local save once
    if (save && typeof save.sap === 'number') {
      rec.sap = Math.min(Math.max(0, Math.floor(save.sap)), 50000);
      rec.seeds = (save.seeds ?? []).slice(0, 40);
      (save.plots ?? []).slice(0, plotCount).forEach((p, i) => { if (p?.plant) rec.plots[i] = p.plant; });
      rec.speedLevel = Math.min(E.SPEED_MAX_LEVEL, save.speedLevel ?? 0);
      rec.stats.seedsBought = save.stats?.seedsBought ?? 0; rec.stats.reveals = save.stats?.reveals ?? 0;
    }
    village.lots[lotId] = id; this.players.set(id, rec); this.store.touch();
    return rec;
  }

  leave(id: string, silent = false): void {
    const l = this.live.get(id); if (!l) return;
    const rec = this.players.get(id)!;
    if (l.carry) this.recover(l, rec, null, Date.now(), false);
    l.channel = null;
    this.live.delete(id);
    rec.lastSeen = Date.now(); this.store.touch();
    if (!silent) { this.broadcast(this.vid(rec), { t: 'players', names: {}, left: [id] }); this.pushLot(rec); }
  }

  // ------------------------------------------------------------ messages
  handle(l: Live, m: ClientMsg): void | Promise<void> {
    const rec = this.players.get(l.id)!; const now = Date.now();
    switch (m.t) {
      case 'forage': return this.life.forage(l, rec, String(m.id));
      case 'sprint': return this.life.sprintStart(l, rec, now);
      case 'bounty': return this.onBounty(l, rec, String(m.thiefId), m.amount, now);
      case 'visit': return this.onVisit(l, rec, String(m.village), now);
      case 'home': return this.onVisit(l, rec, null, now);
      case 'villages': return this.send(l.ws, { t: 'villages', list: this.villageList() });
      case 'nonce': return this.onNonce(l, m.address, now);
      case 'link': return this.onLink(l, rec, m.address, m.signature, now);
      case 'unlink': rec.address = null; rec.garden = null; rec.rarityFloor = 'common'; this.store.touch(); this.pushState(rec, { rarityFloor: 'common', land: this.landView(rec) }); this.send(l.ws, { t: 'linked', address: null, land: this.landView(rec), plotCount: rec.plotCount, rarityFloor: rec.rarityFloor }); this.pushLot(rec); return;
      case 'input': return this.onInput(l, rec, m, now);
      case 'buy': return this.onBuy(l, rec, m.slot);
      case 'plant': return this.onPlant(l, rec, m.seedUid, m.plotId, now);
      case 'tend': return this.onTend(l, rec, m.plotId, now);
      case 'shop': return this.onShop(l, rec, m.item, m.plotId, now);
      case 'uproot': return this.onUproot(l, rec, m.ownerId, m.plotId, now);
      case 'break': return this.onBreak(l, rec, m.ownerId, now);
      case 'cancel': l.channel = null; this.send(l.ws, { t: 'channel', kind: null, endsAt: 0, startedAt: 0 }); return;
      case 'chat': return this.onChat(l, rec, m.text, now);
      case 'emote': if (Number.isInteger(m.e) && m.e >= 0 && m.e < P.EMOTES.length) this.broadcast(this.vid(rec), { t: 'emote', id: l.id, e: m.e }); return;
      case 'rename': { const n = cleanName(m.name); if (n) { rec.name = n; this.store.touch(); this.pushState(rec, { name: n }); this.broadcast(this.vid(rec), { t: 'players', names: { [rec.id]: this.nameEntry(rec) } }); this.pushLot(rec); } return; }
      case 'cosmetic': return this.onCosmetic(l, rec, m.item);
      case 'wardrobe': return this.onWardrobe(l, rec, m.shirt, m.hat);
      case 'nick': return this.onNick(rec, m.plotId, m.name);
      case 'talk': return this.onTalk(l, rec, String(m.npc), now);
      case 'mission': return this.onMission(l, rec, String(m.id), m.action === 'claim' ? 'claim' : 'accept', now);
      case 'ask': return this.onAsk(l, rec, String(m.npc), String(m.text), now);
      case 'ping': this.send(l.ws, { t: 'pong', n: m.n, now }); return;
    }
  }

  // ------------------------------------------------------------ wallet link (read-only; a free signature proves control — I-1/I-2)
  onNonce(l: Live, address: string, now: number): void {
    const a = String(address).toLowerCase(); if (!/^0x[0-9a-f]{40}$/.test(a)) return;
    l.nonce = { value: newNonce(), address: a, issuedAt: new Date(now).toISOString(), at: now };
    this.send(l.ws, { t: 'nonce', address: a, message: signMessage(a, l.nonce.value, l.nonce.issuedAt) });
  }

  async onLink(l: Live, rec: PlayerRec, address: string, signature: string, now: number): Promise<void> {
    const a = String(address).toLowerCase(); const n = l.nonce; l.nonce = null;
    if (!n || n.address !== a || now - n.at > 10 * 60_000) return this.send(l.ws, { t: 'toast', text: UI.linkFail });
    if (!verifySignature(signMessage(a, n.value, n.issuedAt), String(signature), a)) return this.send(l.ws, { t: 'toast', text: UI.linkFail });
    const other = [...this.players.values()].find((r) => r.address === a && r.id !== rec.id);
    if (other) {
      // Wallet sign-in: the wallet already owns a garden, so this device becomes that player.
      // A fresh device secret is issued for it; the guest record this socket started as is left untouched.
      if (this.live.has(other.id)) { const o = this.live.get(other.id)!; this.send(o.ws, { t: 'error', text: 'signed in elsewhere' }); o.ws.close(); this.leave(other.id, true); }
      other.secret = newNonce() + newNonce(); this.store.touch();
      this.send(l.ws, { t: 'identity', id: other.id, secret: other.secret, name: other.name });
      this.send(l.ws, { t: 'toast', text: UI.adopted });
      return;
    }
    let spec: GardenSpec;
    try { spec = deriveGarden(a, await this.reader.snapshot(a)); } catch (e) { console.error('derive', e); return this.send(l.ws, { t: 'toast', text: UI.linkFail }); }
    if (!this.live.has(rec.id)) return;
    this.applyGarden(rec, spec, now);
    this.send(l.ws, { t: 'linked', address: a, land: this.landView(rec), plotCount: rec.plotCount, rarityFloor: rec.rarityFloor });
    this.send(l.ws, { t: 'toast', text: UI.linkOk });
    this.feed(rec.villageId, 'join', `${rec.name} claimed their land (${rec.plotCount} plots)`);
  }

  applyGarden(rec: PlayerRec, spec: GardenSpec, now: number): void {
    rec.address = spec.address; rec.garden = spec;
    const count = Math.max(rec.plotCount, spec.plotCount); // land never shrinks under planted crops
    while (rec.plots.length < count) { rec.plots.push(null); rec.lockedUntil.push(0); }
    rec.plotCount = count; rec.rarityFloor = spec.rarityFloor;
    rec.conveyor = { slots: E.rollConveyor(this.rng, ROSTER, rec.rarityFloor, rec.plotCount, spec.hybridsUnlocked), refreshAt: now + E.CONVEYOR_REFRESH_MS };
    this.store.touch();
    this.pushState(rec, { plots: rec.plots, plotCount: rec.plotCount, lockedUntil: rec.lockedUntil, rarityFloor: rec.rarityFloor, conveyor: rec.conveyor, land: this.landView(rec) });
    this.pushLot(rec);
  }

  onInput(l: Live, rec: PlayerRec, m: Extract<ClientMsg, { t: 'input' }>, now: number): void {
    const dt = Math.min(0.5, (now - l.lastInputAt) / 1000); l.lastInputAt = now;
    const max = this.speedOf(l, rec, now) * dt * 1.35 + 6;
    const x = Number(m.x); const y = Number(m.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const dist = Math.hypot(x - l.x, y - l.y);
    if (dist <= max) {
      // accept the client's predicted position only if the path is walkable (collision re-check)
      const gc = this.gateClosedFn(this.vid(rec));
      const r = moveActor(this.map(rec), l.x, l.y, x - l.x, y - l.y, gc);
      l.x = r.x; l.y = r.y;
    }
    l.d = (['down', 'up', 'side'] as Dir[]).includes(m.d) ? m.d : 'down'; l.f = !!m.f; l.m = !!m.m || dist > 0.5;
    if (l.channel && Math.hypot(l.x - l.channel.sx, l.y - l.channel.sy) > 6) this.cancelChannel(l, copyJson.ui.channelMoved);
  }

  onBuy(l: Live, rec: PlayerRec, i: number): void {
    const slot = rec.conveyor.slots[i]; if (!slot || slot.sold) return;
    if (rec.sap < slot.price) return this.send(l.ws, { t: 'toast', text: copyJson.ui.cantAfford });
    this.addSap(rec, -slot.price, `buy:${slot.speciesId}`); slot.sold = true;
    rec.seeds.push({ uid: uid('s'), speciesId: slot.speciesId, tier: slot.tier }); rec.stats.seedsBought += 1;
    this.pushState(rec, { sap: rec.sap, seeds: rec.seeds, conveyor: rec.conveyor, stats: rec.stats }); this.progress(rec, 'buy');
  }

  onPlant(l: Live, rec: PlayerRec, seedUid: string, plotId: number, now: number): void {
    const idx = rec.seeds.findIndex((s) => s.uid === seedUid);
    if (idx < 0 || !Number.isInteger(plotId) || plotId < 0 || plotId >= rec.plotCount || rec.plots[plotId]) return;
    const seed = rec.seeds.splice(idx, 1)[0];
    rec.plots[plotId] = { uid: uid('p'), speciesId: seed.speciesId, tier: seed.tier, plantedAt: now, growMs: E.GROW_MS[seed.tier], revealed: false, size: 1, mutation: 'none', watered: false, lastWeeded: now };
    this.store.touch(); this.pushState(rec, { seeds: rec.seeds, plots: rec.plots }); this.pushLot(rec); this.progress(rec, 'plant');
  }

  onTend(l: Live, rec: PlayerRec, plotId: number, now: number): void {
    const p = rec.plots[plotId]; if (!p) return;
    if (!p.revealed) {
      if (p.watered) return this.send(l.ws, { t: 'toast', text: `${copyJson.ui.growing}: ${fmt(p.plantedAt + p.growMs - now)}` });
      p.growMs -= Math.round(Math.max(0, p.plantedAt + p.growMs - now) * E.WATER_BONUS); p.watered = true;
      this.send(l.ws, { t: 'toast', text: `${copyJson.ui.watered}.` });
    } else {
      if (now - p.lastWeeded < E.WEED_COOLDOWN_MS) return this.send(l.ws, { t: 'toast', text: `${SP.get(p.speciesId)!.name}: ${Math.round(E.sapPerSec(p, SP.get(p.speciesId)!) * 100) / 100} ${copyJson.ui.sapPerSec}` });
      const wasWeedy = E.isWeedy(p, now); p.lastWeeded = now;
      const bonus = Math.floor(E.sapPerSec(p, SP.get(p.speciesId)!, now) * E.WEED_BONUS_SEC); this.addSap(rec, bonus, 'weed');
      this.send(l.ws, { t: 'toast', text: `${wasWeedy ? UI.weedsPulled : copyJson.ui.weeded}! +${bonus} ${copyJson.ui.sap}` });
      if (wasWeedy) this.pushLot(rec);
    }
    this.store.touch(); this.pushState(rec, { sap: rec.sap, plots: rec.plots }); this.progress(rec, 'tend');
  }

  onShop(l: Live, rec: PlayerRec, item: string, plotId: number | undefined, now: number): void {
    const deny = (t: string) => this.send(l.ws, { t: 'toast', text: t });
    const pay = (cost: number, reason: string) => { if (rec.sap < cost) { deny(copyJson.ui.cantAfford); return false; } this.addSap(rec, -cost, reason); return true; };
    if (item === 'train') { if (rec.speedLevel >= E.SPEED_MAX_LEVEL) return; if (!pay(E.speedCost(rec.speedLevel), 'train')) return; rec.speedLevel += 1; }
    else if (item === 'fence') { if (rec.defenses.gateMax) return; if (!pay(P.SHOP_PRICES.fence, 'fence')) return; rec.defenses.gateMax = 3; rec.defenses.gateHp = 3; }
    else if (item === 'repair') { if (!rec.defenses.gateMax || rec.defenses.gateHp === rec.defenses.gateMax) return; if (!pay(P.SHOP_PRICES.repair, 'repair')) return; rec.defenses.gateHp = rec.defenses.gateMax; }
    else if (item === 'gnome') { if (rec.defenses.gnome || rec.plotCount < 4) return; if (!pay(P.SHOP_PRICES.gnome, 'gnome')) return; rec.defenses.gnome = true; }
    else if (item === 'sprinkler') { if (rec.defenses.sprinkler) return; if (!pay(P.SHOP_PRICES.sprinkler, 'sprinkler')) return; rec.defenses.sprinkler = true; }
    else if (item === 'lock') { if (plotId === undefined || !rec.plots[plotId] || (rec.lockedUntil[plotId] ?? 0) > now) return; if (!pay(P.SHOP_PRICES.lock, 'lock')) return; rec.lockedUntil[plotId] = now + P.LOCK_MS; }
    else if (item === 'scarecrow') { if (rec.defenses.scarecrow || rec.defenses.gnome) return; if (!pay(P.SHOP_PRICES.scarecrow, 'scarecrow')) return; rec.defenses.scarecrow = true; }
    else if (item === 'mud') { if (rec.defenses.mud) return; if (!pay(P.SHOP_PRICES.mud, 'mud')) return; rec.defenses.mud = true; }
    else if (item === 'bell') { if (rec.defenses.bell) return; if (!pay(P.SHOP_PRICES.bell, 'bell')) return; rec.defenses.bell = true; }
    else return;
    this.store.touch(); this.pushState(rec, { sap: rec.sap, speedLevel: rec.speedLevel, defenses: rec.defenses, lockedUntil: rec.lockedUntil }); this.pushLot(rec);
  }

  // ------------------------------------------------------------ the raid
  onUproot(l: Live, rec: PlayerRec, ownerId: string, plotId: number, now: number): void {
    const deny = (t: string) => this.send(l.ws, { t: 'toast', text: t });
    const owner = this.players.get(ownerId);
    if (!owner || owner.id === rec.id || owner.villageId !== this.vid(rec) || l.carry || l.channel) return;
    const inLot = lotAtPx(this.map(rec), l.x, l.y); if (!inLot || inLot.id !== owner.lotId) return deny(copyJson.ui.raidNotInLot);
    if (this.isShielded(owner, now)) return deny(copyJson.ui.raidShielded);
    const p = owner.plots[plotId]; if (!p || !p.revealed) return deny(copyJson.ui.raidNotReady);
    if ((owner.lockedUntil[plotId] ?? 0) > now) return deny(copyJson.ui.raidLocked);
    const hourAgo = now - 3600_000; owner.stolenLog = owner.stolenLog.filter((t) => t > hourAgo);
    if (owner.stolenLog.length >= P.STEAL_CAP_PER_HOUR) return deny(copyJson.ui.raidCapped);
    if (p.tier === 'mythic') { const ol = this.live.get(owner.id); const oin = ol && !owner.visiting ? lotAtPx(this.homeMap(owner), ol.x, ol.y) : null; if (!oin || oin.id !== owner.lotId) return deny(copyJson.ui.raidMythic); }
    if (!rec.plots.some((x) => !x)) return deny(copyJson.ui.noFreePlot);
    const pp = this.map(rec).lots[owner.lotId].plots[plotId]; if (Math.hypot(pp.tx * TILE + 16 - l.x, pp.ty * TILE + 16 - l.y) > 40) return deny(copyJson.ui.raidTooFar);
    l.channel = { kind: 'uproot', target: owner.id, plotId, startedAt: now, endsAt: now + P.UPROOT_MS, sx: l.x, sy: l.y };
    this.send(l.ws, { t: 'channel', kind: 'uproot', endsAt: l.channel.endsAt, startedAt: now });
    this.sendTo(owner.id, { t: 'toast', text: `${rec.name} ${copyJson.ui.raidWarning} ${SP.get(p.speciesId)!.name}!` });
  }

  onBreak(l: Live, rec: PlayerRec, ownerId: string, now: number): void {
    const deny = (t: string) => this.send(l.ws, { t: 'toast', text: t });
    const owner = this.players.get(ownerId);
    if (!owner || owner.id === rec.id || owner.villageId !== this.vid(rec) || l.carry || l.channel) return;
    if (owner.defenses.gateHp <= 0) return;
    if (this.isShielded(owner, now)) return deny(copyJson.ui.raidShielded);
    const g = lotGatePx(this.lot(owner)); if (Math.hypot(g.x - l.x, g.y - l.y) > 48) return deny(copyJson.ui.raidTooFar);
    l.channel = { kind: 'break', target: owner.id, plotId: -1, startedAt: now, endsAt: now + P.BREAK_HIT_MS, sx: l.x, sy: l.y };
    this.send(l.ws, { t: 'channel', kind: 'break', endsAt: l.channel.endsAt, startedAt: now });
    this.feed(owner.villageId, 'break', `${rec.name} is breaking ${owner.name}'s gate!`);
  }

  cancelChannel(l: Live, why: string): void {
    if (!l.channel) return; l.channel = null;
    this.send(l.ws, { t: 'channel', kind: null, endsAt: 0, startedAt: 0 }); this.send(l.ws, { t: 'toast', text: why });
  }

  completeChannel(l: Live, rec: PlayerRec, now: number): void {
    const ch = l.channel!; l.channel = null; this.send(l.ws, { t: 'channel', kind: null, endsAt: 0, startedAt: 0 });
    const owner = this.players.get(ch.target); if (!owner) return;
    if (ch.kind === 'break') {
      owner.defenses.gateHp = Math.max(0, owner.defenses.gateHp - 1); this.store.touch(); this.pushLot(owner); this.pushState(owner, { defenses: owner.defenses });
      if (owner.defenses.gateHp === 0) this.feed(owner.villageId, 'gate', `${rec.name} broke ${owner.name}'s gate open`);
      return;
    }
    const p = owner.plots[ch.plotId]; if (!p || this.isShielded(owner, now)) return;
    owner.plots[ch.plotId] = null; l.carry = { plant: p, from: owner.id, fromPlot: ch.plotId };
    this.store.touch(); this.pushLot(owner); this.pushState(owner, { plots: owner.plots });
    this.send(l.ws, { t: 'carry', speciesId: p.speciesId });
    this.feed(owner.villageId, 'uproot', `${rec.name} uprooted ${owner.name}'s ${this.plantName(p)}!`);
  }

  /** Plant returns to its owner. tagger = who tagged (bounty) or null (disconnect). */
  recover(l: Live, thief: PlayerRec, tagger: PlayerRec | null, now: number, bounty: boolean): void {
    const c = l.carry; if (!c) return; l.carry = null;
    const owner = this.players.get(c.from);
    this.send(l.ws, { t: 'carry', speciesId: null });
    if (!owner) return;
    const sp = SP.get(c.plant.speciesId)!;
    if (!owner.plots[c.fromPlot]) owner.plots[c.fromPlot] = c.plant;
    else { const free = owner.plots.findIndex((x) => !x); if (free >= 0) owner.plots[free] = c.plant; else owner.seeds.push({ uid: uid('s'), speciesId: c.plant.speciesId, tier: c.plant.tier }); }
    if (bounty && tagger) {
      const b = Math.max(P.BOUNTY_MIN, Math.floor(E.sapPerSec(c.plant, sp) * P.BOUNTY_SEC)); this.addSap(tagger, b, 'bounty'); tagger.stats.tags += 1; this.weekly(tagger, now).tags += 1;
      this.feed(this.vid(thief), 'tag', `${tagger.name} tagged ${thief.name} and got the ${this.plantName(c.plant)} back (+${b} Sap)`);
      const posted = this.bountyOn(thief, now);
      if (posted) {
        const v = this.villages.get(thief.villageId)!; v.bounties = (v.bounties ?? []).filter((x) => x.thiefId !== thief.id);
        this.addSap(tagger, posted.amount, `bounty-claim:${thief.id}`);
        for (const vid of new Set([this.vid(thief), thief.villageId])) { this.feed(vid, 'tag', `${tagger.name} ${UI.bountyClaimed} ${thief.name} (+${posted.amount} Sap)`); this.broadcast(vid, this.boardMsg(vid, now)); }
      }
      this.pushState(tagger, { sap: tagger.sap, stats: tagger.stats, weekly: this.weekly(tagger, now) }); this.progress(tagger, 'tag');
    }
    this.store.touch(); this.pushLot(owner); this.pushState(owner, { plots: owner.plots, seeds: owner.seeds });
  }

  score(l: Live, thief: PlayerRec, now: number): void {
    const c = l.carry!; const free = thief.plots.findIndex((x) => !x);
    if (free < 0) return; // keep carrying until a plot frees up
    l.carry = null; this.send(l.ws, { t: 'carry', speciesId: null });
    const sp = SP.get(c.plant.speciesId)!; c.plant.lastWeeded = now; thief.plots[free] = c.plant; thief.stats.steals += 1;
    const wk = this.weekly(thief, now); wk.steals += 1; if (E.tierIndex(c.plant.tier) > wk.heistTier) { wk.heistTier = E.tierIndex(c.plant.tier); wk.heistSpecies = c.plant.speciesId; }
    const owner = this.players.get(c.from);
    if (owner) {
      owner.stats.stolenFrom += 1; owner.stolenLog.push(now);
      owner.stolenBy = (owner.stolenBy ?? []).filter((t) => now - t.at < P.BOUNTY_TTL_MS && t.id !== thief.id).concat([{ id: thief.id, name: thief.name, at: now }]).slice(-10);
      this.pushState(owner, { stats: owner.stats, stolenBy: owner.stolenBy });
    }
    this.store.touch(); this.store.ledger(thief.id, 0, `steal:${c.plant.uid}:from:${c.from}`);
    this.pushState(thief, { plots: thief.plots, stats: thief.stats, weekly: wk }); this.pushLot(thief); this.progress(thief, 'steal');
    const mut = c.plant.mutation !== 'none' ? ` (${MUT[c.plant.mutation]})` : '';
    for (const vid of new Set([thief.villageId, owner?.villageId ?? thief.villageId])) { this.feed(vid, 'steal', `${thief.name} stole ${owner?.name ?? 'someone'}'s ${this.plantName(c.plant)}${mut}`); this.broadcast(vid, this.boardMsg(vid, now)); }
  }

  onChat(l: Live, rec: PlayerRec, text: string, now: number): void {
    if (now - l.lastChatAt < 700) return; l.lastChatAt = now;
    const t = String(text).replace(/[<>]/g, '').trim().slice(0, 80); if (!t) return;
    this.broadcast(this.vid(rec), { t: 'chat', id: rec.id, name: rec.name, text: t });
  }

  // ------------------------------------------------------------ ticks
  tick(now: number): void {
    this.life.tick(now);
    for (const l of this.live.values()) {
      const rec = this.players.get(l.id)!;
      // gate bell: owner hears about anyone stepping into their lot
      const here = lotAtPx(this.map(rec), l.x, l.y)?.id ?? -1;
      if (here !== l.lastLot) {
        l.lastLot = here;
        if (here >= 0) { const owner = this.ownerOfLot(this.vid(rec), here); const ol = owner && this.live.get(owner.id); if (owner && ol && owner.id !== rec.id && owner.defenses.bell && !(this.vid(owner) === owner.villageId && lotAtPx(this.homeMap(owner), ol.x, ol.y)?.id === owner.lotId)) this.send(ol.ws, { t: 'toast', text: `${UI.bell} ${rec.name} ${UI.bellEntered}` }); }
      }
      if (l.channel) {
        const owner = this.players.get(l.channel.target); const ol = owner ? this.live.get(owner.id) : null;
        if (ol && Math.hypot(ol.x - l.x, ol.y - l.y) < P.TAG_RADIUS) { this.cancelChannel(l, copyJson.ui.raidInterrupted); this.sendTo(owner!.id, { t: 'toast', text: `${copyJson.ui.raidYouInterrupted} ${rec.name}` }); continue; }
        if (owner && owner.defenses.gnome && l.channel.kind === 'uproot') { const g = this.gnomePos(owner, now); if (Math.hypot(g.x - l.x, g.y - l.y) < P.GNOME_RADIUS) { this.cancelChannel(l, copyJson.ui.raidGnome); continue; } }
        if (now >= l.channel.endsAt) this.completeChannel(l, rec, now);
      }
      if (l.carry) {
        const owner = this.players.get(l.carry.from); const ol = owner ? this.live.get(owner.id) : null;
        if (owner && ol && Math.hypot(ol.x - l.x, ol.y - l.y) < P.TAG_RADIUS) { this.recover(l, rec, owner, now, true); continue; }
        if (owner && owner.defenses.gnome) { const inLot = lotAtPx(this.map(rec), l.x, l.y); if (inLot && inLot.id === owner.lotId) { const g = this.gnomePos(owner, now); if (Math.hypot(g.x - l.x, g.y - l.y) < P.GNOME_RADIUS) { this.recover(l, rec, owner, now, true); continue; } } }
        const mine = lotAtPx(this.map(rec), l.x, l.y); if (!rec.visiting && mine && mine.id === rec.lotId) this.score(l, rec, now);
      }
    }
  }

  snapshot(now: number): void {
    for (const vid of this.villages.keys()) {
      const p = this.snapOf(vid, now); if (p.length) this.broadcast(vid, { t: 'snap', now, p });
    }
  }

  economy(now: number): void {
    this.life.second(now);
    for (const l of this.live.values()) {
      const rec = this.players.get(l.id)!; let sps = 0; let changed = false;
      for (let i = 0; i < rec.plots.length; i++) {
        const p = rec.plots[i]; if (!p) continue;
        if (!p.revealed && now >= p.plantedAt + p.growMs) {
          const r = E.rollReveal(this.rng); p.revealed = true; p.size = r.size; p.mutation = this.life.goldenReroll(rec.villageId, r.mutation, this.rng) as typeof r.mutation; p.lastWeeded = now; rec.stats.reveals += 1; changed = true;
          this.send(l.ws, { t: 'reveal', plant: p }); this.progress(rec, 'reveal');
          if (p.mutation !== 'none') this.feed(rec.villageId, 'reveal', `${rec.name}'s ${SP.get(p.speciesId)!.name} sprouted ${MUT[p.mutation]}`);
        }
        if (p.revealed) sps += E.sapPerSec(p, SP.get(p.speciesId)!);
      }
      if (sps > 0) this.addSap(rec, sps, 'tick');
      if (now >= rec.conveyor.refreshAt) { rec.conveyor = { slots: E.rollConveyor(this.rng, ROSTER, rec.rarityFloor, rec.plotCount, rec.garden?.hybridsUnlocked ?? false), refreshAt: now + E.CONVEYOR_REFRESH_MS }; changed = true; this.send(l.ws, { t: 'toast', text: `${copyJson.ui.conveyor}: ${copyJson.ui.newSeeds}` }); }
      this.pushState(rec, changed ? { sap: rec.sap, plots: rec.plots, conveyor: rec.conveyor, stats: rec.stats } : { sap: rec.sap });
      if (changed) this.pushLot(rec);
      // shield expiry flips the public lot flag
      if (Math.abs(now - l.shieldUntil) < 1000) this.pushLot(rec);
    }
  }
}

function cleanName(n: unknown): string { return String(n ?? '').replace(/[^\w \-'.]/g, '').trim().slice(0, 16); }
function fmt(ms: number): string { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`; }
