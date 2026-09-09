// The market. Sector-wide volatility, per GAME_DESIGN.md s4 and s4b.
//
// TWO LAWS, both load-bearing:
//
// 1. DETERMINISTIC. Sector position is a pure function of (sector, time). Server, client
//    and the share renderer compute the identical value with no message passing, and the
//    closing bell can be recomputed from the season log months later. Anything that is
//    not reproducible cannot settle a prize.
//
// 2. BOUNDED. Oracle7 authors the market (s4b) but only by supplying a position in
//    [-1, 1]; the amplitude it is multiplied by comes from the tier table below and is
//    never under the model's control. A player is never exposed to an unbounded model,
//    and an Oracle outage degrades to the deterministic walk rather than to chaos.

import type { Sector, Tier } from './types';

/** Sector positions step once a minute and interpolate smoothly between steps. */
export const MARKET_TICK_MS = 60_000;

/**
 * How far a tier's yield may swing, as a fraction of its base rate. Cheap tiers are
 * violent and spike; the top of the board barely moves. This is the risk curve, and it is
 * the reason anyone plants a Penny stock when they could afford a Blue Chip.
 */
export const TIER_VOLATILITY: Record<Tier, number> = {
  common: 0.60,
  uncommon: 0.60,
  rare: 0.25,
  epic: 0.08,
  legendary: 0.08,
  mythic: 0.08,
};

/** A plant is "spiking" - visibly glowing, and worth stealing - above this multiplier. */
export const SPIKE_THRESHOLD = 1.25;

const hash = (s: string, n: number): number => {
  let h = 2166136261 >>> 0;
  const str = `${s}:${n}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
};

/** Deterministic value in [-1, 1] for a sector at a given integer tick. */
const nodeAt = (sector: Sector, tick: number): number => (hash(sector, tick) / 0xffffffff) * 2 - 1;

/**
 * Sector position in [-1, 1], smoothly interpolated between minute nodes.
 *
 * `overrides` carries Oracle7's authored positions (s4b). A sector present there uses the
 * authored value; every other sector falls back to the deterministic walk. That is the
 * fail-safe: with no Oracle the market still moves, it just stops having opinions.
 */
export function sectorPosition(
  sector: Sector,
  now: number,
  overrides?: ReadonlyMap<Sector, number>,
): number {
  const authored = overrides?.get(sector);
  if (authored !== undefined) return Math.max(-1, Math.min(1, authored));

  const t = now / MARKET_TICK_MS;
  const tick = Math.floor(t);
  const frac = t - tick;
  const a = nodeAt(sector, tick);
  const b = nodeAt(sector, tick + 1);
  // Cosine interpolation: continuous and smooth at the node boundaries, so yields never
  // jump discontinuously and a player watching a plant sees it drift rather than teleport.
  const w = (1 - Math.cos(frac * Math.PI)) / 2;
  return a * (1 - w) + b * w;
}

/**
 * The multiplier applied to a plant's base Sap rate. Always positive: a full negative
 * swing at the most violent tier still leaves 40% of base, so a bad market makes a plant
 * poor and never worthless. Nobody's garden goes to zero while they sleep.
 */
export function marketMult(
  tier: Tier,
  sector: Sector,
  now: number,
  overrides?: ReadonlyMap<Sector, number>,
): number {
  const amp = TIER_VOLATILITY[tier];
  return 1 + amp * sectorPosition(sector, now, overrides);
}

export const isSpiking = (
  tier: Tier,
  sector: Sector,
  now: number,
  overrides?: ReadonlyMap<Sector, number>,
): boolean => marketMult(tier, sector, now, overrides) >= SPIKE_THRESHOLD;

/**
 * Full-swing percentage shown on the ticker tape.
 *
 * Position is [-1,1], but printing that raw gives "+95.7%", which reads as a market that
 * has lost its mind. The tape is sector-level and tier-free, so it is scaled to the band a
 * steady tier actually experiences — a plausible market move, and the honest figure for the
 * blue chips and above that make up most of the board's value.
 *
 * This affects DISPLAY ONLY. Yields come from marketMult, which uses the raw position and
 * the tier's own amplitude.
 */
export const MARKET_DISPLAY_PCT = 8;

export const sectorMovePct = (
  sector: Sector,
  now: number,
  overrides?: ReadonlyMap<Sector, number>,
): number => Math.round(sectorPosition(sector, now, overrides) * MARKET_DISPLAY_PCT * 10) / 10;
