import type { Tier } from "@shared/types";
import * as E from "@shared/economy";
import * as P from "@shared/protocol";
import {
  buildVillage,
  findPath,
  lotGatePx,
  TILE,
  type Village,
  type Lot,
} from "@shared/world";
import { speciesById, COPY } from "../content";
import { renderTape, type MarketView } from "../tape";
import {
  Net,
  wsUrl,
  loadIdentity,
  newIdentity,
  saveIdentity,
  discardRejectedIdentity,
  type Identity,
} from "../net";
import { hasWallet, connectAddress, signMessageWith, cancelWallet, walletFailureKey } from "../wallet";
import { takeLegacySave } from "../state";
import { Hud } from "../ui/hud";
import { sfx } from "../audio";
import { predictMovement } from "./movement";
import { cameraInput } from "./camera-input";
import { ServerClock } from './server-clock';

const INTERACT_RADIUS = 40;
export interface LotView {
  lot: P.PublicLot;
  geo: Lot;
}
export interface WorldView {
  frameRect(name: string): { x: number; y: number };
  effect(kind: string, x: number, y: number): void;
}
/** Client gameplay state in the existing server pixel coordinates; no rendering library dependency. */
export class WorldState {
  readonly serverClock=new ServerClock();
  net!: Net;
  identity!: Identity;
  hud: Hud;
  you: P.PrivateState | null = null;
  village: Village | null = null;
  villageName = "";
  villageId = "";
  villageBiome = 0;
  lots = new Map<string, LotView>();
  names = new Map<string, P.NameEntry>();
  remotes = new Map<string, P.SnapPlayer>();
  wilds = new Map<string, { w: P.Wild }>();
  bubbles = new Map<string, { text: string; until: number }>();
  feed: P.FeedEvent[] = [];
  villages: P.VillageInfo[] = [];
  market: MarketView | null = null;
  board: P.SprintEntry[] = [];
  bounties: P.Bounty[] = [];
  trophies: P.Trophies | null = null;
  event: P.VillageEvent | null = null;
  player = { x: 0, y: 0 };
  joy = { x: 0, y: 0 };
  path: { x: number; y: number }[] = [];
  pathAct: (() => void) | null = null;
  selectedSeed: string | null = null;
  lockMode = false;
  carrying: string | null = null;
  carryingAppearance: P.CarryAppearance | null = null;
  channel: { kind: "uproot" | "break"; start: number; dur: number } | null =
    null;
  dir: P.Dir = "down";
  flip = false;
  moving = false;
  ready = false;
  linking = false;
  sprintStartedAt = 0;
  lastSend = 0;
  inputYaw = 0;
  private inputDirty = false;
  lastSecond = 0;
  lastStep = 0;
  pendingWallet: string | null = null;
  revision = 0;
  constructor(private view: WorldView) {
    this.hud = new Hud(this);
  }
  start(): void {
    const id = loadIdentity();
    if (id) this.connect(id);
    else
      this.hud.askName((name, wallet) => {
        this.pendingWallet = wallet;
        this.connect(newIdentity(name));
      });
  }
  connect(id: Identity): void {
    this.identity = id;
    this.net = new Net(wsUrl());
    this.net.onOpen = () =>
      this.net.send({ t: "hello", ...id, save: takeLegacySave() });
    this.net.onClose = (reason) => {
      cancelWallet(); this.pendingAddress = null; this.linking = false;
      this.ready = false;
      if(reason==='session-replaced')this.hud.sessionReplaced();
      else if(reason==='identity-rejected')this.hud.identityRejected(()=>{if(discardRejectedIdentity(id))location.reload();else this.hud.toast(COPY.signInStorageBlocked);});
      else this.hud.toast(COPY.disconnected);
    };
    this.net.onMsg = (m) => this.onMsg(m);
    this.net.connect();
    this.hud.toast(COPY.connecting);
  }
  onMsg(m: P.ServerMsg): void {
    switch (m.t) {
      case "welcome": {
        this.serverClock.sample(m.now);
        this.village = buildVillage(m.village.seed);
        this.villageId = m.village.id;
        this.villageName = m.village.name;
        this.villageBiome = m.village.biome;
        this.you = m.you;
        // A look chosen on the landing page arrives here. Applied once, then cleared, so it
        // never fights a change the player later makes at the wardrobe.
        try {
          const raw = localStorage.getItem("pons.look");
          if (raw) {
            const l = JSON.parse(raw) as { shirt?: number; variant?: number };
            if (Number.isInteger(l.shirt) && Number.isInteger(l.variant)) {
              this.net.send({ t: "wardrobe", shirt: l.shirt, skin: l.variant });
            }
            localStorage.removeItem("pons.look");
          }
        } catch { /* storage blocked, or nothing chosen */ }
        this.feed = m.feed;
        this.villages = m.villages;
        this.names = new Map(Object.entries(m.names));
        this.lots.clear();
        this.remotes.clear();
        this.wilds.clear();
        this.bubbles.clear();
        this.path = [];
        this.pathAct = null;
        this.channel = null;
        for (const lot of m.lots)
          this.lots.set(lot.ownerId, {
            lot,
            geo: this.village.lots[lot.lotId],
          });
        const me = m.players.find((p) => p.id === m.you.id);
        this.player = {
          x: me?.x ?? this.village.spawn.x,
          y: me?.y ?? this.village.spawn.y,
        };
        this.carrying = me?.c || null;
        this.carryingAppearance = me?.c ? me.cp ?? null : null;
        for (const p of m.players)
          if (p.id !== m.you.id) this.remotes.set(p.id, p);
        this.revision++;
        this.ready = true;
        this.lastSend = 0;
        this.hud.refresh();
        this.hud.feedRender();
        if (this.pendingWallet) {
          const w = this.pendingWallet;
          this.pendingWallet = null;
          void this.connectWallet(w);
        }
        this.hud.toast(
          `${COPY.village}: ${this.villageName}. ${COPY.controls}`,
          6000,
        );
        // Second beat, after the controls have had the screen to themselves: how to get on
        // the prize board. Only shown to players who have not linked a wallet yet.
        if (!this.you?.land?.address) {
          setTimeout(() => this.hud.toast(COPY.landPrompt, 9000), 6500);
        }
        break;
      }
      case "correction": {
        this.player.x = m.x; this.player.y = m.y;
        this.path = []; this.pathAct = null; this.moving = false;
        this.inputDirty = true;
        break;
      }
      case "snap": {
        this.serverClock.sample(m.now);
        this.remotes.clear();
        for (const p of m.p) {
          if (p.id === this.you?.id) {
            this.carrying = p.c || null;
            this.carryingAppearance = p.c ? p.cp ?? null : null;
            if (Math.hypot(p.x - this.player.x, p.y - this.player.y) > 48) {
              this.player.x = p.x;
              this.player.y = p.y;
            }
          } else this.remotes.set(p.id, p);
        }
        break;
      }
      case "state":
        if (this.you) {
          Object.assign(this.you, m.you);
          this.hud.refresh();
        }
        break;
      case "lot":
        if (this.village) {
          if (m.removed) this.lots.delete(m.lot.ownerId);
          else
            this.lots.set(m.lot.ownerId, {
              lot: m.lot,
              geo: this.village.lots[m.lot.lotId],
            });
          this.revision++;
        }
        break;
      case "players":
        for (const [id, n] of Object.entries(m.names)) this.names.set(id, n);
        for (const id of m.left ?? []) this.remotes.delete(id);
        this.hud.refresh();
        break;
      case "feed":
        this.feed.unshift(m.e);
        this.feed.length = Math.min(40, this.feed.length);
        this.hud.feedRender();
        break;
      case "reveal":
        sfx.reveal(E.tierIndex(m.plant.tier));
        this.hud.reveal(m.plant, speciesById(m.plant.speciesId));
        break;
      case "toast":
      case "error":
        this.hud.toast(m.text);
        break;
      case "chat":
        this.bubbles.set(m.id, { text: m.text, until: Date.now() + 4000 });
        this.hud.chatLine(m.name, m.text);
        break;
      case "emote":
        this.bubbles.set(m.id, {
          text: P.EMOTES[m.e] ?? "",
          until: Date.now() + 4000,
        });
        break;
      case "channel":
        this.channel = m.kind
          ? { kind: m.kind, start: Date.now(), dur: m.endsAt - m.startedAt }
          : null;
        break;
      case "carry":
        this.carrying = m.speciesId;
        this.carryingAppearance = m.speciesId ? m.appearance ?? null : null;
        if (m.speciesId) {
          sfx.scream();
          this.hud.toast(COPY.runHome);
        }
        this.hud.refresh();
        break;
      case "wild":
        if (m.all) {
          this.wilds.clear();
          for (const w of m.all) this.wilds.set(w.id, { w });
        }
        for (const w of m.add ?? []) this.wilds.set(w.id, { w });
        for (const id of m.remove ?? []) this.wilds.delete(id);
        break;
      case "event":
        this.event = m.ev;
        this.hud.banner(Date.now());
        if (m.ev?.kind === "screaming_hour")
          this.view.effect("scream", this.player.x, this.player.y);
        break;
      case "market":
        this.market = { sectors: m.sectors, headline: m.headline, season: m.season, standing: m.standing };
        renderTape(this.market);
        break;
      case "board":
        this.board = m.sprint;
        if (m.bounties) this.bounties = m.bounties;
        if (m.trophies) this.trophies = m.trophies;
        this.hud.refresh();
        break;
      case "villages":
        this.villages = m.list;
        this.hud.refresh();
        break;
      case "sprint":
        if (m.phase === "start") {
          this.sprintStartedAt = Date.now();
          this.hud.toast(COPY.sprintStart);
        } else if (m.phase === "turn") this.hud.toast(COPY.sprintTurn);
        else {
          this.sprintStartedAt = 0;
          if (m.phase === "finish") {
            this.hud.toast(
              `${COPY.sprintDone} ${((m.ms ?? 0) / 1000).toFixed(2)} s`,
            );
            sfx.fanfare();
          }
        }
        this.hud.banner(Date.now());
        break;
      case "nonce":
        void this.onNonce(m.address, m.message);
        break;
      case "identity":
        saveIdentity({ id: m.id, secret: m.secret, name: m.name });
        this.net.close();
        location.reload();
        break;
      case "npc":
        this.hud.talk(m.npc, m.name, m.line, m.missions);
        break;
      case "say":
        this.hud.say(m.name, m.text, m.npc, m.requestId);
        this.bubbles.set("npc_" + m.npc, {
          text: m.text.slice(0, 60),
          until: Date.now() + 5000,
        });
        break;
      case "linked":
        if (this.you) {
          this.you.land = m.land;
          this.you.plotCount = m.plotCount;
          this.you.rarityFloor = m.rarityFloor;
        }
        this.hud.refresh();
        if (m.address) this.hud.open("land");
        break;
      case "pong":
        break;
    }
  }
  gateClosed = (tx: number, ty: number): boolean =>
    [...this.lots.values()].some(
      (v) =>
        v.geo.gate.tx === tx &&
        v.geo.gate.ty === ty &&
        v.lot.defenses.gateHp > 0,
    );
  tick(dt: number, input: { x: number; y: number }): void {
    if (!this.ready || !this.you || !this.village) return;
    const now = Date.now();
    const direction = cameraInput(input.x + this.joy.x, input.y + this.joy.y, this.inputYaw);
    let dx = direction.x, dy = direction.y;
    if (dx || dy) {
      this.path = [];
      this.pathAct = null;
    } else if (this.path.length) {
      const wp = this.path[0],
        ex = wp.x - this.player.x,
        ey = wp.y - this.player.y,
        d = Math.hypot(ex, ey);
      if (d < 4) {
        this.path.shift();
        if (!this.path.length) {
          const act = this.pathAct;
          this.pathAct = null;
          act?.();
        }
      } else {
        dx = ex / d;
        dy = ey / d;
      }
    }
    const was = this.moving;
    this.moving = !!(dx || dy);
    if (this.moving) {
      if (this.channel) {
        this.channel = null;
        this.net.send({ t: "cancel" });
      }
      const p = predictMovement(
        this.village,
        this.player,
        { x: dx, y: dy },
        dt,
        this.you.speedLevel,
        this.carrying,
        this.you.id,
        [...this.lots.values()],
        this.gateClosed,
      );
      if (p.x === this.player.x && p.y === this.player.y && this.path.length) {
        this.path = [];
        this.pathAct = null;
      }
      this.player = p;
      if (Math.abs(dx) > Math.abs(dy)) {
        this.dir = "side";
        this.flip = dx < 0;
      } else this.dir = dy < 0 ? "up" : "down";
    }
    if (was !== this.moving) this.inputDirty = true;
    if (
      now - this.lastSend >= 100 &&
      (this.moving || this.inputDirty || this.lastSend === 0)
    ) {
      this.net.send({
        t: "input",
        dx,
        dy,
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        d: this.dir,
        f: this.flip,
        m: this.moving,
      });
      this.lastSend = now;
      this.inputDirty = false;
    }
    if (now - this.lastSecond >= 1000) {
      this.lastSecond = now;
      this.hud.banner(now);
      if (sfx.ready) sfx.ambientStart(this.villageBiome);
    }
    if (this.moving && now - this.lastStep > 260) {
      this.lastStep = now;
      sfx.step();
    }
    for (const [id, b] of this.bubbles)
      if (now > b.until) this.bubbles.delete(id);
  }
  nearestWild(): { w: P.Wild; d: number } | null {
    let best: { w: P.Wild; d: number } | null = null;
    for (const { w } of this.wilds.values()) {
      const d = Math.hypot(w.x - this.player.x, w.y - this.player.y);
      if (d < 44 && (!best || d < best.d)) best = { w, d };
    }
    return best;
  }
  // ------------------------------------------------------------ wallet (read-only)
  async connectWallet(walletId: string): Promise<void> {
    if (this.linking) return;
    clearTimeout(this.walletTimer);
    if (!this.net.connected) { this.hud.toast(COPY.disconnected, 3000); return; }
    if (!hasWallet()) {
      this.hud.toast(COPY.noWallet, 5000);
      return;
    }
    this.linking = true;
    this.walletId = walletId;
    try {
      const address = await connectAddress(walletId);
      this.pendingAddress = address;
      this.net.send({ t: "nonce", address });
      this.walletTimer = setTimeout(() => {
        if (this.pendingAddress === address) { this.pendingAddress = null; this.linking = false; cancelWallet(); this.hud.toast(COPY.linkFail, 4000); }
      }, 30_000);
    } catch (error) {
      this.linking = false;
      this.hud.toast(COPY[walletFailureKey(error) ?? 'noWallet'], 4000);
    }
  }
  pendingAddress: string | null = null;
  private walletTimer?: ReturnType<typeof setTimeout>;
  walletId = "metamask";
  async onNonce(address: string, message: string): Promise<void> {
    if (address !== this.pendingAddress) {
      return;
    }
    clearTimeout(this.walletTimer); this.pendingAddress = null;
    try {
      this.hud.toast(COPY.signing, 6000);
      const signature = await signMessageWith(this.walletId, address, message);
      this.net.send({ t: "link", address, signature });
    } catch (error) {
      this.hud.toast(COPY[walletFailureKey(error) ?? 'linkFail'], 4000);
    } finally {
      this.linking = false;
    }
  }
  zoomLevel = 0;
  toggleZoom(): void {
    this.zoomLevel = (this.zoomLevel + 1) % 3;
  }
  unlinkWallet(): void {
    cancelWallet(); this.pendingAddress = null; this.linking = false;
    this.net.send({ t: "unlink" });
  }

  nearestPlot(): {
    view: LotView;
    i: number;
    pos: { x: number; y: number };
    plot: P.PublicPlot | null;
    mine: boolean;
  } | null {
    let best: ReturnType<WorldState["nearestPlot"]> = null;
    let bd = INTERACT_RADIUS;
    for (const v of this.lots.values())
      for (let i = 0; i < v.lot.plotCount; i++) {
        const pos = {
          x: v.geo.plots[i].tx * TILE + 16,
          y: v.geo.plots[i].ty * TILE + 16,
        };
        const d = Math.hypot(pos.x - this.player.x, pos.y - this.player.y);
        if (d < bd) {
          bd = d;
          best = {
            view: v,
            i,
            pos,
            plot: v.lot.plots.find((p) => p.i === i) ?? null,
            mine: v.lot.ownerId === this.you!.id,
          };
        }
      }
    return best;
  }

  onTap(x: number, y: number): void {
    if (!this.ready) return;
    for (const v of this.lots.values()) {
      for (let i = 0; i < v.lot.plotCount; i++) {
        const pos = {
          x: v.geo.plots[i].tx * TILE + 16,
          y: v.geo.plots[i].ty * TILE + 16,
        };
        if (Math.abs(pos.x - x) <= 16 && Math.abs(pos.y - y) <= 20) {
          const act = () => this.interactPlot(v, i);
          if (
            Math.hypot(pos.x - this.player.x, pos.y - this.player.y) <
            INTERACT_RADIUS
          )
            act();
          else this.goTo({ x: pos.x, y: pos.y + 24 }, act);
          return;
        }
      }
      const g = lotGatePx(v.geo);
      if (
        v.lot.ownerId !== this.you!.id &&
        v.lot.defenses.gateHp > 0 &&
        Math.abs(g.x - x) <= 16 &&
        Math.abs(g.y - y) <= 16
      ) {
        const out = {
          x:
            g.x +
            (v.geo.gateSide === "left"
              ? -28
              : v.geo.gateSide === "right"
                ? 28
                : 0),
          y:
            g.y +
            (v.geo.gateSide === "top"
              ? -28
              : v.geo.gateSide === "bottom"
                ? 28
                : 0),
        };
        const act = () => this.net.send({ t: "break", ownerId: v.lot.ownerId });
        if (Math.hypot(g.x - this.player.x, g.y - this.player.y) < 48) act();
        else this.goTo(out, act);
        return;
      }
    }
    for (const { w } of this.wilds.values()) {
      if (Math.abs(w.x - x) <= 16 && Math.abs(w.y - y) <= 20) {
        const act = () => {
          this.net.send({ t: "forage", id: w.id });
          sfx.forage();
        };
        if (Math.hypot(w.x - this.player.x, w.y - this.player.y) < 44) act();
        else this.goTo({ x: w.x, y: w.y }, act);
        return;
      }
    }
    const v = this.village!;
    for (const n of v.npcs) {
      const nx = n.tx * TILE + 16;
      const ny = n.ty * TILE + 16;
      if (Math.abs(nx - x) <= 18 && Math.abs(ny - y) <= 24) {
        const act = () => this.net.send({ t: "talk", npc: n.id });
        if (Math.hypot(nx - this.player.x, ny - this.player.y) < 56) act();
        else this.goTo({ x: nx, y: ny + TILE }, act);
        return;
      }
    }
    if (
      Math.abs(x - (v.conveyor.tx * TILE + 32)) < 40 &&
      Math.abs(y - v.conveyor.ty * TILE) < 32
    ) {
      this.hud.open("conveyor");
      return;
    }
    if (
      Math.abs(x - (v.board.tx * TILE + 32)) < 36 &&
      Math.abs(y - v.board.ty * TILE) < 32
    ) {
      this.hud.open("feed");
      return;
    }
    const sign = v.props.find((p) => p.kind === "sign");
    if (
      sign &&
      Math.abs(x - (sign.tx * TILE + 16)) < 20 &&
      Math.abs(y - (sign.ty * TILE + 16)) < 24
    ) {
      if (this.you?.visiting) this.goHome();
      else this.hud.open("villages");
      return;
    }
    const tr = { x: v.track.tx * TILE + 32, y: v.track.ty * TILE + 16 };
    if (Math.abs(x - tr.x) < 36 && Math.abs(y - tr.y) < 20) {
      const act = () => this.net.send({ t: "sprint" });
      if (Math.hypot(tr.x - this.player.x, tr.y - this.player.y) < 48) act();
      else this.goTo({ x: tr.x, y: tr.y + 6 }, act);
      return;
    }
    this.goTo({ x, y });
  }

  goTo(target: { x: number; y: number }, act?: () => void): void {
    const p = findPath(
      this.village!,
      { x: this.player.x, y: this.player.y },
      target,
      this.gateClosed,
    );
    this.path = p ?? [target];
    this.pathAct = act ?? null;
  }

  interactNearest(): void {
    if (!this.ready || !this.village || !this.you) return;
    for (const npc of this.village!.npcs)
      if (
        Math.hypot(
          npc.tx * TILE + 16 - this.player.x,
          npc.ty * TILE + 16 - this.player.y,
        ) < 56
      ) {
        this.net.send({ t: "talk", npc: npc.id });
        return;
      }
    const w = this.nearestWild();
    const n = this.nearestPlot();
    if (
      w &&
      (!n || w.d < Math.hypot(n.pos.x - this.player.x, n.pos.y - this.player.y))
    ) {
      this.net.send({ t: "forage", id: w.w.id });
      sfx.forage();
      return;
    }
    if (n) this.interactPlot(n.view, n.i);
  }

  interactPlot(v: LotView, i: number): void {
    const p = v.lot.plots.find((x) => x.i === i) ?? null;
    if (v.lot.ownerId === this.you!.id) {
      if (this.lockMode && p) {
        this.lockMode = false;
        this.net.send({ t: "shop", item: "lock", plotId: i });
        return;
      }
      if (!p) {
        if (this.selectedSeed) {
          this.net.send({ t: "plant", seedUid: this.selectedSeed, plotId: i });
          this.selectedSeed = null;
          sfx.plant();
          this.splash(
            v.geo.plots[i].tx * TILE + 16,
            v.geo.plots[i].ty * TILE + 16,
            0x8c5a3c,
          );
        } else if (this.you!.seeds.length) this.hud.open("seeds");
        else {
          this.hud.toast(COPY.emptySeeds);
          this.hud.open("conveyor");
        }
      } else {
        this.net.send({ t: "tend", plotId: i });
        sfx.tend();
        this.splash(
          v.geo.plots[i].tx * TILE + 16,
          v.geo.plots[i].ty * TILE + 6,
          0x78c8f0,
        );
        if (!p.revealed)
          this.wetMark(
            v.geo.plots[i].tx * TILE + 16,
            v.geo.plots[i].ty * TILE + 16,
          );
      }
      return;
    }
    if (p && p.revealed)
      this.net.send({ t: "uproot", ownerId: v.lot.ownerId, plotId: i });
    else this.hud.toast(COPY.raidNotReady);
  }

  splash(x: number, y: number, _color: number): void {
    this.view.effect("water", x, y);
  }
  wetMark(x: number, y: number): void {
    this.view.effect("water", x, y);
  }
  buySeed(i: number): void {
    this.net.send({ t: "buy", slot: i });
    sfx.buy();
  }
  selectSeed(uid: string): void {
    if (!this.you!.plots.some((p) => !p)) {
      sfx.deny();
      this.hud.toast(COPY.noFreePlot);
      return;
    }
    this.selectedSeed = uid;
    this.hud.close();
    this.hud.toast(COPY.plantPrompt, 4000);
  }
  cosmetic(item: P.CosmeticItem): void {
    this.net.send({ t: "cosmetic", item });
    sfx.buy();
  }
  mission(id: string, action: "accept" | "claim"): void {
    this.net.send({ t: "mission", id, action });
    if (action === "claim") sfx.fanfare();
    else sfx.tend();
  }
  ask(npc: string, text: string, requestId?: string): void {
    this.net.send({ t: "ask", npc, text, requestId });
  }
  wardrobe(shirt?: number, hat?: number, skin?: number, hair?: number): void {
    this.net.send({ t: "wardrobe", shirt, hat, skin, hair });
    sfx.buy();
  }
  nick(plotId: number, name: string): void {
    this.net.send({ t: "nick", plotId, name });
  }
  visit(villageId: string): void {
    this.net.send({ t: "visit", village: villageId });
    this.hud.close();
  }
  goHome(): void {
    this.net.send({ t: "home" });
    this.hud.close();
  }
  postBounty(thiefId: string, amount: number): void {
    this.net.send({ t: "bounty", thiefId, amount });
  }
  refreshVillages(): void {
    this.net.send({ t: "villages" });
  }
  shop(item: P.ShopItem): void {
    if (item === "lock") {
      this.lockMode = true;
      this.hud.close();
      this.hud.toast(COPY.defLockDesc, 4000);
      return;
    }
    this.net.send({ t: "shop", item });
  }
  chat(text: string): void {
    this.net.send({ t: "chat", text });
  }
  emote(e: number): void {
    this.net.send({ t: "emote", e });
  }

  frameRect(name: string): { x: number; y: number } {
    return this.view.frameRect(name);
  }
  tierOf(id: string): Tier {
    return speciesById(id).tier;
  }
  onlineCount(): number {
    return this.remotes.size + 1;
  }
}
