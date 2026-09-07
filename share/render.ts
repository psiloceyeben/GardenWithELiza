// Share-page snapshot renderer (bible §6.4). Pure-JS PNG compositing from the same sprite atlases the client uses,
// so /garden/<address> looks exactly like the game. No native deps (pngjs only).
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import type { GardenSpec } from '../shared/derive/types';
import { T, LOT_W, LOT_H, TILE } from '../shared/world';

interface Atlas { png: PNG; frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> }
const cache = new Map<string, Atlas | PNG>();

function loadPng(dir: string, name: string): PNG {
  const k = `png:${name}`; if (cache.has(k)) return cache.get(k) as PNG;
  const p = PNG.sync.read(fs.readFileSync(path.join(dir, `${name}.png`))); cache.set(k, p); return p;
}
function loadAtlas(dir: string, name: string): Atlas {
  const k = `atlas:${name}`; if (cache.has(k)) return cache.get(k) as Atlas;
  const a = { png: loadPng(dir, name), frames: JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8')).frames }; cache.set(k, a); return a;
}
function blit(dst: PNG, src: PNG, sx: number, sy: number, w: number, h: number, dx: number, dy: number, scale: number, flipY = false): void {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = ((sy + (flipY ? h - 1 - y : y)) * src.width + (sx + x)) * 4; const a = src.data[si + 3]; if (!a) continue;
    for (let yy = 0; yy < scale; yy++) for (let xx = 0; xx < scale; xx++) {
      const px = dx + x * scale + xx; const py = dy + y * scale + yy; if (px < 0 || py < 0 || px >= dst.width || py >= dst.height) continue;
      const di = (py * dst.width + px) * 4; dst.data[di] = src.data[si]; dst.data[di + 1] = src.data[si + 1]; dst.data[di + 2] = src.data[si + 2]; dst.data[di + 3] = 255;
    }
  }
}

export interface ShareLot { spec: GardenSpec; plants: { i: number; speciesId: string; revealed: boolean; mutation: string; size: number }[]; name: string | null; }

/** Plot slot order must match shared/world.ts addLot (centre-first, 5x4 at pitch 2 from (2,2)). */
function plotSlots(): { tx: number; ty: number }[] {
  const s: { tx: number; ty: number; d: number }[] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) s.push({ tx: 2 + c * 2, ty: 2 + r * 2, d: Math.hypot(c - 2, (r - 1.5) * 1.3) });
  return s.sort((a, b) => a.d - b.d);
}

export function renderLot(spriteDir: string, lot: ShareLot, scale = 2): Buffer {
  const { spec } = lot; const W = (LOT_W + 4) * TILE; const H = (LOT_H + 4) * TILE;
  const out = new PNG({ width: W * scale, height: H * scale });
  const tiles = loadPng(spriteDir, `tiles_b${spec.biome}`); const plants = loadAtlas(spriteDir, 'plants'); const props = loadAtlas(spriteDir, 'props'); const plaza = loadAtlas(spriteDir, 'plaza');
  const tile = (idx: number, tx: number, ty: number) => blit(out, tiles, (idx % 16) * TILE, Math.floor(idx / 16) * TILE, TILE, TILE, tx * TILE * scale, ty * TILE * scale, scale);
  const frame = (a: Atlas, name: string, x: number, y: number, flipY = false) => { const f = a.frames[name]; if (f) blit(out, a.png, f.frame.x, f.frame.y, f.frame.w, f.frame.h, x * scale, y * scale, scale, flipY); };
  // ground + lot
  for (let ty = 0; ty < LOT_H + 4; ty++) for (let tx = 0; tx < LOT_W + 4; tx++) tile((tx * 7 + ty * 3) % 5 === 0 ? T.grass2 : T.grass, tx, ty);
  const ox = 2; const oy = 2;
  for (let j = 0; j < LOT_H; j++) for (let i = 0; i < LOT_W; i++) {
    const edge = j === 0 || j === LOT_H - 1; const side = i === 0 || i === LOT_W - 1;
    tile(edge ? T.fence_h : side ? T.fence_v : T.grass2, ox + i, oy + j);
  }
  tile(T.gate_open, ox + 6, oy + LOT_H - 1);
  const slots = plotSlots();
  for (let i = 0; i < spec.plotCount; i++) tile(T.plot, ox + slots[i].tx, oy + slots[i].ty);
  // stumps on the border, decor flora outside the fence, conviction tree in the far corner
  for (let k = 0; k < spec.witherMarks; k++) frame(props, 'stump', (ox + 1 + k * 2) * TILE, (oy - 1) * TILE - 8);
  for (let k = 0; k < spec.decorFlora; k++) frame(plaza, `decor${k % 3}`, (ox + LOT_W + 1) * TILE - 8, (oy + 1 + k) * TILE + 4 * (k % 2));
  if (spec.address) frame(props, `tree${spec.treeStage}`, (ox + 1) * TILE - 8, (oy + 1) * TILE - 24);
  // plants
  for (const p of lot.plants) {
    const s = slots[p.i]; if (!s) continue;
    const x = (ox + s.tx) * TILE; const y = (oy + s.ty) * TILE + 12 - 44;
    frame(plants, `${p.speciesId}_${p.revealed ? 'idle0' : 'grow2'}`, x, y, p.mutation === 'backwards');
  }
  return PNG.sync.write(out);
}
