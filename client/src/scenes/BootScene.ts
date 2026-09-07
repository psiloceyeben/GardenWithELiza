import Phaser from 'phaser';
import { ROSTER } from '../content';
import { BIOME_NAMES } from '@shared/world';

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  preload(): void {
    const base = 'sprites/';
    for (const a of ['plants', 'chars', 'props', 'plaza', 'ui', 'town']) this.load.atlas(a, `${base}${a}.png`, `${base}${a}.json`);
    for (let b = 0; b < BIOME_NAMES.length; b++) this.load.spritesheet(`tiles_b${b}`, `${base}tiles_b${b}.png`, { frameWidth: 32, frameHeight: 32 });
    const bar = this.add.rectangle(140, 135, 0, 6, 0xf0c434).setOrigin(0, 0.5);
    this.load.on('progress', (v: number) => bar.setSize(200 * v, 6));
  }

  create(): void {
    for (const sp of ROSTER) {
      this.anims.create({ key: `${sp.id}_idle`, frames: this.anims.generateFrameNames('plants', { prefix: `${sp.id}_idle`, start: 0, end: 5 }), frameRate: 6, repeat: -1 });
    }
    for (let v = 0; v < 6; v++) for (let h = 0; h < 4; h++) {
      for (const d of ['down', 'up', 'side', 'carry']) {
        this.anims.create({ key: `walk${v}${h}_${d}`, frames: this.anims.generateFrameNames('chars', { prefix: `farmer${v}${h}_${d}`, start: 0, end: 1 }), frameRate: 6, repeat: -1 });
      }
    }
    this.anims.create({ key: 'gnome', frames: this.anims.generateFrameNames('chars', { prefix: 'gnome', start: 0, end: 1 }), frameRate: 3, repeat: -1 });
    this.anims.create({ key: 'npc', frames: this.anims.generateFrameNames('chars', { prefix: 'npc', start: 0, end: 1 }), frameRate: 2, repeat: -1 });
    for (const n of ['mayor', 'seedwife', 'barkeep', 'oracle', 'warden']) this.anims.create({ key: `npc_${n}`, frames: this.anims.generateFrameNames('chars', { prefix: `npc_${n}`, start: 0, end: 1 }), frameRate: 2, repeat: -1 });
    this.anims.create({ key: 'fountain', frames: this.anims.generateFrameNames('plaza', { prefix: 'fountain', start: 0, end: 1 }), frameRate: 4, repeat: -1 });
    this.anims.create({ key: 'sprinkler', frames: this.anims.generateFrameNames('props', { prefix: 'sprinkler', start: 0, end: 1 }), frameRate: 3, repeat: -1 });
    this.scene.start('world');
  }
}
