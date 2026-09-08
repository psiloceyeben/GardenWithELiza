import { viewMode } from './view-mode';

async function boot(): Promise<void> {
  if (viewMode(location.search).legacy) {
    const [{ default: Phaser }, { BootScene }, { WorldScene }] = await Promise.all([
      import('phaser'), import('./scenes/BootScene'), import('./scenes/WorldScene'),
    ]);
    new Phaser.Game({
      type: Phaser.AUTO, parent: 'game', width: 640, height: 360,
      pixelArt: true, roundPixels: true, backgroundColor: '#181220',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 640, height: 360 },
      scene: [BootScene, WorldScene],
    });
  } else {
    try {
      const { Renderer3D } = await import('./three/Renderer3D');
      await new Renderer3D().start();
    } catch (error) {
      console.error('3D initialization failed; opening the 2D view.', error);
      const url = new URL(location.href); url.searchParams.set('r', '2d');
      location.replace(url);
    }
  }
}
void boot();
