import Phaser from 'phaser';
import { ROSTER } from '../content';

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  preload(): void {
    const base = 'sprites/';
    for (const a of ['plants', 'tiles', 'chars', 'props', 'ui']) this.load.atlas(a, `${base}${a}.png`, `${base}${a}.json`);
    const bar = this.add.rectangle(240, 135, 0, 6, 0xf0c434).setOrigin(0, 0.5).setX(140);
    this.load.on('progress', (v: number) => bar.setSize(200 * v, 6));
  }

  create(): void {
    for (const sp of ROSTER) {
      this.anims.create({
        key: `${sp.id}_idle`,
        frames: this.anims.generateFrameNames('plants', { prefix: `${sp.id}_idle`, start: 0, end: 5 }),
        frameRate: 6,
        repeat: -1,
      });
    }
    for (const d of ['down', 'up', 'side']) {
      this.anims.create({ key: `walk_${d}`, frames: this.anims.generateFrameNames('chars', { prefix: `farmer_${d}`, start: 0, end: 1 }), frameRate: 6, repeat: -1 });
    }
    this.anims.create({ key: 'conveyor', frames: this.anims.generateFrameNames('props', { prefix: 'conveyor', start: 0, end: 1 }), frameRate: 4, repeat: -1 });
    this.scene.start('garden');
  }
}
