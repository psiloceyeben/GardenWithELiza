// Village generator: one deterministic map per village seed, identical on server and client.
// 120 x 80 tiles. Central plaza, 16 fenced garden lots around it, roads, ponds, decor.
import { mulberry32 } from './rng';

export const TILE = 32;
export const VILLAGE_W = 120;
export const VILLAGE_H = 80;
export const LOTS_PER_VILLAGE = 16;
export const LOT_W = 13;   // including fence ring
export const LOT_H = 11;
export const MAX_PLOTS = 20;

// MUST match tools/sprites/gen_world.py TILE_ORDER
export const TILES = ['grass', 'grass2', 'soil', 'plot', 'path', 'hedge', 'water', 'stone',
  'flowers', 'cobble', 'fence_h', 'fence_v', 'gate_open', 'gate_closed', 'grass3', 'water2',
  'fence_h2', 'fence_v2', 'gate_open2', 'gate_closed2', 'cobble2'] as const;
export const TILE_STRIDE = 32;   // tiles per biome row in the packed strip (gid = biome * TILE_STRIDE + tile)
export type TileKind = typeof TILES[number];
export const T: Record<TileKind, number> = Object.fromEntries(TILES.map((k, i) => [k, i])) as Record<TileKind, number>;
const BLOCKED = new Set<number>([T.hedge, T.water, T.water2, T.fence_h, T.fence_v, T.gate_closed, T.fence_h2, T.fence_v2, T.gate_closed2]);

export const BIOME_NAMES = ['Verdant Rows', 'Molten Meadow', 'Static Bog', 'Sugar Hollow', 'Dusk Flats', 'Frost Ridge', 'Ash Yard', 'Neon Marsh'];

export type Side = 'top' | 'bottom' | 'left' | 'right';
export interface Lot {
  id: number;
  x: number; y: number;          // tile rect (fence ring inclusive)
  w: number; h: number;
  gate: { tx: number; ty: number };   // gate tile
  gateSide: Side;
  plots: { tx: number; ty: number }[];  // MAX_PLOTS slots, centre-first order
  center: { x: number; y: number };     // px
}
export interface Prop { kind: string; tx: number; ty: number; w: number; h: number; solid: boolean; }
export interface NpcSpot { id: string; tx: number; ty: number; }   // named NPCs live in shared/missions.ts; positions here
export const TOWN = { street: { x: 30, y: 8, w: 61, h: 2 }, buildings: [['hall', 32], ['seedshop', 44], ['tavern', 56], ['shrine', 68], ['tower', 80]] as [string, number][], npcs: ['mayor', 'seedwife', 'barkeep', 'oracle', 'warden'] };
export interface Village {
  seed: number;
  biome: number;
  grid: Uint8Array;               // VILLAGE_W * VILLAGE_H tile indices
  lots: Lot[];
  props: Prop[];
  plaza: { x: number; y: number; w: number; h: number };
  npcs: NpcSpot[];
  spawn: { x: number; y: number }; // px
  conveyor: { tx: number; ty: number };
  board: { tx: number; ty: number };
  track: { tx: number; ty: number };
}

export function buildVillage(seed: number): Village {
  const rng = mulberry32(seed);
  const grid = new Uint8Array(VILLAGE_W * VILLAGE_H);
  const set = (x: number, y: number, t: number) => { if (x >= 0 && y >= 0 && x < VILLAGE_W && y < VILLAGE_H) grid[y * VILLAGE_W + x] = t; };
  const fill = (x: number, y: number, w: number, h: number, t: number) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, t); };

  // ground
  for (let y = 0; y < VILLAGE_H; y++) for (let x = 0; x < VILLAGE_W; x++) {
    const r = rng();
    set(x, y, r < 0.06 ? T.flowers : r < 0.2 ? T.grass2 : r < 0.3 ? T.grass3 : T.grass);
  }
  // border hedge
  fill(0, 0, VILLAGE_W, 1, T.hedge); fill(0, VILLAGE_H - 1, VILLAGE_W, 1, T.hedge); fill(0, 0, 1, VILLAGE_H, T.hedge); fill(VILLAGE_W - 1, 0, 1, VILLAGE_H, T.hedge);
  // ponds in the corners
  for (const [px, py] of [[3, 3], [110, 3], [3, 70], [110, 70]] as const) {
    for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) if (Math.hypot(i - 3, j - 3) < 3.4) set(px + i, py + j, (i + j) % 2 ? T.water : T.water2);
  }

  // plaza
  const plaza = { x: 48, y: 32, w: 24, h: 16 };
  fill(plaza.x, plaza.y, plaza.w, plaza.h, T.cobble);
  fill(plaza.x + 2, plaza.y + 2, plaza.w - 4, plaza.h - 4, T.stone);

  // town street (north), a road down to the ring, buildings with an NPC at each door
  fill(TOWN.street.x, TOWN.street.y, TOWN.street.w, TOWN.street.h, T.cobble);
  fill(59, 10, 2, 14, T.path);
  const npcs: NpcSpot[] = [];
  TOWN.buildings.forEach(([kind, bx], i) => { npcs.push({ id: TOWN.npcs[i], tx: bx + 1, ty: 10 }); void kind; });

  // ring roads + spokes
  fill(23, 10, 2, 60, T.path); fill(95, 10, 2, 60, T.path);
  fill(23, 24, 74, 2, T.path); fill(23, 55, 74, 2, T.path);
  fill(59, 26, 2, 6, T.path); fill(59, 48, 2, 7, T.path);
  fill(25, 39, 23, 2, T.path); fill(72, 39, 23, 2, T.path);

  // lots
  const lots: Lot[] = [];
  const addLot = (x: number, y: number, side: Side) => {
    const id = lots.length;
    fill(x, y, LOT_W, 1, T.fence_h); fill(x, y + LOT_H - 1, LOT_W, 1, T.fence_h);
    fill(x, y, 1, LOT_H, T.fence_v); fill(x + LOT_W - 1, y, 1, LOT_H, T.fence_v);
    for (let j = 1; j < LOT_H - 1; j++) for (let i = 1; i < LOT_W - 1; i++) set(x + i, y + j, T.grass2);
    let gate: { tx: number; ty: number };
    if (side === 'bottom') gate = { tx: x + 6, ty: y + LOT_H - 1 };
    else if (side === 'top') gate = { tx: x + 6, ty: y };
    else if (side === 'right') gate = { tx: x + LOT_W - 1, ty: y + 5 };
    else gate = { tx: x, ty: y + 5 };
    set(gate.tx, gate.ty, T.gate_open);
    // path from gate to road
    if (side === 'bottom') fill(gate.tx, gate.ty + 1, 1, 1, T.path);
    if (side === 'top') fill(gate.tx, gate.ty - 1, 1, 1, T.path);
    if (side === 'right') fill(gate.tx + 1, gate.ty, 1, 1, T.path);
    if (side === 'left') fill(gate.tx - 1, gate.ty, 1, 1, T.path);
    // plot slots: 5 x 4 at pitch 2, ordered centre-first
    const slots: { tx: number; ty: number; d: number }[] = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
      const tx = x + 2 + c * 2; const ty = y + 2 + r * 2;
      slots.push({ tx, ty, d: Math.hypot(c - 2, (r - 1.5) * 1.3) });
    }
    slots.sort((a, b) => a.d - b.d);
    lots.push({ id, x, y, w: LOT_W, h: LOT_H, gate, gateSide: side, plots: slots.map((s) => ({ tx: s.tx, ty: s.ty })), center: { x: (x + LOT_W / 2) * TILE, y: (y + LOT_H / 2) * TILE } });
  };
  for (const x of [30, 46, 62, 78]) addLot(x, 12, 'bottom');
  for (const x of [30, 46, 62, 78]) addLot(x, 57, 'top');
  for (const y of [12, 26, 40, 54]) addLot(8, y, 'right');
  for (const y of [12, 26, 40, 54]) addLot(98, y, 'left');

  // props
  const props: Prop[] = [];
  const conveyor = { tx: 59, ty: 33 };
  const board = { tx: 50, ty: 33 };
  const track = { tx: 66, ty: 44 };
  props.push({ kind: 'fountain', tx: 58, ty: 38, w: 2, h: 2, solid: true });
  props.push({ kind: 'stall', tx: 58, ty: 32, w: 2, h: 1, solid: true });
  props.push({ kind: 'board', tx: 50, ty: 32, w: 2, h: 1, solid: true });
  props.push({ kind: 'track', tx: 66, ty: 44, w: 2, h: 1, solid: false });
  props.push({ kind: 'sign', tx: 60, ty: 46, w: 1, h: 1, solid: true });   // village signpost: visit / go home
  for (const [kind, bx] of TOWN.buildings) props.push({ kind: `bld_${kind}`, tx: bx, ty: 6, w: 3, h: 2, solid: true });
  for (const n of npcs) props.push({ kind: `npc_${n.id}`, tx: n.tx, ty: n.ty, w: 1, h: 1, solid: true });
  for (const [tx, ty] of [[36, 3], [52, 3], [64, 3], [88, 4]]) props.push({ kind: 'lamp', tx, ty, w: 1, h: 1, solid: true });
  for (const [tx, ty] of [[49, 33], [70, 33], [49, 46], [70, 46]]) props.push({ kind: 'lamp', tx, ty, w: 1, h: 1, solid: true });
  for (const [tx, ty] of [[52, 44], [64, 36]]) props.push({ kind: 'bench', tx, ty, w: 2, h: 1, solid: true });
  for (const [tx, ty] of [[54, 36], [66, 41]]) props.push({ kind: 'pot', tx, ty, w: 1, h: 1, solid: true });
  // trees on open grass
  let tries = 0;
  while (props.length < 60 && tries++ < 4000) {
    const tx = 2 + Math.floor(rng() * (VILLAGE_W - 4)); const ty = 2 + Math.floor(rng() * (VILLAGE_H - 4));
    if (!isGrass(grid, tx, ty) || !isGrass(grid, tx, ty + 1) || nearLot(lots, tx, ty) || nearPlaza(plaza, tx, ty) || (ty < 12 && tx >= 28 && tx < 93)) continue;
    props.push({ kind: `tree${2 + Math.floor(rng() * 3)}`, tx, ty, w: 1, h: 1, solid: true });
  }

  const spawn = { x: 60 * TILE, y: 51 * TILE };
  return { seed, biome: seed % BIOME_NAMES.length, grid, lots, props, plaza, npcs, spawn, conveyor, board, track };
}

function isGrass(grid: Uint8Array, tx: number, ty: number): boolean {
  const t = grid[ty * VILLAGE_W + tx];
  return t === T.grass || t === T.grass2 || t === T.grass3 || t === T.flowers;
}
function nearLot(lots: Lot[], tx: number, ty: number): boolean {
  return lots.some((l) => tx >= l.x - 2 && tx < l.x + l.w + 2 && ty >= l.y - 2 && ty < l.y + l.h + 2);
}
function nearPlaza(p: { x: number; y: number; w: number; h: number }, tx: number, ty: number): boolean {
  return tx >= p.x - 2 && tx < p.x + p.w + 2 && ty >= p.y - 2 && ty < p.y + p.h + 2;
}

// ------------------------------------------------------------ queries
export function tileAt(v: Village, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= VILLAGE_W || ty >= VILLAGE_H) return T.hedge;
  return v.grid[ty * VILLAGE_W + tx];
}
export function isWalkableTile(v: Village, tx: number, ty: number, gateClosed: (tx: number, ty: number) => boolean): boolean {
  const t = tileAt(v, tx, ty);
  if ((t === T.gate_open || t === T.gate_open2) && gateClosed(tx, ty)) return false;
  if (BLOCKED.has(t)) return false;
  for (const p of v.props) if (p.solid && tx >= p.tx && tx < p.tx + p.w && ty >= p.ty && ty < p.ty + p.h) return false;
  return true;
}
export function lotAtPx(v: Village, x: number, y: number): Lot | null {
  const tx = Math.floor(x / TILE); const ty = Math.floor(y / TILE);
  for (const l of v.lots) if (tx > l.x && tx < l.x + l.w - 1 && ty > l.y && ty < l.y + l.h - 1) return l;
  return null;
}
export function lotGatePx(l: Lot): { x: number; y: number } {
  return { x: l.gate.tx * TILE + 16, y: l.gate.ty * TILE + 16 };
}
export function plotPx(l: Lot, i: number): { x: number; y: number } {
  const p = l.plots[i];
  return { x: p.tx * TILE + 16, y: p.ty * TILE + 16 };
}

/** Move an actor by (dx,dy) px with tile collision using a small foot box. Shared by server + client prediction. */
export function moveActor(v: Village, x: number, y: number, dx: number, dy: number, gateClosed: (tx: number, ty: number) => boolean): { x: number; y: number } {
  const half = 6;
  const free = (px: number, py: number) =>
    isWalkableTile(v, Math.floor((px - half) / TILE), Math.floor((py - 2) / TILE), gateClosed) &&
    isWalkableTile(v, Math.floor((px + half) / TILE), Math.floor((py - 2) / TILE), gateClosed) &&
    isWalkableTile(v, Math.floor((px - half) / TILE), Math.floor((py + 2) / TILE), gateClosed) &&
    isWalkableTile(v, Math.floor((px + half) / TILE), Math.floor((py + 2) / TILE), gateClosed);
  let nx = x + dx; let ny = y;
  if (!free(nx, ny)) nx = x;
  ny = y + dy;
  if (!free(nx, ny)) ny = y;
  return { x: Math.max(TILE, Math.min(VILLAGE_W * TILE - TILE, nx)), y: Math.max(TILE, Math.min(VILLAGE_H * TILE - TILE, ny)) };
}

/** BFS over walkable tiles. Returns waypoints in px (tile centres, last = exact target) or null. */
export function findPath(v: Village, from: { x: number; y: number }, to: { x: number; y: number }, gateClosed: (tx: number, ty: number) => boolean): { x: number; y: number }[] | null {
  const sx = Math.floor(from.x / TILE); const sy = Math.floor(from.y / TILE);
  const gx = Math.floor(to.x / TILE); const gy = Math.floor(to.y / TILE);
  if (!isWalkableTile(v, gx, gy, gateClosed)) return null;
  if (sx === gx && sy === gy) return [to];
  const N = VILLAGE_W * VILLAGE_H; const prev = new Int32Array(N).fill(-1); const q = new Int32Array(N);
  let head = 0; let tail = 0; const start = sy * VILLAGE_W + sx; const goal = gy * VILLAGE_W + gx;
  q[tail++] = start; prev[start] = start;
  while (head < tail) {
    const cur = q[head++]; if (cur === goal) break;
    const cx = cur % VILLAGE_W; const cy = (cur - cx) / VILLAGE_W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx; const ny = cy + dy; if (nx < 0 || ny < 0 || nx >= VILLAGE_W || ny >= VILLAGE_H) continue;
      const n = ny * VILLAGE_W + nx; if (prev[n] !== -1 || !isWalkableTile(v, nx, ny, gateClosed)) continue;
      prev[n] = cur; q[tail++] = n;
    }
  }
  if (prev[goal] === -1) return null;
  const out: { x: number; y: number }[] = [];
  for (let c = goal; c !== start; c = prev[c]) { const cx = c % VILLAGE_W; out.push({ x: cx * TILE + 16, y: ((c - cx) / VILLAGE_W) * TILE + 16 }); }
  out.reverse(); out[out.length - 1] = to; return out;
}
