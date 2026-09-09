// Village layout. The expansion tripled the ground and the lot count, and a hand-placed
// map is exactly the kind of thing that breaks quietly: a lot whose gate opens onto water
// is a player who cannot reach their own garden and has no way to tell you why.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildVillage, openLotCount, isWalkableTile,
  VILLAGE_W, VILLAGE_H, LOTS_PER_VILLAGE, LOT_W, LOT_H, LOT_BASE,
} from '../../../shared/world';

const SEEDS = [12345, 777, 42, 99001, 5];

test('the map is about three times the original ground', () => {
  const ratio = (VILLAGE_W * VILLAGE_H) / (120 * 80);
  assert.ok(ratio >= 2.9, `map is only ${ratio.toFixed(2)}x the original`);
  assert.equal(LOTS_PER_VILLAGE, 48);
});

test('every seed builds the full set of lots, unique and in bounds', () => {
  for (const seed of SEEDS) {
    const v = buildVillage(seed);
    assert.equal(v.lots.length, LOTS_PER_VILLAGE, `seed ${seed}`);
    assert.equal(new Set(v.lots.map((l) => l.id)).size, LOTS_PER_VILLAGE, `seed ${seed}: duplicate lot id`);
    for (const l of v.lots) {
      assert.ok(l.x >= 0 && l.y >= 0 && l.x + LOT_W <= VILLAGE_W && l.y + LOT_H <= VILLAGE_H,
        `seed ${seed}: lot ${l.id} out of bounds at ${l.x},${l.y}`);
    }
  }
});

test('no two lots overlap', () => {
  for (const seed of SEEDS) {
    const ls = buildVillage(seed).lots;
    for (let i = 0; i < ls.length; i++) {
      for (let j = i + 1; j < ls.length; j++) {
        const a = ls[i], b = ls[j];
        const hit = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        assert.ok(!hit, `seed ${seed}: lots ${a.id} and ${b.id} overlap`);
      }
    }
  }
});

test('every lot gate is walkable from the plaza — nobody is stranded', () => {
  for (const seed of SEEDS) {
    const v = buildVillage(seed);
    const seen = new Uint8Array(VILLAGE_W * VILLAGE_H);
    const walkable = (x: number, y: number) => isWalkableTile(v, x, y, () => false);
    const queue: [number, number][] = [[60, 40]];   // the plaza, where everyone spawns
    seen[40 * VILLAGE_W + 60] = 1;
    while (queue.length) {
      const [x, y] = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= VILLAGE_W || ny >= VILLAGE_H) continue;
        const i = ny * VILLAGE_W + nx;
        if (seen[i] || !walkable(nx, ny)) continue;
        seen[i] = 1; queue.push([nx, ny]);
      }
    }
    const stranded = v.lots.filter((l) => !seen[l.gate.ty * VILLAGE_W + l.gate.tx]).map((l) => l.id);
    assert.deepEqual(stranded, [], `seed ${seed}: lots unreachable from the plaza`);
  }
});

test('lots open with registrations, with headroom, and never exceed the map', () => {
  assert.equal(openLotCount(0), LOT_BASE, 'an empty village still shows a street of gardens');
  assert.equal(openLotCount(LOT_BASE - 5), LOT_BASE, 'never fewer than the base');
  assert.ok(openLotCount(20) > 20, 'there must always be somewhere for the next player to go');
  assert.equal(openLotCount(9999), LOTS_PER_VILLAGE, 'capped at what the map actually holds');
  // Monotonic: more players never means fewer open lots.
  let prev = 0;
  for (let n = 0; n <= 60; n++) {
    const c = openLotCount(n);
    assert.ok(c >= prev, `open lots went down at ${n} players`);
    prev = c;
  }
});

test('the original sixteen keep their ids, so the expansion is additive', () => {
  const v = buildVillage(12345);
  // The hand-placed core was four rows of four; those are ids 0..15 and must stay put.
  for (let i = 0; i < 16; i++) assert.equal(v.lots[i].id, i);
  assert.ok(v.lots.slice(0, 16).every((l) => l.x < 120 && l.y < 80), 'a core lot moved into the new ground');
});
