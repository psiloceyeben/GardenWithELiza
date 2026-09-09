// Season and market. The bell decides real money, so the properties that matter most
// here are determinism and boundedness rather than any particular number.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  seasonNumberAt, seasonStart, seasonEnd, msUntilBell, SEASON_ONE_START_MS, SEASON_LENGTH_MS,
  isPrizeEligible, PRIZE_MIN_PONS, PRIZE_MIN_PONSGARDEN,
  stealPoints, emptyTally, stealScore, scoreOf, POINTS,
  liquidate, bookValue, settle, endowmentFromBook, vintageTier,
  standings, PRIZE_SPLIT,
} from '../../../shared/season';
import { marketMult, sectorPosition, TIER_VOLATILITY, MARKET_TICK_MS } from '../../../shared/market';
import { resolveRoster } from '../../../shared/roster';
import { SECTORS } from '../../../shared/roster';
import type { Plant, Sector } from '../../../shared/types';

const ROSTER = resolveRoster('market');
const sp = (id: string) => ROSTER.find((s) => s.id === id)!;
const plant = (speciesId: string, over: Partial<Plant> = {}): Plant => ({
  uid: 'p1', speciesId, tier: sp(speciesId).tier, plantedAt: 0, growMs: 1000,
  revealed: true, size: 1, mutation: 'none', watered: false, lastWeeded: 0, ...over,
} as Plant);

test('season boundaries are contiguous and season 1 opens 9 Sept 00:00 PT', () => {
  assert.equal(new Date(SEASON_ONE_START_MS).toISOString(), '2026-09-09T07:00:00.000Z');
  assert.equal(seasonNumberAt(SEASON_ONE_START_MS - 1), 0, 'unscored before the first bell');
  assert.equal(seasonNumberAt(SEASON_ONE_START_MS), 1);
  assert.equal(seasonNumberAt(SEASON_ONE_START_MS + SEASON_LENGTH_MS - 1), 1);
  assert.equal(seasonNumberAt(SEASON_ONE_START_MS + SEASON_LENGTH_MS), 2);
  // No gap and no overlap between consecutive seasons.
  for (let n = 1; n <= 5; n++) assert.equal(seasonEnd(n), seasonStart(n + 1));
  assert.equal(msUntilBell(SEASON_ONE_START_MS), SEASON_LENGTH_MS);
});

test('eligibility: either threshold qualifies, neither does not', () => {
  assert.equal(isPrizeEligible(PRIZE_MIN_PONSGARDEN, 0), true);
  assert.equal(isPrizeEligible(0, PRIZE_MIN_PONS), true);
  assert.equal(isPrizeEligible(PRIZE_MIN_PONSGARDEN - 1, PRIZE_MIN_PONS - 1), false);
  assert.equal(isPrizeEligible(0, 0), false);
});

test('market is deterministic and identical for the same instant', () => {
  const now = 1_770_000_000_000;
  for (const s of SECTORS) {
    assert.equal(sectorPosition(s, now), sectorPosition(s, now), `${s} not deterministic`);
  }
});

test('market stays inside its published band at every tier, across a long horizon', () => {
  const start = SEASON_ONE_START_MS;
  for (const s of SECTORS) {
    for (let i = 0; i < 4000; i++) {
      const now = start + i * (MARKET_TICK_MS / 3);
      const pos = sectorPosition(s, now);
      assert.ok(pos >= -1 && pos <= 1, `${s} position ${pos} out of [-1,1]`);
      for (const [tier, amp] of Object.entries(TIER_VOLATILITY)) {
        const m = marketMult(tier as never, s, now);
        assert.ok(m >= 1 - amp - 1e-9 && m <= 1 + amp + 1e-9, `${tier}/${s} mult ${m} outside band ${amp}`);
        assert.ok(m > 0, `${tier}/${s} mult went non-positive: a garden must never be worthless`);
      }
    }
  }
});

test('an Oracle override is clamped and never escapes the band', () => {
  const now = SEASON_ONE_START_MS;
  const wild = new Map<Sector, number>([['semis', 99], ['funds', -99]]);
  assert.equal(sectorPosition('semis', now, wild), 1);
  assert.equal(sectorPosition('funds', now, wild), -1);
  assert.ok(marketMult('common', 'semis', now, wild) <= 1 + TIER_VOLATILITY.common + 1e-9);
  // A sector absent from the override falls back to the deterministic walk.
  assert.equal(sectorPosition('retail', now, wild), sectorPosition('retail', now));
});

test('market moves smoothly - no discontinuity across a tick boundary', () => {
  const boundary = Math.ceil(SEASON_ONE_START_MS / MARKET_TICK_MS) * MARKET_TICK_MS;
  for (const s of SECTORS) {
    const before = sectorPosition(s, boundary - 1);
    const after = sectorPosition(s, boundary + 1);
    assert.ok(Math.abs(after - before) < 0.01, `${s} jumped ${before} -> ${after} at the boundary`);
  }
});

test('steal points decay per victim but never reach zero', () => {
  assert.deepEqual([1, 2, 3, 4, 9].map(stealPoints), [10, 7, 5, 3, 3]);
  const t = emptyTally();
  t.stealsByVictim = { marla: 4, nix: 1 };
  assert.equal(stealScore(t), 10 + 7 + 5 + 3 + 10);
  // Spreading steals across victims beats farming one, which is the whole point.
  const farmed = { ...emptyTally(), stealsByVictim: { marla: 5 } };
  const spread = { ...emptyTally(), stealsByVictim: { a: 1, b: 1, c: 1, d: 1, e: 1 } };
  assert.ok(stealScore(spread) > stealScore(farmed));
});

test('score combines every published component', () => {
  const t = { ...emptyTally(), stealsByVictim: { v: 1 }, tags: 2, defensesHeld: 1, missions: 3, holdsSprintRecord: true };
  assert.equal(
    scoreOf(t, 12_345),
    Math.floor(12_345 / POINTS.bookPer) + 10 + 2 * POINTS.tag + POINTS.defenseHeld + 3 * POINTS.mission + POINTS.sprintRecord,
  );
});

test('liquidation is reproducible and discounts unrevealed plants', () => {
  const bell = SEASON_ONE_START_MS + 1000;
  const revealed = plant('circuit_sequoia');
  const hidden = plant('circuit_sequoia', { revealed: false });
  assert.equal(liquidate(revealed, sp('circuit_sequoia'), bell), liquidate(revealed, sp('circuit_sequoia'), bell));
  assert.ok(liquidate(hidden, sp('circuit_sequoia'), bell) < liquidate(revealed, sp('circuit_sequoia'), bell));
});

test('book value tolerates empty plots and unknown species without throwing', () => {
  const bell = SEASON_ONE_START_MS;
  const ghost = { ...plant('husk_holdings'), uid: 'g1', speciesId: 'ghost_species' } as Plant;
  const plots = [plant('husk_holdings'), null, ghost];
  const v = bookValue(plots, (id) => ROSTER.find((s) => s.id === id), bell);
  assert.ok(v > 0);
  assert.equal(v, liquidate(plots[0]!, sp('husk_holdings'), bell), 'unknown species must contribute nothing');
});

test('settlement consumes the book in every branch - no path returns coin', () => {
  const book = 120_000;
  const carry = settle('carry', book);
  assert.equal(carry.sap, book);
  assert.equal(settle('endowment', book).endowment, endowmentFromBook(book));
  assert.equal(settle('endowment', book).sap, 0);
  assert.equal(settle('vintage', book).vintage, vintageTier(book));
  assert.equal(settle('vintage', book).sap, 0);
  // Endowment is deliberately a poor immediate deal: it must not out-earn carry quickly.
  assert.ok(endowmentFromBook(book) * 3600 < book, 'endowment repays in under an hour - rate is too generous');
});

test('vintage tier rises with spend and is monotonic', () => {
  const order = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
  let last = -1;
  for (const b of [0, 4_000, 15_000, 50_000, 150_000, 400_000]) {
    const idx = order.indexOf(vintageTier(b));
    assert.ok(idx > last, `vintage tier did not rise at ${b}`);
    last = idx;
  }
});

test('standings rank everyone but pay only eligible players, top three', () => {
  const rows = [
    { playerId: 'a', name: 'A', score: 500, bookValue: 10, eligible: false },
    { playerId: 'b', name: 'B', score: 400, bookValue: 10, eligible: true },
    { playerId: 'c', name: 'C', score: 300, bookValue: 10, eligible: true },
    { playerId: 'd', name: 'D', score: 200, bookValue: 10, eligible: false },
    { playerId: 'e', name: 'E', score: 100, bookValue: 10, eligible: true },
    { playerId: 'f', name: 'F', score: 50, bookValue: 10, eligible: true },
  ];
  const s = standings(rows);
  assert.deepEqual(s.map((x) => x.playerId), ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.equal(s[0].rank, 1);
  assert.equal(s[0].prizeRank, 0, 'ineligible top scorer must not be paid');
  assert.deepEqual(s.filter((x) => x.prizeRank).map((x) => [x.playerId, x.prizeRank]), [['b', 1], ['c', 2], ['e', 3]]);
  assert.equal(s.find((x) => x.playerId === 'f')!.prizeRank, 0, 'only three are paid');
});

test('ties break deterministically', () => {
  const rows = [
    { playerId: 'z', name: 'Z', score: 100, bookValue: 5, eligible: true },
    { playerId: 'a', name: 'A', score: 100, bookValue: 5, eligible: true },
  ];
  assert.deepEqual(standings(rows).map((r) => r.playerId), ['a', 'z']);
  assert.deepEqual(standings([...rows].reverse()).map((r) => r.playerId), ['a', 'z']);
});

test('prize split sums to exactly one', () => {
  assert.equal(PRIZE_SPLIT.reduce((a, b) => a + b, 0), 1);
  assert.equal(PRIZE_SPLIT.length, 3);
});
