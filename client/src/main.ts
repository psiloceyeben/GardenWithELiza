import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GardenScene } from './scenes/GardenScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 480,
  height: 270,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#181220',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 480, height: 270 },
  scene: [BootScene, GardenScene],
});
