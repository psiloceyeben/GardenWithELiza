import Phaser from 'phaser';
import type { GameState, Plant, Plot, Tier } from '@shared/types';
import * as E from '@shared/economy';
import { mulberry32, randomSeed, uid } from '@shared/rng';
import { ROSTER, speciesById, COPY } from '../content';
import { load, save, PLOT_COUNT } from '../state';
import { Hud } from '../ui/hud';
import { sfx } from '../audio';

const TILE = 32;
const COLS = 15;
const ROWS = 9;
const PLOT_COLS = [5, 7, 9];
const PLOT_ROWS = [3, 5];
const INTERACT_RADIUS = 40;
const BASE_SPEED = 90; // px/s

interface PlotView {
  plot: Plot;
  cx: number;
  cy: number;
  sprite: Phaser.GameObjects.Sprite | null;
  sparkle: Phaser.GameObjects.Image | null;
  feral: Phaser.Time.TimerEvent | null;
  scream: Phaser.Time.TimerEvent | null;
  holo: boolean;
  renderedUid: string | null;
}

export class GardenScene extends Phaser.Scene {
  state!: GameState;
  hud!: Hud;
  rng = mulberry32(randomSeed());
  player!: Phaser.GameObjects.Sprite;
  views: PlotView[] = [];
  highlight!: Phaser.GameObjects.Graphics;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  moveTarget: { x: number; y: number; plotId?: number } | null = null;
  selectedSeed: string | null = null;
  lastTick = 0;
  lastSave = 0;
  hue = 0;

  constructor() { super('garden'); }

  // ------------------------------------------------------------ setup
  create(): void {
    const now = Date.now();
    const { state, offlineSap, fresh } = load(now);
    this.state = state;

    this.buildGround();
    for (const r of PLOT_ROWS) for (const c of PLOT_COLS) {
      const id = this.views.length;
      this.add.image(c * TILE, r * TILE, 'tiles', 'plot').setOrigin(0).setDepth(1);
      this.views.push({ plot: this.state.plots[id], cx: c * TILE + 16, cy: r * TILE + 16, sprite: null, sparkle: null, feral: null, scream: null, holo: false, renderedUid: null });
    }
    this.highlight = this.add.graphics().setDepth(2);

    this.add.sprite(7 * TILE + 16, TILE + 16, 'props', 'conveyor0').setDepth(TILE + 16).play('conveyor');
    this.add.image(2 * TILE, TILE + 40, 'props', 'tree1').setOrigin(0.5, 1).setDepth(TILE + 40);
    this.add.image(12 * TILE + 16, TILE + 28, 'props', 'sprinkler0').setDepth(TILE + 28);

    this.player = this.add.sprite(240, 220, 'chars', 'farmer_down0').setOrigin(0.5, 30 / 32).setDepth(220);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D,E,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p.worldX, p.worldY));
    this.input.keyboard!.on('keydown-E', () => this.interactNearest());
    this.input.keyboard!.on('keydown-SPACE', () => this.interactNearest());
    this.input.once('pointerdown', () => sfx.unlock());
    this.input.keyboard!.once('keydown', () => sfx.unlock());

    this.hud = new Hud(this);
    for (const v of this.views) this.syncPlotSprite(v, now);
    this.hud.refresh();

    if (fresh) this.hud.toast(`${COPY.welcome} ${COPY.controls}`, 6000);
    else if (offlineSap > 0) this.hud.toast(`${COPY.offlineBack} ${offlineSap} ${COPY.sap}.`, 5000);

    const persist = () => save(this.state, Date.now());
    window.addEventListener('beforeunload', persist);
    document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
    this.events.on('shutdown', () => window.removeEventListener('beforeunload', persist));
  }

  buildGround(): void {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const edge = r === 0 || c === 0 || c === COLS - 1 || r === ROWS - 1;
      let kind = edge ? 'hedge' : (r * 7 + c * 3) % 5 === 0 ? 'grass2' : 'grass';
      if (!edge && (r === 7 || (c === 7 && (r === 2 || r === 4 || r === 6)))) kind = "path";
      this.add.image(c * TILE, r * TILE, 'tiles', kind).setOrigin(0).setDepth(0);
    }
  }

  // ------------------------------------------------------------ loop
  update(time: number, delta: number): void {
    this.movePlayer(delta / 1000);
    this.drawHighlight();
    if (this.hue++ % 4 === 0) this.tickHolo();
    if (time - this.lastTick >= 1000) { this.lastTick = time; this.economyTick(); }
    if (time - this.lastSave >= 5000) { this.lastSave = time; save(this.state, Date.now()); }
  }

  movePlayer(dt: number): void {
    let dx = 0; let dy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) dy += 1;
    if (dx || dy) this.moveTarget = null;
    else if (this.moveTarget) {
      const ex = this.moveTarget.x - this.player.x; const ey = this.moveTarget.y - this.player.y;
      const dist = Math.hypot(ex, ey);
      if (dist < 3) {
        const t = this.moveTarget; this.moveTarget = null;
        if (t.plotId !== undefined) this.interact(this.views[t.plotId]);
      } else { dx = ex / dist; dy = ey / dist; }
    }
    if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1;
      const sp = BASE_SPEED * E.speedMult(this.state.speedLevel) * dt;
      this.player.x = Phaser.Math.Clamp(this.player.x + (dx / len) * sp, 44, 436);
      this.player.y = Phaser.Math.Clamp(this.player.y + (dy / len) * sp, 60, 262);
      if (Math.abs(dx) > Math.abs(dy)) { this.player.play('walk_side', true); this.player.setFlipX(dx < 0); }
      else this.player.play(dy < 0 ? 'walk_up' : 'walk_down', true);
    } else if (this.player.anims.isPlaying) {
      const key = this.player.anims.currentAnim?.key ?? 'walk_down';
      this.player.stop(); this.player.setFrame(`farmer_${key.replace('walk_', '')}0`);
    }
    this.player.setDepth(this.player.y);
  }

  nearestView(): PlotView | null {
    let best: PlotView | null = null; let bd = INTERACT_RADIUS;
    for (const v of this.views) {
      const d = Math.hypot(v.cx - this.player.x, v.cy - this.player.y);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  drawHighlight(): void {
    this.highlight.clear();
    const v = this.nearestView();
    if (!v) return;
    this.highlight.lineStyle(1, this.selectedSeed && !v.plot.plant ? 0xf0c434 : 0xffffff, 0.8);
    this.highlight.strokeRect(v.cx - 15, v.cy - 15, 31, 31);
  }

  tickHolo(): void {
    const h = (Date.now() / 20) % 360;
    for (const v of this.views) if (v.holo && v.sprite) v.sprite.setTint(Phaser.Display.Color.HSVToRGB(h / 360, 0.45, 1).color);
  }

  // ------------------------------------------------------------ input
  onTap(x: number, y: number): void {
    let target: PlotView | null = null;
    for (const v of this.views) if (Math.abs(v.cx - x) <= 18 && Math.abs(v.cy - y) <= 22) target = v;
    if (target) {
      if (Math.hypot(target.cx - this.player.x, target.cy - this.player.y) < INTERACT_RADIUS) this.interact(target);
      else this.moveTarget = { x: target.cx, y: target.cy + 26, plotId: this.views.indexOf(target) };
      return;
    }
    if (Math.abs(x - (7 * TILE + 16)) < 24 && Math.abs(y - (TILE + 16)) < 16) { this.hud.open('conveyor'); return; }
    this.moveTarget = { x, y };
  }

  interactNearest(): void {
    const v = this.nearestView();
    if (v) this.interact(v);
  }

  interact(v: PlotView): void {
    const now = Date.now();
    const p = v.plot.plant;
    if (!p) {
      if (this.selectedSeed) this.plantSeed(this.selectedSeed, v.plot.id);
      else if (this.state.seeds.length) this.hud.open('seeds');
      else { this.hud.toast(COPY.emptySeeds); this.hud.open('conveyor'); }
      return;
    }
    if (!p.revealed) {
      if (!p.watered) {
        const remaining = Math.max(0, p.plantedAt + p.growMs - now);
        p.growMs -= Math.round(remaining * E.WATER_BONUS); p.watered = true;
        sfx.tend(); this.hud.toast(`${COPY.watered}. ${speciesById(p.speciesId).name} ${COPY.growing.toLowerCase()}.`);
        this.splash(v.cx, v.cy - 10, 0x78c8f0);
      } else this.hud.toast(`${COPY.growing}: ${this.hud.fmtTime(p.plantedAt + p.growMs - now)}`);
      return;
    }
    if (now - p.lastWeeded >= E.WEED_COOLDOWN_MS) {
      const bonus = Math.floor(E.sapPerSec(p, speciesById(p.speciesId)) * E.WEED_BONUS_SEC);
      p.lastWeeded = now; this.state.sap += bonus; sfx.tend();
      this.splash(v.cx, v.cy - 10, 0xf0c434);
      this.hud.toast(`${COPY.weeded}! +${bonus} ${COPY.sap}`); this.hud.refresh();
    } else this.hud.toast(`${speciesById(p.speciesId).name}: ${Math.round(E.sapPerSec(p, speciesById(p.speciesId)) * 100) / 100} ${COPY.sapPerSec}`);
  }

  splash(x: number, y: number, color: number): void {
    for (let i = 0; i < 6; i++) {
      const dot = this.add.rectangle(x, y, 2, 2, color).setDepth(999);
      this.tweens.add({ targets: dot, x: x + Phaser.Math.Between(-14, 14), y: y - Phaser.Math.Between(6, 22), alpha: 0, duration: 500, onComplete: () => dot.destroy() });
    }
  }

  // ------------------------------------------------------------ actions (server-side in M3)
  buySeed(i: number): void {
    const slot = this.state.conveyor.slots[i];
    if (!slot || slot.sold) return;
    if (this.state.sap < slot.price) { sfx.deny(); this.hud.toast(COPY.cantAfford); return; }
    this.state.sap -= slot.price; slot.sold = true;
    this.state.seeds.push({ uid: uid('s'), speciesId: slot.speciesId, tier: slot.tier });
    this.state.stats.seedsBought += 1;
    if (!this.state.stats.firstSeedAt) this.state.stats.firstSeedAt = Date.now();
    this.log(`${COPY.logBought} ${speciesById(slot.speciesId).name}`);
    sfx.buy(); this.hud.refresh();
  }

  selectSeed(seedUid: string): void {
    if (!this.state.plots.some((p) => !p.plant)) { sfx.deny(); this.hud.toast(COPY.noFreePlot); return; }
    this.selectedSeed = seedUid; this.hud.close(); this.hud.toast(COPY.plantPrompt, 4000);
  }

  plantSeed(seedUid: string, plotId: number): void {
    const idx = this.state.seeds.findIndex((s) => s.uid === seedUid);
    const plot = this.state.plots[plotId];
    if (idx < 0 || plot.plant) return;
    const seed = this.state.seeds.splice(idx, 1)[0];
    const now = Date.now();
    plot.plant = { uid: uid('p'), speciesId: seed.speciesId, tier: seed.tier, plantedAt: now, growMs: E.GROW_MS[seed.tier], revealed: false, size: 1, mutation: 'none', watered: false, lastWeeded: now };
    this.selectedSeed = null;
    this.log(`${COPY.logPlanted} ${speciesById(seed.speciesId).name}`);
    sfx.plant(); this.syncPlotSprite(this.views[plotId], now); this.hud.refresh();
    this.splash(this.views[plotId].cx, this.views[plotId].cy, 0x8c5a3c);
  }

  trainSpeed(): void {
    if (this.state.speedLevel >= E.SPEED_MAX_LEVEL) return;
    const cost = E.speedCost(this.state.speedLevel);
    if (this.state.sap < cost) { sfx.deny(); this.hud.toast(COPY.cantAfford); return; }
    this.state.sap -= cost; this.state.speedLevel += 1; sfx.buy(); this.hud.refresh();
  }

  log(line: string): void {
    this.state.log.unshift(line);
    if (this.state.log.length > 30) this.state.log.length = 30;
  }

  // ------------------------------------------------------------ economy
  economyTick(): void {
    const now = Date.now();
    let sps = 0;
    for (const v of this.views) {
      const p = v.plot.plant;
      if (!p) continue;
      if (!p.revealed && now >= p.plantedAt + p.growMs) this.reveal(v, now);
      else if (!p.revealed) this.syncPlotSprite(v, now);
      if (p.revealed) sps += E.sapPerSec(p, speciesById(p.speciesId));
    }
    this.state.sap += sps;
    if (now >= this.state.conveyor.refreshAt) {
      this.state.conveyor = { slots: E.rollConveyor(this.rng, ROSTER, this.state.rarityFloor, PLOT_COUNT), refreshAt: now + E.CONVEYOR_REFRESH_MS };
      this.hud.toast(`${COPY.conveyor}: new seeds!`);
    }
    this.hud.refresh();
  }

  reveal(v: PlotView, now: number): void {
    const p = v.plot.plant!;
    const roll = E.rollReveal(this.rng);
    p.revealed = true; p.size = roll.size; p.mutation = roll.mutation; p.lastWeeded = now;
    this.state.stats.reveals += 1;
    const sp = speciesById(p.speciesId);
    this.log(`${sp.name} ${COPY.logSprouted}${p.mutation !== 'none' ? ` (${p.mutation})` : ''}`);
    sfx.reveal(E.tierIndex(p.tier));
    this.syncPlotSprite(v, now);
    this.hud.reveal(p, sp);
    this.cameras.main.flash(200, 255, 240, 200);
  }

  // ------------------------------------------------------------ rendering
  syncPlotSprite(v: PlotView, now: number): void {
    const p = v.plot.plant;
    if (!p) { this.clearView(v); return; }
    if (v.renderedUid !== p.uid) {
      this.clearView(v);
      v.sprite = this.add.sprite(v.cx, v.cy + 12, 'plants', `${p.speciesId}_grow0`).setOrigin(0.5, 44 / 48).setDepth(v.cy + 12);
      v.renderedUid = p.uid;
      if (p.revealed) this.applyMutation(v, p);
    }
    const s = v.sprite!;
    if (!p.revealed) {
      const prog = Phaser.Math.Clamp((now - p.plantedAt) / p.growMs, 0, 0.999);
      s.setFrame(`${p.speciesId}_grow${Math.floor(prog * 4)}`);
    } else if (!s.anims.isPlaying) {
      s.play(`${p.speciesId}_idle`);
      this.applyMutation(v, p);
    }
  }

  clearView(v: PlotView): void {
    v.sprite?.destroy(); v.sparkle?.destroy(); v.feral?.remove(); v.scream?.remove();
    v.sprite = null; v.sparkle = null; v.feral = null; v.scream = null; v.holo = false; v.renderedUid = null;
  }

  applyMutation(v: PlotView, p: Plant): void {
    const s = v.sprite!;
    s.setScale(1).setFlipY(false).clearTint();
    switch (p.mutation) {
      case 'golden':
        s.setTint(0xffe28a);
        v.sparkle = this.add.image(v.cx + 9, v.cy - 22, 'ui', 'sparkle').setDepth(v.cy + 13).setScale(0.5);
        this.tweens.add({ targets: v.sparkle, alpha: 0.1, scale: 0.9, duration: 600, yoyo: true, repeat: -1 });
        break;
      case 'holographic': v.holo = true; break;
      case 'colossal': s.setScale(1.5); break;
      case 'backwards': s.setFlipY(true).setOrigin(0.5, 4 / 48).setY(v.cy - 14); break;
      case 'feral':
        v.feral = this.time.addEvent({ delay: 1500, loop: true, callback: () => {
          this.tweens.add({ targets: s, x: v.cx + Phaser.Math.Between(-12, 12), y: v.cy + 12 + Phaser.Math.Between(-6, 6), duration: 700, ease: 'Sine.easeInOut' });
        } });
        break;
      case 'screaming':
        v.scream = this.time.addEvent({ delay: 8000, loop: true, callback: () => this.scream(v) });
        break;
    }
  }

  scream(v: PlotView): void {
    sfx.scream();
    this.cameras.main.shake(180, 0.004);
    const t = this.add.text(v.cx, v.cy - 30, 'AAAAAA', { fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#ff5555', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5).setDepth(1000);
    this.tweens.add({ targets: t, y: v.cy - 60, alpha: 0, duration: 1200, onComplete: () => t.destroy() });
  }

  frameRect(name: string): { x: number; y: number } {
    const f = this.textures.getFrame('plants', name);
    return { x: f.cutX, y: f.cutY };
  }

  tierOf(id: string): Tier { return speciesById(id).tier; }
}
