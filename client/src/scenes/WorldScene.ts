import Phaser from 'phaser';
import type { Plant, Tier } from '@shared/types';
import * as E from '@shared/economy';
import * as P from '@shared/protocol';
import type { ServerMsg, PrivateState, PublicLot, SnapPlayer, Dir, FeedEvent } from '@shared/protocol';
import { buildVillage, moveActor, findPath, lotAtPx, lotGatePx, TILE, TILE_STRIDE, T, VILLAGE_W, VILLAGE_H, type Village, type Lot } from '@shared/world';
import { speciesById, COPY } from '../content';
import { Net, wsUrl, loadIdentity, newIdentity, saveIdentity, type Identity } from '../net';
import { hasWallet, connectAddress, signMessageWith } from '../wallet';
import { BIOME_COUNT } from '@shared/derive/constants';
import { npcById } from '@shared/missions';
import { takeLegacySave } from '../state';
import { Hud } from '../ui/hud';
import { sfx } from '../audio';

const INTERACT_RADIUS = 40;

interface LotView {
  lot: PublicLot;
  geo: Lot;
  sign: Phaser.GameObjects.Text;
  plants: Map<number, Phaser.GameObjects.Sprite>;
  fx: Map<number, Phaser.GameObjects.GameObject[]>;
  locks: Map<number, Phaser.GameObjects.Image>;
  gnome: Phaser.GameObjects.Sprite | null;
  sprinkler: Phaser.GameObjects.Sprite | null;
  landKey: string;
  landObjs: Phaser.GameObjects.GameObject[];
}
interface Remote { sprite: Phaser.GameObjects.Sprite; tag: Phaser.GameObjects.Text; tx: number; ty: number; d: Dir; f: boolean; m: boolean; carry: Phaser.GameObjects.Image | null; carryId: string; bubble: Phaser.GameObjects.Text | null; bubbleUntil: number; color: number; hat: number; }

export class WorldScene extends Phaser.Scene {
  net!: Net;
  identity!: Identity;
  hud!: Hud;
  you: PrivateState | null = null;
  village: Village | null = null;
  villageName = '';
  layer!: Phaser.Tilemaps.TilemapLayer;
  lots = new Map<string, LotView>();
  names = new Map<string, P.NameEntry>();
  nickText!: Phaser.GameObjects.Text;
  remotes = new Map<string, Remote>();
  feed: FeedEvent[] = [];
  player!: Phaser.GameObjects.Sprite;
  myTag!: Phaser.GameObjects.Text;
  myCarry: Phaser.GameObjects.Image | null = null;
  myBubble: Phaser.GameObjects.Text | null = null;
  myBubbleUntil = 0;
  channel: { kind: 'uproot' | 'break'; start: number; dur: number } | null = null;
  carrying: string | null = null;
  bar!: Phaser.GameObjects.Graphics;
  highlight!: Phaser.GameObjects.Graphics;
  night!: Phaser.GameObjects.Rectangle;
  lamps: Phaser.GameObjects.Image[] = [];
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  joy = { x: 0, y: 0 };
  path: { x: number; y: number }[] = [];
  pathAct: (() => void) | null = null;
  selectedSeed: string | null = null;
  lockMode = false;
  dir: Dir = 'down'; flip = false; moving = false;
  lastSend = 0; hue = 0; ready = false;
  villageBiome = 0;
  linking = false;
  wilds = new Map<string, { w: P.Wild; sprite: Phaser.GameObjects.Sprite; glow: Phaser.GameObjects.Image }>();
  event: P.VillageEvent | null = null;
  board: P.SprintEntry[] = [];
  sprintStartedAt = 0;
  lastSecond = 0; lastStep = 0;
  villageId = '';
  villages: P.VillageInfo[] = [];
  bounties: P.Bounty[] = [];
  trophies: P.Trophies | null = null;
  npcSprites = new Map<string, Phaser.GameObjects.Sprite>();
  wanted = new Map<string, Phaser.GameObjects.Text>();

  constructor() { super('world'); }

  // ------------------------------------------------------------ boot
  create(): void {
    (window as unknown as { pons: WorldScene }).pons = this;
    this.hud = new Hud(this);
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D,E,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown-E', () => this.interactNearest());
    this.input.keyboard!.on('keydown-SPACE', () => this.interactNearest());
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p.worldX, p.worldY));
    this.input.once('pointerdown', () => sfx.unlock());
    this.input.keyboard!.once('keydown', () => sfx.unlock());
    this.input.keyboard!.on('keydown-Z', () => this.toggleZoom());
    const id = loadIdentity();
    if (id) this.start(id);
    else this.hud.askName((name, walletId) => { this.start(newIdentity(name)); if (walletId) this.pendingWallet = walletId; });
  }
  pendingWallet: string | null = null;

  start(id: Identity): void {
    this.identity = id;
    this.hud.toast(COPY.connecting, 4000);
    this.net = new Net(wsUrl());
    this.net.onOpen = () => this.net.send({ t: 'hello', id: id.id, secret: id.secret, name: id.name, save: takeLegacySave() });
    this.net.onClose = () => { if (this.ready) this.hud.toast(COPY.disconnected, 3000); };
    this.net.onMsg = (m) => this.onMsg(m);
    this.net.connect();
  }

  // ------------------------------------------------------------ world build
  buildWorld(seed: number, biome: number): void {
    const v = buildVillage(seed); this.village = v;
    const rows: number[][] = [];
    for (let y = 0; y < VILLAGE_H; y++) { const r: number[] = []; for (let x = 0; x < VILLAGE_W; x++) r.push(v.grid[y * VILLAGE_W + x]); rows.push(r); }
    // every biome tileset lives in one layer (gid = biome*16 + tile) so each lot can wear its wallet's biome
    for (const r of rows) for (let i = 0; i < r.length; i++) r[i] += biome * TILE_STRIDE;
    const map = this.make.tilemap({ data: rows, tileWidth: TILE, tileHeight: TILE });
    const sets: Phaser.Tilemaps.Tileset[] = [];
    for (let b = 0; b < BIOME_COUNT; b++) sets.push(map.addTilesetImage(`tiles_b${b}`, `tiles_b${b}`, TILE, TILE, 0, 0, b * TILE_STRIDE)!);
    this.layer = map.createLayer(0, sets, 0, 0)!.setDepth(0);
    this.villageBiome = biome;
    for (const p of v.props) {
      const px = p.tx * TILE + (p.w * TILE) / 2; const py = (p.ty + p.h) * TILE;
      if (p.kind.startsWith('tree')) this.add.image(px, py + 2, 'props', p.kind).setOrigin(0.5, 1).setDepth(py);
      else if (p.kind.startsWith('bld_')) this.add.image(px, py, 'town', p.kind).setOrigin(0.5, 1).setDepth(py);
      else if (p.kind.startsWith('npc_')) {
        const id = p.kind.slice(4); const s = this.add.sprite(px, py - 2, 'chars', `${p.kind}0`).setOrigin(0.5, 30 / 32).setDepth(py - 2).play(p.kind);
        this.npcSprites.set(id, s);
        const npc = npcById(id); if (npc) this.add.text(px, py - 34, npc.name, { fontFamily: '"Press Start 2P", monospace', fontSize: '6px', color: '#ffe28a', stroke: '#000', strokeThickness: 2, resolution: 3 }).setOrigin(0.5, 1).setDepth(8000);
      }
      else if (p.kind === 'fountain') this.add.sprite(px, py, 'plaza', 'fountain0').setOrigin(0.5, 1).setDepth(py).play('fountain');
      else if (p.kind === 'lamp') this.lamps.push(this.add.image(px, py, 'plaza', 'lamp0').setOrigin(0.5, 1).setDepth(py));
      else if (p.kind === 'track') this.add.image(px, py, 'plaza', 'track').setOrigin(0.5, 1).setDepth(1);
      else this.add.image(px, py, 'plaza', p.kind).setOrigin(0.5, 1).setDepth(py);
    }
    this.add.sprite(v.conveyor.tx * TILE + 48, v.conveyor.ty * TILE + 30, 'chars', 'npc0').setOrigin(0.5, 1).setDepth(v.conveyor.ty * TILE + 30).play('npc');
    this.highlight = this.add.graphics().setDepth(2);
    this.bar = this.add.graphics().setDepth(5000);
    this.night = this.add.rectangle(0, 0, 640, 360, 0x0c0a30, 0).setOrigin(0).setScrollFactor(0).setDepth(9000);
    this.cameras.main.setBounds(0, 0, VILLAGE_W * TILE, VILLAGE_H * TILE).setRoundPixels(true);
  }

  spawnPlayer(you: PrivateState, x: number, y: number): void {
    this.player = this.add.sprite(x, y, 'chars', `farmer${you.color}${you.hat}_down0`).setOrigin(0.5, 30 / 32).setDepth(y);
    this.myTag = this.makeTag(you.name, you.color);
    this.nickText = this.add.text(0, 0, '', { fontFamily: '"Press Start 2P", monospace', fontSize: '6px', color: '#f0c434', stroke: '#000', strokeThickness: 2, resolution: 3 }).setOrigin(0.5, 1).setDepth(8002).setVisible(false);
    this.cameras.main.startFollow(this.player, true, 0.2, 0.2);
  }

  makeTag(name: string, color: number): Phaser.GameObjects.Text {
    const cols = ['#8fc3ff', '#ff9a9a', '#9ff0a0', '#d9a6ff', '#ffc98a', '#9fe8e0'];
    return this.add.text(0, 0, name, { fontFamily: '"Press Start 2P", monospace', fontSize: '6px', color: cols[color % 6], stroke: '#000', strokeThickness: 2, resolution: 3 }).setOrigin(0.5, 1).setDepth(8000);
  }

  // ------------------------------------------------------------ server messages
  onMsg(m: ServerMsg): void {
    switch (m.t) {
      case 'welcome': {
        if (this.village && m.village.id !== this.villageId) { this.net.close(); location.reload(); return; }
        if (!this.village) { this.buildWorld(m.village.seed, m.village.biome); }
        this.villageId = m.village.id; this.villages = m.villages;
        this.you = m.you; this.villageName = m.village.name; this.feed = m.feed;
        for (const [id, n] of Object.entries(m.names)) this.names.set(id, n);
        for (const l of m.lots) this.applyLot(l);
        const me = m.players.find((p) => p.id === m.you.id);
        if (!this.player) this.spawnPlayer(m.you, me?.x ?? this.village!.spawn.x, me?.y ?? this.village!.spawn.y);
        else if (me) { this.player.setPosition(me.x, me.y); }
        if (this.zoomLevel !== 2) this.cameras.main.startFollow(this.player, true, 0.2, 0.2);
        for (const p of m.players) if (p.id !== m.you.id) this.applySnap(p);
        this.ready = true; this.hud.refresh(); this.hud.feedRender();
        if (this.pendingWallet) { const w = this.pendingWallet; this.pendingWallet = null; void this.connectWallet(w); }
        this.hud.toast(`${COPY.village}: ${this.villageName}. ${COPY.controls}`, 6000);
        break;
      }
      case 'snap': {
        const seen = new Set<string>();
        for (const p of m.p) { seen.add(p.id); if (p.id === this.you?.id) { if (Math.hypot(p.x - this.player.x, p.y - this.player.y) > 48) this.player.setPosition(p.x, p.y); } else this.applySnap(p); this.setWanted(p.id, !!p.b); }
        for (const [id, r] of this.remotes) if (!seen.has(id)) { this.destroyRemote(r); this.remotes.delete(id); this.setWanted(id, false); }
        break;
      }
      case 'state': if (this.you) { Object.assign(this.you, m.you); this.hud.refresh(); } break;
      case 'lot': this.applyLot(m.lot); break;
      case 'players': for (const [id, n] of Object.entries(m.names)) this.names.set(id, n); for (const id of m.left ?? []) { const r = this.remotes.get(id); if (r) { this.destroyRemote(r); this.remotes.delete(id); } } this.hud.refresh(); break;
      case 'feed': this.feed.unshift(m.e); if (this.feed.length > 40) this.feed.length = 40; this.hud.feedRender(); if (m.e.kind === 'steal' || m.e.kind === 'tag') sfx.buy(); break;
      case 'reveal': { const sp = speciesById(m.plant.speciesId); sfx.reveal(E.tierIndex(m.plant.tier)); this.cameras.main.flash(200, 255, 240, 200); this.hud.reveal(m.plant, sp); break; }
      case 'toast': this.hud.toast(m.text); break;
      case 'chat': this.bubble(m.id, m.text); this.hud.chatLine(m.name, m.text); break;
      case 'emote': this.bubble(m.id, P.EMOTES[m.e] ?? ''); break;
      case 'channel': this.channel = m.kind ? { kind: m.kind, start: Date.now(), dur: m.endsAt - m.startedAt } : null; if (m.kind) sfx.plant(); break;
      case 'carry': this.carrying = m.speciesId; this.setCarry(this.player, this.myCarry, m.speciesId, (i) => { this.myCarry = i; }); if (m.speciesId) { sfx.scream(); this.hud.toast(COPY.runHome, 3000); } this.hud.refresh(); break;
      case 'error': this.hud.toast(m.text, 5000); break;
      case 'wild': {
        if (m.all) { for (const v of this.wilds.values()) { v.sprite.destroy(); v.glow.destroy(); } this.wilds.clear(); for (const w of m.all) this.addWild(w); }
        for (const w of m.add ?? []) this.addWild(w);
        for (const id of m.remove ?? []) { const v = this.wilds.get(id); if (v) { v.sprite.destroy(); v.glow.destroy(); this.wilds.delete(id); } }
        break;
      }
      case 'event': this.event = m.ev; this.hud.banner(Date.now()); if (m.ev?.kind === 'screaming_hour') this.screamingHour(); break;
      case 'board': this.board = m.sprint; if (m.bounties) this.bounties = m.bounties; if (m.trophies) this.trophies = m.trophies; this.hud.refresh(); break;
      case 'villages': this.villages = m.list; this.hud.refresh(); break;
      case 'sprint':
        if (m.phase === 'start') { this.sprintStartedAt = Date.now(); this.hud.toast(COPY.sprintStart, 3000); sfx.buy(); }
        else if (m.phase === 'turn') { this.hud.toast(COPY.sprintTurn, 2000); sfx.tend(); }
        else if (m.phase === 'finish') { this.sprintStartedAt = 0; this.hud.toast(`${COPY.sprintDone} ${((m.ms ?? 0) / 1000).toFixed(2)} s${m.record ? ` · ${COPY.sprintRecord}` : ''}`, 4000); if (m.record) sfx.fanfare(); else sfx.buy(); }
        else { this.sprintStartedAt = 0; }
        this.hud.banner(Date.now()); break;
      case 'nonce': void this.onNonce(m.address, m.message); break;
      case 'identity': saveIdentity({ id: m.id, secret: m.secret, name: m.name }); this.net.close(); setTimeout(() => location.reload(), 600); break;
      case 'npc': this.hud.talk(m.npc, m.name, m.line, m.missions); break;
      case 'say': this.hud.say(m.name, m.text); { const s = this.npcSprites.get(m.npc); if (s) this.bubbleAt(s.x, s.y - 34, m.text.slice(0, 60)); } break;
      case 'linked': if (this.you) { this.you.land = m.land; this.you.plotCount = m.plotCount; this.you.rarityFloor = m.rarityFloor; } this.hud.refresh(); if (m.address) this.hud.open('land'); break;
      case 'pong': break;
    }
  }

  applySnap(p: SnapPlayer): void {
    let r = this.remotes.get(p.id);
    const n = this.names.get(p.id) ?? { name: '?', color: 0, hat: 0 };
    if (!r) {
      const sprite = this.add.sprite(p.x, p.y, 'chars', `farmer${n.color}${n.hat}_down0`).setOrigin(0.5, 30 / 32).setDepth(p.y).setData('id', p.id);
      r = { sprite, tag: this.makeTag(n.name, n.color), tx: p.x, ty: p.y, d: p.d, f: p.f, m: p.m, carry: null, carryId: '', bubble: null, bubbleUntil: 0, color: n.color, hat: n.hat };
      this.remotes.set(p.id, r);
    }
    if (r.color !== n.color || r.hat !== n.hat) { r.color = n.color; r.hat = n.hat; r.sprite.stop(); r.sprite.setFrame(`farmer${n.color}${n.hat}_down0`); r.tag.setText(n.name); }
    r.tx = p.x; r.ty = p.y; r.d = p.d; r.f = p.f; r.m = p.m;
    if (r.carryId !== p.c) { r.carryId = p.c; this.setCarry(r.sprite, r.carry, p.c || null, (i) => { r!.carry = i; }); }
  }

  destroyRemote(r: Remote): void { r.sprite.destroy(); r.tag.destroy(); r.carry?.destroy(); r.bubble?.destroy(); }

  setWanted(id: string, on: boolean): void {
    const cur = this.wanted.get(id);
    if (on && !cur) this.wanted.set(id, this.add.text(0, 0, COPY.wanted, { fontFamily: '"Press Start 2P", monospace', fontSize: '6px', color: '#ff5555', stroke: '#000', strokeThickness: 2, resolution: 3 }).setOrigin(0.5, 1).setDepth(8001));
    else if (!on && cur) { cur.destroy(); this.wanted.delete(id); }
  }

  setCarry(host: Phaser.GameObjects.Sprite, cur: Phaser.GameObjects.Image | null, speciesId: string | null, set: (i: Phaser.GameObjects.Image | null) => void): void {
    cur?.destroy();
    set(speciesId ? this.add.image(host.x, host.y - 30, 'plants', `${speciesId}_grow3`).setOrigin(0.5, 44 / 48).setDepth(host.depth + 1) : null);
  }

  bubbleAt(x: number, y: number, text: string): void {
    const t = this.add.text(x, y, text, { fontFamily: '"Press Start 2P", monospace', fontSize: '6px', color: '#fff', backgroundColor: '#181220', padding: { x: 3, y: 2 }, wordWrap: { width: 140 }, align: 'center', resolution: 3 }).setOrigin(0.5, 1).setDepth(8500);
    this.time.delayedCall(5000, () => t.destroy());
  }
  bubble(id: string, text: string): void {
    const mine = id === this.you?.id;
    const host = mine ? this.player : this.remotes.get(id)?.sprite; if (!host) return;
    const t = this.add.text(host.x, host.y - 40, text, { fontFamily: '"Press Start 2P", monospace', fontSize: '6px', color: '#fff', backgroundColor: '#181220', padding: { x: 3, y: 2 }, wordWrap: { width: 120 }, align: 'center', resolution: 3 }).setOrigin(0.5, 1).setDepth(8500);
    if (mine) { this.myBubble?.destroy(); this.myBubble = t; this.myBubbleUntil = Date.now() + 4000; }
    else { const r = this.remotes.get(id)!; r.bubble?.destroy(); r.bubble = t; r.bubbleUntil = Date.now() + 4000; }
  }

  // ------------------------------------------------------------ lots
  applyLot(l: PublicLot): void {
    const v = this.village!; const geo = v.lots[l.lotId];
    let view = this.lots.get(l.ownerId);
    if (!view) {
      const g = lotGatePx(geo);
      const sign = this.add.text(g.x, g.y - (geo.gateSide === 'top' ? 20 : geo.gateSide === 'bottom' ? -26 : 22), '', { fontFamily: '"Press Start 2P", monospace', fontSize: '6px', color: '#fff', stroke: '#000', strokeThickness: 2, resolution: 3, align: 'center' }).setOrigin(0.5, 1).setDepth(7000);
      view = { lot: l, geo, sign, plants: new Map(), fx: new Map(), locks: new Map(), gnome: null, sprinkler: null, landKey: '', landObjs: [] };
      this.lots.set(l.ownerId, view);
    }
    view.lot = l;
    this.applyLand(view);
    const mine = l.ownerId === this.you?.id;
    const status = l.shielded ? ` (${COPY.shielded})` : l.online ? '' : ` (${COPY.offline})`;
    view.sign.setText(`${mine ? COPY.yourLot : l.name}${status}`).setColor(mine ? '#f0c434' : l.shielded ? '#8fc3ff' : '#fff');
    const stone = l.cosmetics?.fence === 'stone';
    this.layer.putTileAt(this.villageBiome * TILE_STRIDE + (l.defenses.gateHp > 0 ? (stone ? T.gate_closed2 : T.gate_closed) : (stone ? T.gate_open2 : T.gate_open)), geo.gate.tx, geo.gate.ty);
    // plants
    const present = new Set<number>();
    for (const p of l.plots) {
      present.add(p.i);
      const pos = { x: geo.plots[p.i].tx * TILE + 16, y: geo.plots[p.i].ty * TILE + 28 };
      let s = view.plants.get(p.i);
      const key = `${p.speciesId}:${p.revealed}:${p.mutation}:${p.size}`;
      if (s && s.getData('key') !== key) { s.destroy(); this.clearFx(view, p.i); s = undefined; }
      if (!s) {
        s = this.add.sprite(pos.x, pos.y, 'plants', `${p.speciesId}_grow0`).setOrigin(0.5, 44 / 48).setDepth(pos.y).setData('key', key).setData('planted', Date.now());
        view.plants.set(p.i, s);
        if (p.revealed) { s.play(`${p.speciesId}_idle`); this.applyMutation(view, p.i, s, p.mutation, pos); }
      }
      const lock = view.locks.get(p.i);
      if (p.lockedUntil > Date.now() && !lock) view.locks.set(p.i, this.add.image(pos.x + 10, pos.y - 26, 'ui', 'lockicon').setDepth(pos.y + 1).setScale(0.6));
      else if (p.lockedUntil <= Date.now() && lock) { lock.destroy(); view.locks.delete(p.i); }
      const wk = -1000 - p.i; const weed = view.locks.get(wk);
      if (p.weedy && !weed) view.locks.set(wk, this.add.image(pos.x, pos.y - 12, 'plaza', 'weeds').setDepth(pos.y + 2));
      else if (!p.weedy && weed) { weed.destroy(); view.locks.delete(wk); }
    }
    for (const [i, s] of view.plants) if (!present.has(i)) { s.destroy(); view.plants.delete(i); this.clearFx(view, i); view.locks.get(i)?.destroy(); view.locks.delete(i); view.locks.get(-1000 - i)?.destroy(); view.locks.delete(-1000 - i); }
    // defenses
    if (l.defenses.gnome && !view.gnome) view.gnome = this.add.sprite(geo.center.x, geo.center.y, 'chars', 'gnome0').setOrigin(0.5, 30 / 32).play('gnome');
    if (!l.defenses.gnome && view.gnome) { (view.gnome.getData('hat') as Phaser.GameObjects.Image | undefined)?.destroy(); view.gnome.destroy(); view.gnome = null; }
    if (view.gnome) {
      const want = l.cosmetics?.gnomeHat ?? -1; const cur = view.gnome.getData('hat') as Phaser.GameObjects.Image | undefined; const curId = view.gnome.getData('hatId') as number | undefined;
      if (curId !== want) { cur?.destroy(); view.gnome.setData('hat', want >= 0 ? this.add.image(view.gnome.x, view.gnome.y - 28, 'ui', `ghat${want}`).setDepth(view.gnome.y + 1) : undefined).setData('hatId', want); }
    }
    if (l.defenses.sprinkler && !view.sprinkler) view.sprinkler = this.add.sprite((geo.x + 1) * TILE + 16, (geo.y + 1) * TILE + 20, 'props', 'sprinkler0').setDepth((geo.y + 1) * TILE + 20).play('sprinkler');
    if (!l.defenses.sprinkler && view.sprinkler) { view.sprinkler.destroy(); view.sprinkler = null; }
    if (mine) this.hud.refresh();
  }

  clearFx(view: LotView, i: number): void { for (const o of view.fx.get(i) ?? []) o.destroy(); view.fx.delete(i); }

  // ------------------------------------------------------------ wild seeds, events
  addWild(w: P.Wild): void {
    if (this.wilds.has(w.id)) return;
    const sprite = this.add.sprite(w.x, w.y + 12, 'plants', `${w.speciesId}_grow1`).setOrigin(0.5, 44 / 48).setDepth(w.y + 12);
    const glow = this.add.image(w.x + 8, w.y - 14, 'ui', 'sparkle').setDepth(w.y + 13).setScale(0.4).setAlpha(0.7);
    this.tweens.add({ targets: glow, alpha: 0.15, scale: 0.7, duration: 700, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: sprite, y: w.y + 10, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.wilds.set(w.id, { w, sprite, glow });
  }
  nearestWild(): { w: P.Wild; d: number } | null {
    let best: { w: P.Wild; d: number } | null = null;
    for (const v of this.wilds.values()) { const d = Math.hypot(v.w.x - this.player.x, v.w.y - this.player.y); if (d < 44 && (!best || d < best.d)) best = { w: v.w, d }; }
    return best;
  }
  screamingHour(): void {
    let i = 0;
    for (const v of this.lots.values()) for (const [idx, s] of v.plants) { const p = v.lot.plots.find((x) => x.i === idx); if (p?.revealed) this.time.delayedCall(200 * (i++ % 15), () => this.scream({ x: s.x, y: s.y })); }
  }
  wetMark(x: number, y: number): void {
    const r = this.add.rectangle(x, y, 30, 30, 0x3060c0, 0.35).setDepth(1.5);
    this.tweens.add({ targets: r, alpha: 0, duration: 60_000, onComplete: () => r.destroy() });
  }

  /** Layer C on the map: lot interior in the wallet's biome, plot tiles, conviction tree, wither stumps, decor flora. */
  applyLand(view: LotView): void {
    const l = view.lot; const geo = view.geo; const land = l.land;
    const cos = l.cosmetics ?? { fence: 'wood', lantern: false, nameplate: false, path: false, gnomeHat: -1 };
    const key = `${land.address}:${land.biome}:${land.treeStage}:${land.witherMarks}:${land.decorFlora}:${l.plotCount}:${!!l.defenses.mud}:${l.defenses.gateHp > 0}:${JSON.stringify(cos)}`;
    if (view.landKey === key) return;
    view.landKey = key;
    for (const o of view.landObjs) { this.lamps = this.lamps.filter((x) => x !== o); o.destroy(); } view.landObjs = [];
    const b = land.address ? land.biome : this.villageBiome; const vb = this.villageBiome * TILE_STRIDE;
    // fence style (cosmetic), gate, optional cobbled ring, mud
    const fh = cos.fence === 'stone' ? T.fence_h2 : cos.fence === 'hedge' ? T.hedge : T.fence_h; const fv = cos.fence === 'stone' ? T.fence_v2 : cos.fence === 'hedge' ? T.hedge : T.fence_v;
    for (let i = 0; i < geo.w; i++) { this.layer.putTileAt(vb + fh, geo.x + i, geo.y); this.layer.putTileAt(vb + fh, geo.x + i, geo.y + geo.h - 1); }
    for (let j = 0; j < geo.h; j++) { this.layer.putTileAt(vb + fv, geo.x, geo.y + j); this.layer.putTileAt(vb + fv, geo.x + geo.w - 1, geo.y + j); }
    const stone = cos.fence === 'stone';
    this.layer.putTileAt(vb + (l.defenses.gateHp > 0 ? (stone ? T.gate_closed2 : T.gate_closed) : (stone ? T.gate_open2 : T.gate_open)), geo.gate.tx, geo.gate.ty);
    for (let j = 1; j < geo.h - 1; j++) for (let i = 1; i < geo.w - 1; i++) {
      const ring = cos.path && (i === 1 || j === 1 || i === geo.w - 2 || j === geo.h - 2);
      this.layer.putTileAt(b * TILE_STRIDE + (ring ? T.cobble2 : l.defenses.mud ? T.soil : T.grass2), geo.x + i, geo.y + j);
    }
    for (let i = 0; i < l.plotCount; i++) this.layer.putTileAt(b * TILE_STRIDE + T.plot, geo.plots[i].tx, geo.plots[i].ty);
    const g = lotGatePx(geo); const side = geo.gateSide === 'left' || geo.gateSide === 'right';
    if (cos.lantern) for (const d of [-1, 1]) { const lx = side ? g.x : g.x + d * 28; const ly = side ? g.y + d * 28 : g.y; const lamp = this.add.image(lx, ly + 14, 'plaza', 'lamp0').setOrigin(0.5, 1).setDepth(ly + 14).setScale(0.75); this.lamps.push(lamp); view.landObjs.push(lamp); }
    if (cos.nameplate) view.landObjs.push(this.add.image(g.x + (side ? 0 : 22), g.y + (side ? 22 : 0) + 14, 'plaza', 'sign').setOrigin(0.5, 1).setDepth(g.y + 14));
    if (land.address) {
      const tx = geo.gateSide === 'left' ? geo.x + geo.w - 2 : geo.x + 1; const ty = geo.gateSide === 'top' ? geo.y + geo.h - 2 : geo.y + 1;
      const t = this.add.image(tx * TILE + 16, ty * TILE + 30, 'props', `tree${land.treeStage}`).setOrigin(0.5, 1).setDepth(ty * TILE + 30);
      view.landObjs.push(t);
    }
    for (let k = 0; k < land.witherMarks; k++) {
      const outside = geo.gateSide === 'bottom' ? { tx: geo.x + 1 + k * 2, ty: geo.y - 1 } : geo.gateSide === 'top' ? { tx: geo.x + 1 + k * 2, ty: geo.y + geo.h } : geo.gateSide === 'left' ? { tx: geo.x + geo.w, ty: geo.y + 1 + k * 2 } : { tx: geo.x - 1, ty: geo.y + 1 + k * 2 };
      view.landObjs.push(this.add.image(outside.tx * TILE + 16, outside.ty * TILE + 30, 'props', 'stump').setOrigin(0.5, 1).setDepth(outside.ty * TILE + 30));
    }
    for (let k = 0; k < land.decorFlora; k++) {
      const side = geo.gateSide === 'left' || geo.gateSide === 'right';
      const tx = side ? geo.x + 1 + k * 2 : geo.x + geo.w; const ty = side ? geo.y + geo.h : geo.y + 1 + k;
      view.landObjs.push(this.add.image(tx * TILE + 16 + (side ? 0 : 6), ty * TILE + 30, 'plaza', `decor${k % 3}`).setOrigin(0.5, 1).setDepth(ty * TILE + 30));
    }
  }

  // ------------------------------------------------------------ wallet (read-only)
  async connectWallet(walletId: string): Promise<void> {
    if (this.linking) return;
    if (!hasWallet()) { this.hud.toast(COPY.noWallet, 5000); return; }
    this.linking = true; this.walletId = walletId;
    try {
      const address = await connectAddress(walletId);
      this.pendingAddress = address; this.net.send({ t: 'nonce', address });
    } catch { this.linking = false; this.hud.toast(COPY.noWallet, 4000); }
  }
  pendingAddress: string | null = null;
  walletId = 'metamask';
  async onNonce(address: string, message: string): Promise<void> {
    if (address !== this.pendingAddress) { this.linking = false; return; }
    try { this.hud.toast(COPY.signing, 6000); const signature = await signMessageWith(this.walletId, address, message); this.net.send({ t: 'link', address, signature }); }
    catch { this.hud.toast(COPY.linkFail, 4000); }
    finally { this.linking = false; }
  }
  /** Zoom: close (follows you) → half (follows you) → whole map (fixed) → close. The HUD is DOM so it stays crisp. */
  zoomLevel = 0;
  toggleZoom(): void {
    this.zoomLevel = (this.zoomLevel + 1) % 3;
    const cam = this.cameras.main;
    if (this.zoomLevel === 2) {
      const z = Math.min(640 / (VILLAGE_W * TILE), 360 / (VILLAGE_H * TILE));
      cam.stopFollow(); cam.setZoom(z); cam.centerOn((VILLAGE_W * TILE) / 2, (VILLAGE_H * TILE) / 2);
      this.night.setSize(640 / z, 360 / z);
    } else {
      const z = this.zoomLevel === 0 ? 1 : 0.5;
      cam.setZoom(z); cam.startFollow(this.player, true, 0.2, 0.2);
      this.night.setSize(640 / z, 360 / z);
    }
  }
  unlinkWallet(): void { this.net.send({ t: 'unlink' }); }

  applyMutation(view: LotView, i: number, s: Phaser.GameObjects.Sprite, mutation: string, pos: { x: number; y: number }): void {
    const fx: Phaser.GameObjects.GameObject[] = [];
    switch (mutation) {
      case 'golden': { s.setTint(0xffe28a); const sp = this.add.image(pos.x + 9, pos.y - 22, 'ui', 'sparkle').setDepth(pos.y + 1).setScale(0.5); this.tweens.add({ targets: sp, alpha: 0.1, scale: 0.9, duration: 600, yoyo: true, repeat: -1 }); fx.push(sp); break; }
      case 'holographic': s.setData('holo', true); break;
      case 'colossal': s.setScale(1.5); break;
      case 'backwards': s.setFlipY(true).setOrigin(0.5, 4 / 48).setY(pos.y - 26); break;
      case 'feral': { const ev = this.time.addEvent({ delay: 1500, loop: true, callback: () => { if (s.active) this.tweens.add({ targets: s, x: pos.x + Phaser.Math.Between(-12, 12), y: pos.y + Phaser.Math.Between(-6, 6), duration: 700, ease: 'Sine.easeInOut' }); } }); fx.push({ destroy: () => ev.remove() } as unknown as Phaser.GameObjects.GameObject); break; }
      case 'screaming': { const ev = this.time.addEvent({ delay: 8000, loop: true, callback: () => this.scream(pos) }); fx.push({ destroy: () => ev.remove() } as unknown as Phaser.GameObjects.GameObject); break; }
    }
    view.fx.set(i, fx);
  }

  scream(pos: { x: number; y: number }): void {
    const cam = this.cameras.main; if (Math.abs(pos.x - cam.midPoint.x) > 400 || Math.abs(pos.y - cam.midPoint.y) > 300) return;
    sfx.scream(); cam.shake(180, 0.004);
    const t = this.add.text(pos.x, pos.y - 30, 'AAAAAA', { fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#ff5555', stroke: '#000', strokeThickness: 2, resolution: 2 }).setOrigin(0.5).setDepth(8600);
    this.tweens.add({ targets: t, y: pos.y - 60, alpha: 0, duration: 1200, onComplete: () => t.destroy() });
  }

  // ------------------------------------------------------------ loop
  update(_time: number, delta: number): void {
    if (!this.ready || !this.village || !this.you) return;
    const now = Date.now(); const dt = delta / 1000;
    this.movePlayer(dt, now);
    this.updateRemotes(dt, now);
    this.drawOverlays(now);
    if (this.hue++ % 4 === 0) this.tickHolo(now);
    this.dayNight(now);
    if (now - this.lastSecond >= 1000) { this.lastSecond = now; this.hud.banner(now); if (sfx.ready) { sfx.ambientStart(this.villageBiome); const f = this.village.props.find((p) => p.kind === 'fountain'); if (f) sfx.fountain(1 - Math.min(1, Math.hypot(f.tx * TILE + 32 - this.player.x, f.ty * TILE + 32 - this.player.y) / 260)); } }
    if (this.moving && now - this.lastStep > 260) { this.lastStep = now; sfx.step(); }
    if (now - this.lastSend >= 100 && (this.moving || this.lastSend === 0 || this.player.getData('dirty'))) { this.lastSend = now; this.player.setData('dirty', false); this.net.send({ t: 'input', dx: this.joy.x, dy: this.joy.y, x: Math.round(this.player.x), y: Math.round(this.player.y), d: this.dir, f: this.flip, m: this.moving }); }
  }

  gateClosed = (tx: number, ty: number): boolean => {
    for (const v of this.lots.values()) if (v.geo.gate.tx === tx && v.geo.gate.ty === ty) return v.lot.defenses.gateHp > 0;
    return false;
  };

  movePlayer(dt: number, now: number): void {
    let dx = this.joy.x; let dy = this.joy.y;
    if (this.cursors.left.isDown || this.wasd.A.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) dy += 1;
    if (dx || dy) { this.path = []; this.pathAct = null; }
    else if (this.path.length) {
      const wp = this.path[0]; const ex = wp.x - this.player.x; const ey = wp.y - this.player.y; const dist = Math.hypot(ex, ey);
      if (dist < 4) { this.path.shift(); if (!this.path.length) { const a = this.pathAct; this.pathAct = null; a?.(); } }
      else { dx = ex / dist; dy = ey / dist; }
    }
    const wasMoving = this.moving;
    if (dx || dy) {
      if (this.channel) { this.channel = null; this.net.send({ t: 'cancel' }); }
      const len = Math.hypot(dx, dy) || 1;
      let sp = P.BASE_SPEED * E.speedMult(this.you!.speedLevel);
      if (this.carrying) { sp *= P.CARRY_SPEED; const inLot = lotAtPx(this.village!, this.player.x, this.player.y); const owner = inLot ? [...this.lots.values()].find((v) => v.geo.id === inLot.id) : null; if (owner && owner.lot.ownerId !== this.you!.id && owner.lot.defenses.sprinkler) sp *= P.SPRINKLER_SPEED; }
      const r = moveActor(this.village!, this.player.x, this.player.y, (dx / len) * sp * dt, (dy / len) * sp * dt, this.gateClosed);
      if (r.x === this.player.x && r.y === this.player.y && this.path.length) { this.path = []; this.pathAct = null; }
      this.player.setPosition(r.x, r.y);
      if (Math.abs(dx) > Math.abs(dy)) { this.dir = 'side'; this.flip = dx < 0; } else this.dir = dy < 0 ? 'up' : 'down';
      this.moving = true;
      const skin = `${this.you!.color}${this.you!.hat}`;
      this.player.setFlipX(this.flip).play(this.carrying && this.dir === 'down' ? `walk${skin}_carry` : `walk${skin}_${this.dir}`, true);
    } else {
      this.moving = false;
      if (this.player.anims.isPlaying) { this.player.stop(); this.player.setFrame(`farmer${this.you!.color}${this.you!.hat}_${this.carrying && this.dir === 'down' ? 'carry' : this.dir}0`); }
    }
    if (wasMoving !== this.moving) this.player.setData('dirty', true);
    this.player.setDepth(this.player.y);
    this.myTag.setPosition(this.player.x, this.player.y - 30);
    this.wanted.get(this.you!.id)?.setPosition(this.player.x, this.player.y - 38);
    this.myCarry?.setPosition(this.player.x, this.player.y - 28).setDepth(this.player.y + 1);
    if (this.myBubble) { this.myBubble.setPosition(this.player.x, this.player.y - 40); if (now > this.myBubbleUntil) { this.myBubble.destroy(); this.myBubble = null; } }
  }

  updateRemotes(dt: number, now: number): void {
    const k = Math.min(1, dt * 12);
    for (const r of this.remotes.values()) {
      const s = r.sprite; s.x += (r.tx - s.x) * k; s.y += (r.ty - s.y) * k; s.setDepth(s.y);
      if (r.m) { s.setFlipX(r.f).play(r.carryId && r.d === 'down' ? `walk${r.color}${r.hat}_carry` : `walk${r.color}${r.hat}_${r.d}`, true); }
      else if (s.anims.isPlaying) { s.stop(); s.setFrame(`farmer${r.color}${r.hat}_${r.carryId && r.d === 'down' ? 'carry' : r.d}0`); }
      r.tag.setPosition(s.x, s.y - 30); r.carry?.setPosition(s.x, s.y - 28).setDepth(s.y + 1);
      this.wanted.get(r.sprite.getData('id') as string)?.setPosition(s.x, s.y - 38);
      if (r.bubble) { r.bubble.setPosition(s.x, s.y - 40); if (now > r.bubbleUntil) { r.bubble.destroy(); r.bubble = null; } }
    }
    for (const v of this.lots.values()) if (v.gnome) { const a = now / 1500; v.gnome.setPosition(v.geo.center.x + Math.cos(a) * 52, v.geo.center.y + Math.sin(a) * 40).setDepth(v.gnome.y).setFlipX(Math.sin(a) < 0); const gh = v.gnome.getData('hat') as Phaser.GameObjects.Image | undefined; gh?.setPosition(v.gnome.x, v.gnome.y - 28).setDepth(v.gnome.y + 1); }
  }

  drawOverlays(now: number): void {
    this.highlight.clear();
    const near = this.nearestPlot();
    if (near) { const pos = near.pos; this.highlight.lineStyle(1, near.mine ? (this.selectedSeed && !near.plot ? 0xf0c434 : 0xffffff) : 0xff6060, 0.8); this.highlight.strokeRect(pos.x - 15, pos.y - 15, 31, 31); }
    if (near?.plot?.nick) this.nickText.setText(`"${near.plot.nick}"`).setPosition(near.pos.x, near.pos.y - 34).setVisible(true); else this.nickText.setVisible(false);
    this.bar.clear();
    if (this.channel) {
      const f = Math.min(1, (now - this.channel.start) / this.channel.dur);
      this.bar.fillStyle(0x000000, 0.7).fillRect(this.player.x - 16, this.player.y - 40, 32, 5);
      this.bar.fillStyle(this.channel.kind === 'uproot' ? 0xff6060 : 0xf0c434, 1).fillRect(this.player.x - 15, this.player.y - 39, 30 * f, 3);
      if (f >= 1) this.channel = null;
    }
  }

  tickHolo(now: number): void {
    const h = (now / 20) % 360; const c = Phaser.Display.Color.HSVToRGB(h / 360, 0.45, 1).color;
    for (const v of this.lots.values()) for (const s of v.plants.values()) if (s.getData('holo')) s.setTint(c);
    // growth frames for unrevealed plants are approximated client-side from the public tier's grow time
    for (const v of this.lots.values()) for (const [i, s] of v.plants) {
      const p = v.lot.plots.find((x) => x.i === i); if (!p || p.revealed) continue;
      const mine = v.lot.ownerId === this.you?.id; const plant = mine ? this.you!.plots[i] : null;
      const prog = plant ? Phaser.Math.Clamp((now - plant.plantedAt) / plant.growMs, 0, 0.999) : Phaser.Math.Clamp((now - (s.getData('planted') as number)) / E.GROW_MS[p.tier], 0, 0.999);
      s.setFrame(`${p.speciesId}_grow${Math.floor(prog * 4)}`);
    }
  }

  dayNight(now: number): void {
    const h = (now / 3600_000) % 24; const a = Math.max(0, Math.cos(((h - 12) / 12) * Math.PI) * -1) * 0.45; // 0 at noon, .45 at midnight
    this.night.setAlpha(a);
    const lit = a > 0.12; for (const l of this.lamps) l.setFrame(lit ? 'lamp1' : 'lamp0');
  }

  // ------------------------------------------------------------ interaction
  nearestPlot(): { view: LotView; i: number; pos: { x: number; y: number }; plot: P.PublicPlot | null; mine: boolean } | null {
    let best: ReturnType<WorldScene['nearestPlot']> = null; let bd = INTERACT_RADIUS;
    for (const v of this.lots.values()) for (let i = 0; i < v.lot.plotCount; i++) {
      const pos = { x: v.geo.plots[i].tx * TILE + 16, y: v.geo.plots[i].ty * TILE + 16 };
      const d = Math.hypot(pos.x - this.player.x, pos.y - this.player.y);
      if (d < bd) { bd = d; best = { view: v, i, pos, plot: v.lot.plots.find((p) => p.i === i) ?? null, mine: v.lot.ownerId === this.you!.id }; }
    }
    return best;
  }

  onTap(x: number, y: number): void {
    if (!this.ready) return;
    for (const v of this.lots.values()) {
      for (let i = 0; i < v.lot.plotCount; i++) {
        const pos = { x: v.geo.plots[i].tx * TILE + 16, y: v.geo.plots[i].ty * TILE + 16 };
        if (Math.abs(pos.x - x) <= 16 && Math.abs(pos.y - y) <= 20) {
          const act = () => this.interactPlot(v, i);
          if (Math.hypot(pos.x - this.player.x, pos.y - this.player.y) < INTERACT_RADIUS) act(); else this.goTo({ x: pos.x, y: pos.y + 24 }, act);
          return;
        }
      }
      const g = lotGatePx(v.geo);
      if (v.lot.ownerId !== this.you!.id && v.lot.defenses.gateHp > 0 && Math.abs(g.x - x) <= 16 && Math.abs(g.y - y) <= 16) {
        const out = { x: g.x + (v.geo.gateSide === 'left' ? -28 : v.geo.gateSide === 'right' ? 28 : 0), y: g.y + (v.geo.gateSide === 'top' ? -28 : v.geo.gateSide === 'bottom' ? 28 : 0) };
        const act = () => this.net.send({ t: 'break', ownerId: v.lot.ownerId });
        if (Math.hypot(g.x - this.player.x, g.y - this.player.y) < 48) act(); else this.goTo(out, act);
        return;
      }
    }
    for (const { w } of this.wilds.values()) {
      if (Math.abs(w.x - x) <= 16 && Math.abs(w.y - y) <= 20) {
        const act = () => { this.net.send({ t: 'forage', id: w.id }); sfx.forage(); };
        if (Math.hypot(w.x - this.player.x, w.y - this.player.y) < 44) act(); else this.goTo({ x: w.x, y: w.y }, act);
        return;
      }
    }
    const v = this.village!;
    for (const n of v.npcs) {
      const nx = n.tx * TILE + 16; const ny = n.ty * TILE + 16;
      if (Math.abs(nx - x) <= 18 && Math.abs(ny - y) <= 24) {
        const act = () => this.net.send({ t: 'talk', npc: n.id });
        if (Math.hypot(nx - this.player.x, ny - this.player.y) < 56) act(); else this.goTo({ x: nx, y: ny + TILE }, act);
        return;
      }
    }
    if (Math.abs(x - (v.conveyor.tx * TILE + 32)) < 40 && Math.abs(y - (v.conveyor.ty * TILE)) < 32) { this.hud.open('conveyor'); return; }
    if (Math.abs(x - (v.board.tx * TILE + 32)) < 36 && Math.abs(y - (v.board.ty * TILE)) < 32) { this.hud.open('feed'); return; }
    const sign = v.props.find((p) => p.kind === 'sign');
    if (sign && Math.abs(x - (sign.tx * TILE + 16)) < 20 && Math.abs(y - (sign.ty * TILE + 16)) < 24) { if (this.you?.visiting) this.goHome(); else this.hud.open('villages'); return; }
    const tr = { x: v.track.tx * TILE + 32, y: v.track.ty * TILE + 16 };
    if (Math.abs(x - tr.x) < 36 && Math.abs(y - tr.y) < 20) { const act = () => this.net.send({ t: 'sprint' }); if (Math.hypot(tr.x - this.player.x, tr.y - this.player.y) < 48) act(); else this.goTo({ x: tr.x, y: tr.y + 6 }, act); return; }
    this.goTo({ x, y });
  }

  goTo(target: { x: number; y: number }, act?: () => void): void {
    const p = findPath(this.village!, { x: this.player.x, y: this.player.y }, target, this.gateClosed);
    this.path = p ?? [target]; this.pathAct = act ?? null;
  }

  interactNearest(): void {
    for (const npc of this.village!.npcs) if (Math.hypot(npc.tx * TILE + 16 - this.player.x, npc.ty * TILE + 16 - this.player.y) < 56) { this.net.send({ t: 'talk', npc: npc.id }); return; }
    const w = this.nearestWild(); const n = this.nearestPlot();
    if (w && (!n || w.d < Math.hypot(n.pos.x - this.player.x, n.pos.y - this.player.y))) { this.net.send({ t: 'forage', id: w.w.id }); sfx.forage(); return; }
    if (n) this.interactPlot(n.view, n.i);
  }

  interactPlot(v: LotView, i: number): void {
    const p = v.lot.plots.find((x) => x.i === i) ?? null;
    if (v.lot.ownerId === this.you!.id) {
      if (this.lockMode && p) { this.lockMode = false; this.net.send({ t: 'shop', item: 'lock', plotId: i }); return; }
      if (!p) {
        if (this.selectedSeed) { this.net.send({ t: 'plant', seedUid: this.selectedSeed, plotId: i }); this.selectedSeed = null; sfx.plant(); this.splash(v.geo.plots[i].tx * TILE + 16, v.geo.plots[i].ty * TILE + 16, 0x8c5a3c); }
        else if (this.you!.seeds.length) this.hud.open('seeds');
        else { this.hud.toast(COPY.emptySeeds); this.hud.open('conveyor'); }
      } else { this.net.send({ t: 'tend', plotId: i }); sfx.tend(); this.splash(v.geo.plots[i].tx * TILE + 16, v.geo.plots[i].ty * TILE + 6, 0x78c8f0); if (!p.revealed) this.wetMark(v.geo.plots[i].tx * TILE + 16, v.geo.plots[i].ty * TILE + 16); }
      return;
    }
    if (p && p.revealed) this.net.send({ t: 'uproot', ownerId: v.lot.ownerId, plotId: i });
    else this.hud.toast(COPY.raidNotReady);
  }

  splash(x: number, y: number, color: number): void {
    for (let i = 0; i < 6; i++) {
      const dot = this.add.rectangle(x, y, 2, 2, color).setDepth(8700);
      this.tweens.add({ targets: dot, x: x + Phaser.Math.Between(-14, 14), y: y - Phaser.Math.Between(6, 22), alpha: 0, duration: 500, onComplete: () => dot.destroy() });
    }
  }

  // ------------------------------------------------------------ HUD bridge
  buySeed(i: number): void { this.net.send({ t: 'buy', slot: i }); sfx.buy(); }
  selectSeed(uid: string): void {
    if (!this.you!.plots.some((p) => !p)) { sfx.deny(); this.hud.toast(COPY.noFreePlot); return; }
    this.selectedSeed = uid; this.hud.close(); this.hud.toast(COPY.plantPrompt, 4000);
  }
  cosmetic(item: P.CosmeticItem): void { this.net.send({ t: 'cosmetic', item }); sfx.buy(); }
  mission(id: string, action: 'accept' | 'claim'): void { this.net.send({ t: 'mission', id, action }); if (action === 'claim') sfx.fanfare(); else sfx.tend(); }
  ask(npc: string, text: string): void { this.net.send({ t: 'ask', npc, text }); }
  wardrobe(shirt?: number, hat?: number): void { this.net.send({ t: 'wardrobe', shirt, hat }); sfx.buy(); }
  nick(plotId: number, name: string): void { this.net.send({ t: 'nick', plotId, name }); }
  visit(villageId: string): void { this.net.send({ t: 'visit', village: villageId }); this.hud.close(); }
  goHome(): void { this.net.send({ t: 'home' }); this.hud.close(); }
  postBounty(thiefId: string, amount: number): void { this.net.send({ t: 'bounty', thiefId, amount }); }
  refreshVillages(): void { this.net.send({ t: 'villages' }); }
  shop(item: P.ShopItem): void {
    if (item === 'lock') { this.lockMode = true; this.hud.close(); this.hud.toast(COPY.defLockDesc, 4000); return; }
    this.net.send({ t: 'shop', item });
  }
  chat(text: string): void { this.net.send({ t: 'chat', text }); }
  emote(e: number): void { this.net.send({ t: 'emote', e }); }
  frameRect(name: string): { x: number; y: number } { const f = this.textures.getFrame('plants', name); return { x: f.cutX, y: f.cutY }; }
  tierOf(id: string): Tier { return speciesById(id).tier; }
  onlineCount(): number { return this.remotes.size + 1; }
}
