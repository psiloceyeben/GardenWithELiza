import * as THREE from "three";
import { T, TILE_STRIDE, VILLAGE_W, VILLAGE_H } from "@shared/world";
import type { WorldState } from "../game/WorldState";
import { GROUND_CELL, GROUND_PAD, GROUND_WIDTH, GROUND_HEIGHT } from "./Atlases";

/** One tile mesh, with original atlas pixels. Raised boundaries use one instanced draw. */
export function createGround(
  state: WorldState,
  texture: THREE.Texture,
  modeledGates = false,
): THREE.Group {
  const group = new THREE.Group(),
    grid = Array.from(
      state.village!.grid,
      (t) => t + state.villageBiome * TILE_STRIDE,
    );
  const put = (x: number, y: number, t: number, b = state.villageBiome) => {
    grid[y * VILLAGE_W + x] = b * TILE_STRIDE + t;
  };
  for (const { lot: l, geo: g } of state.lots.values()) {
    const b = l.land.address ? l.land.biome : state.villageBiome,
      cos = l.cosmetics;
    for (let j = 1; j < g.h - 1; j++)
      for (let i = 1; i < g.w - 1; i++)
        put(
          g.x + i,
          g.y + j,
          cos.path && (i === 1 || j === 1 || i === g.w - 2 || j === g.h - 2)
            ? T.cobble2
            : l.defenses.mud
              ? T.soil
              : T.grass2,
          b,
        );
    const fh =
      cos.fence === "stone"
        ? T.fence_h2
        : cos.fence === "hedge"
          ? T.hedge
          : T.fence_h;
    const fv =
      cos.fence === "stone"
        ? T.fence_v2
        : cos.fence === "hedge"
          ? T.hedge
          : T.fence_v;
    for (let i = 0; i < g.w; i++) {
      put(g.x + i, g.y, fh);
      put(g.x + i, g.y + g.h - 1, fh);
    }
    for (let j = 0; j < g.h; j++) {
      put(g.x, g.y + j, fv);
      put(g.x + g.w - 1, g.y + j, fv);
    }
    put(
      g.gate.tx,
      g.gate.ty,
      !modeledGates && l.defenses.gateHp > 0 ? T.gate_closed : T.gate_open,
    );
    for (let i = 0; i < l.plotCount; i++)
      put(g.plots[i].tx, g.plots[i].ty, T.plot, b);
  }
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  const walls: {
    x: number;
    y: number;
    vertical: boolean;
    hedge: boolean;
    stone: boolean;
  }[] = [];
  for (let y = 0; y < VILLAGE_H; y++)
    for (let x = 0; x < VILLAGE_W; x++) {
      const gid = grid[y * VILLAGE_W + x],
        t = gid % 32,
        b = Math.floor(gid / 32),
        i = positions.length / 3;
      positions.push(x, 0, y, x + 1, 0, y, x + 1, 0, y + 1, x, 0, y + 1);
      const u0 = (t * GROUND_CELL + GROUND_PAD + 0.5) / GROUND_WIDTH,
        u1 = (t * GROUND_CELL + GROUND_PAD + 31.5) / GROUND_WIDTH,
        v0 = 1 - (b * GROUND_CELL + GROUND_PAD + 0.5) / GROUND_HEIGHT,
        v1 = 1 - (b * GROUND_CELL + GROUND_PAD + 31.5) / GROUND_HEIGHT;
      uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
      indices.push(i, i + 2, i + 1, i, i + 3, i + 2);
      if (
        [
          T.fence_h,
          T.fence_v,
          T.fence_h2,
          T.fence_v2,
          T.hedge,
          T.gate_closed,
          T.gate_closed2,
        ].includes(t)
      )
        walls.push({
          x,
          y,
          vertical: t === T.fence_v || t === T.fence_v2,
          hedge: t === T.hedge,
          stone: t === T.fence_h2 || t === T.fence_v2,
        });
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  group.add(
    new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ map: texture })),
  );
  const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      walls.length,
    ),
    dummy = new THREE.Object3D();
  walls.forEach((w, i) => {
    const height = w.hedge ? 0.55 : 0.3;
    dummy.position.set(w.x + 0.5, height / 2, w.y + 0.5);
    dummy.scale.set(
      w.hedge ? 1 : w.vertical ? 0.12 : 1,
      height,
      w.hedge ? 1 : w.vertical ? 1 : 0.12,
    );
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(
      i,
      new THREE.Color(w.hedge ? 0x476645 : w.stone ? 0x807b8b : 0x99724e),
    );
  });
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);
  return group;
}

export function disposeGroup(group: THREE.Group): void {
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of materials) m.dispose();
    }
  });
  group.removeFromParent();
}
