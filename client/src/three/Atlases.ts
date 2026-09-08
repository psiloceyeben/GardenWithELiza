import * as THREE from "three";
import { QUIET_GRASS_PATCHES } from '@shared/ground-style';
import { T } from "@shared/world";

export const GROUND_CELL = 64;
export const GROUND_PAD = 16;
export const GROUND_WIDTH = GROUND_CELL * 32;
export const GROUND_HEIGHT = GROUND_CELL * 8;

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Sheet {
  texture: THREE.Texture;
  frames: Record<string, { frame: Frame }>;
  width: number;
  height: number;
}
export class Atlases {
  sheets = new Map<string, Sheet>();
  private frames = new Map<string, { texture: THREE.Texture; frame: Frame }>();
  ground!: THREE.CanvasTexture;
  async load(): Promise<void> {
    const loader = new THREE.TextureLoader();
    await Promise.all(
      ["plants", "chars", "props", "plaza", "town", "ui"].map(async (name) => {
        const [texture, response] = await Promise.all([
          loader.loadAsync("sprites/" + name + ".png"),
          fetch("sprites/" + name + ".json"),
        ]);
        if (!response.ok) throw new Error("Atlas unavailable: " + name);
        const json = await response.json();
        texture.magFilter = texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        this.sheets.set(name, {
          texture,
          frames: json.frames,
          width: json.meta.size.w,
          height: json.meta.size.h,
        });
      }),
    );
    // A natural green floor for every village; biome data still drives the game.
    const tiles = await loader.loadAsync("sprites/tiles_b0.png");
    const canvas = document.createElement("canvas");
    canvas.width = GROUND_WIDTH;
    canvas.height = GROUND_HEIGHT;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const tile = document.createElement("canvas");
    tile.width = tile.height = 32;
    const brush = tile.getContext("2d")!;
    const grasses = new Set([T.grass, T.grass2, T.grass3, T.flowers]);
    for (let b = 0; b < 8; b++) for (let t = 0; t < 32; t++) {
      brush.clearRect(0, 0, 32, 32);
      brush.drawImage(tiles.image, t * 32, 0, 32, 32, 0, 0, 32, 32);
      if (grasses.has(t)) {
        // Broad, low-contrast patches replace the high-frequency pixel speckles.
        for (const patch of QUIET_GRASS_PATCHES) {
          brush.fillStyle = '#' + patch.color.toString(16).padStart(6, '0');
          brush.fillRect(patch.x, patch.y, patch.width, patch.height);
        }
      }
      const x = t * GROUND_CELL + GROUND_PAD, y = b * GROUND_CELL + GROUND_PAD;
      ctx.drawImage(tile, x, y);
      // Extruded gutters keep neighboring atlas cells out of filtered samples.
      ctx.drawImage(tile, 0, 0, 1, 32, x - GROUND_PAD, y, GROUND_PAD, 32);
      ctx.drawImage(tile, 31, 0, 1, 32, x + 32, y, GROUND_PAD, 32);
      ctx.drawImage(canvas, x - GROUND_PAD, y, GROUND_CELL, 1, x - GROUND_PAD, y - GROUND_PAD, GROUND_CELL, GROUND_PAD);
      ctx.drawImage(canvas, x - GROUND_PAD, y + 31, GROUND_CELL, 1, x - GROUND_PAD, y + 32, GROUND_CELL, GROUND_PAD);
    }
    tiles.dispose();
    this.ground = new THREE.CanvasTexture(canvas);
    this.ground.magFilter = THREE.LinearFilter;
    this.ground.minFilter = THREE.LinearMipmapLinearFilter;
    this.ground.generateMipmaps = true;
    this.ground.colorSpace = THREE.SRGBColorSpace;
  }
  get(sheet: string, name: string): { texture: THREE.Texture; frame: Frame } {
    const key = sheet + ":" + name,
      hit = this.frames.get(key);
    if (hit) return hit;
    const s = this.sheets.get(sheet),
      f = s?.frames[name]?.frame;
    if (!s || !f) throw new Error("Unknown atlas frame: " + key);
    const texture = s.texture.clone();
    texture.repeat.set(f.w / s.width, f.h / s.height);
    texture.offset.set(f.x / s.width, 1 - (f.y + f.h) / s.height);
    const value = { texture, frame: f };
    this.frames.set(key, value);
    return value;
  }
  frameRect(name: string): { x: number; y: number } {
    return this.get("plants", name).frame;
  }
  dispose(): void {
    for (const v of this.frames.values()) v.texture.dispose();
    for (const s of this.sheets.values()) s.texture.dispose();
    this.ground.dispose();
  }
}
