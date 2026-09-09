// Seasons: boundaries, scoring, the closing bell and settlement.
//
// Everything here is PURE and deterministic. Given the season log - the plants that
// existed at the bell and the market overrides in force - this module recomputes the
// exact same standings months later. That is not tidiness: a prize decided by a number
// nobody can reproduce is a prize nobody can defend.
//
// Nothing in this file emits, converts or prices a token. Standing is points; the prize
// is a fixed rank-ordered amount decided outside the game (bible I-6 as amended).

import type { Plant, Species, Sector, Tier } from './types';
import { sapPerSec } from './economy';

// ---------------------------------------------------------------------------
// Boundaries
// ---------------------------------------------------------------------------

/** Season 1 opens 2026-09-09 00:00 America/Los_Angeles, which is 07:00 UTC (PDT, UTC-7). */
export const SEASON_ONE_START_MS = Date.UTC(2026, 8, 9, 7, 0, 0);
export const SEASON_LENGTH_MS = 7 * 24 * 60 * 60 * 1000;

/** 1-based. Returns 0 before the first season opens - the game is playable, unscored. */
export const seasonNumberAt = (now: number): number =>
  now < SEASON_ONE_START_MS ? 0 : Math.floor((now - SEASON_ONE_START_MS) / SEASON_LENGTH_MS) + 1;

export const seasonStart = (n: number): number => SEASON_ONE_START_MS + (n - 1) * SEASON_LENGTH_MS;
export const seasonEnd = (n: number): number => seasonStart(n) + SEASON_LENGTH_MS;
export const msUntilBell = (now: number): number => {
  const n = seasonNumberAt(now);
  return n === 0 ? SEASON_ONE_START_MS - now : seasonEnd(n) - now;
};

// ---------------------------------------------------------------------------
// Eligibility (read-only wallet check; Benjamin's thresholds, 2026-09-08)
// ---------------------------------------------------------------------------

/** Either qualifies. Balances are whole tokens, already decimal-adjusted. */
export const PRIZE_MIN_PONSGARDEN = 100_000;
export const PRIZE_MIN_PONS = 100;

export const isPrizeEligible = (ponsGarden: number, pons: number): boolean =>
  ponsGarden >= PRIZE_MIN_PONSGARDEN || pons >= PRIZE_MIN_PONS;

// ---------------------------------------------------------------------------
// Scoring - published in the Season Rules, so every weight here is player-facing
// ---------------------------------------------------------------------------

export const POINTS = {
  /** One point per 100 Sap of liquidated book, so the garden matters without dominating. */
  bookPer: 100,
  steal: 10,
  tag: 15,          // defence is harder than offence, and pays accordingly
  defenseHeld: 12,  // a raider entered your fence and left with nothing
  mission: 8,
  sprintRecord: 50, // flat, to whoever holds the village record at the bell
} as const;

/**
 * Repeated steals from the SAME victim decay: 10, 7, 5, then 3 forever. Stops a pair of
 * players farming each other in a corner, without punishing anyone for being popular.
 */
export const stealPoints = (nthFromThisVictim: number): number =>
  nthFromThisVictim <= 1 ? 10 : nthFromThisVictim === 2 ? 7 : nthFromThisVictim === 3 ? 5 : 3;

export interface SeasonTally {
  /** victimId -> how many times this player stole from them this season */
  stealsByVictim: Record<string, number>;
  tags: number;
  defensesHeld: number;
  missions: number;
  holdsSprintRecord: boolean;
}

export const emptyTally = (): SeasonTally => ({
  stealsByVictim: {}, tags: 0, defensesHeld: 0, missions: 0, holdsSprintRecord: false,
});

export function stealScore(t: SeasonTally): number {
  let total = 0;
  for (const n of Object.values(t.stealsByVictim)) {
    for (let i = 1; i <= n; i++) total += stealPoints(i);
  }
  return total;
}

export function scoreOf(t: SeasonTally, bookValue: number): number {
  return (
    Math.floor(bookValue / POINTS.bookPer) +
    stealScore(t) +
    t.tags * POINTS.tag +
    t.defensesHeld * POINTS.defenseHeld +
    t.missions * POINTS.mission +
    (t.holdsSprintRecord ? POINTS.sprintRecord : 0)
  );
}

// ---------------------------------------------------------------------------
// The closing bell
// ---------------------------------------------------------------------------

/** A liquidated plant is worth ten minutes of what it earned at the instant of the bell. */
export const LIQUIDATION_SECONDS = 600;
/** An unrevealed plant settles at a quarter: it never got to show what it was. */
export const UNREVEALED_FACTOR = 0.25;

/**
 * Value one plant at the bell. Reuses sapPerSec, so size, mutation, weeds and the market
 * position all flow through automatically and the number matches what the player watched
 * tick up all week.
 */
export function liquidate(
  p: Plant,
  sp: Species,
  bellAt: number,
  market?: ReadonlyMap<Sector, number>,
): number {
  if (!p.revealed) {
    // Value it as if it had revealed at base, then discount for never having done so.
    const base = sp.sapBase * (p.size || 1);
    return Math.floor(base * LIQUIDATION_SECONDS * UNREVEALED_FACTOR);
  }
  return Math.floor(sapPerSec(p, sp, bellAt, market) * LIQUIDATION_SECONDS);
}

export function bookValue(
  plots: (Plant | null)[],
  speciesOf: (id: string) => Species | undefined,
  bellAt: number,
  market?: ReadonlyMap<Sector, number>,
): number {
  let total = 0;
  for (const p of plots) {
    if (!p) continue;
    const sp = speciesOf(p.speciesId);
    if (!sp) continue;   // unknown species: worth nothing rather than crashing the bell
    total += liquidate(p, sp, bellAt, market);
  }
  return total;
}

// ---------------------------------------------------------------------------
// Settlement - what the player does with their book (GAME_DESIGN.md s7)
// ---------------------------------------------------------------------------

export type Settlement = 'carry' | 'endowment' | 'vintage';
export const SETTLEMENTS: Settlement[] = ['carry', 'endowment', 'vintage'];

/**
 * Endowment converts book into a permanent Sap/sec trickle at a deliberately poor rate:
 * it takes several seasons to repay, and then it never stops. The veteran's path.
 */
export const ENDOWMENT_DIVISOR = 20_000;
export const endowmentFromBook = (book: number): number =>
  Math.round((book / ENDOWMENT_DIVISOR) * 100) / 100;

/** Vintage tier scales with how much book was burned on it. */
export const VINTAGE_THRESHOLDS: { tier: Tier; minBook: number }[] = [
  { tier: 'mythic', minBook: 400_000 },
  { tier: 'legendary', minBook: 150_000 },
  { tier: 'epic', minBook: 50_000 },
  { tier: 'rare', minBook: 15_000 },
  { tier: 'uncommon', minBook: 4_000 },
  { tier: 'common', minBook: 0 },
];

export const vintageTier = (book: number): Tier =>
  VINTAGE_THRESHOLDS.find((v) => book >= v.minBook)!.tier;

export interface SettlementResult { sap: number; endowment: number; vintage: Tier | null }

export function settle(choice: Settlement, book: number): SettlementResult {
  switch (choice) {
    case 'carry':     return { sap: book, endowment: 0, vintage: null };
    case 'endowment': return { sap: 0, endowment: endowmentFromBook(book), vintage: null };
    case 'vintage':   return { sap: 0, endowment: 0, vintage: vintageTier(book) };
  }
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

export interface Standing {
  playerId: string;
  name: string;
  score: number;
  bookValue: number;
  eligible: boolean;
  rank: number;        // over ALL players; the public board never hides anyone
  prizeRank: number;   // 0 = not in the money; 1..3 among ELIGIBLE players only
}

/** Prize split, confirmed by Benjamin 2026-09-08. Sums to 100. */
export const PRIZE_SPLIT = [0.5, 0.3, 0.2] as const;

/**
 * Rank everyone, then award prize ranks to eligible players only. Ineligible players keep
 * their place on the public board - they played, they placed, they just are not paid.
 * Ties break on book value, then player id, so ordering is total and reproducible.
 */
export function standings(
  rows: { playerId: string; name: string; score: number; bookValue: number; eligible: boolean }[],
): Standing[] {
  const sorted = [...rows].sort(
    (a, b) => b.score - a.score || b.bookValue - a.bookValue || a.playerId.localeCompare(b.playerId),
  );
  let prizeRank = 0;
  return sorted.map((r, i) => ({
    ...r,
    rank: i + 1,
    prizeRank: r.eligible && prizeRank < PRIZE_SPLIT.length ? ++prizeRank : 0,
  }));
}
