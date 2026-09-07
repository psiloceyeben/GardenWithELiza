// Layer G economy. Every constant here is [TUNABLE] per bible §3 / §5.
// LAW (I-6, I-7): Sap is the only currency. Nothing here references tokens.
import type { Tier, MutationId, Species, Plant, ConveyorSlot } from './types';

export const TIERS: Tier[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
export const tierIndex = (t: Tier): number => TIERS.indexOf(t);

// §3.1 base Sap/sec per tier. Roster sapBase mirrors this; species value wins.
export const SAP_BASE: Record<Tier, number> = { common: 1, uncommon: 3, rare: 9, epic: 27, legendary: 81, mythic: 243 };

// Growth time to Sprout Reveal. Fast for the toy: first reveal inside a minute.
export const GROW_MS: Record<Tier, number> = {
  common: 30_000, uncommon: 60_000, rare: 120_000, epic: 240_000, legendary: 480_000, mythic: 900_000,
};

// Seed price at 6 plots. Scales with plot count (§5 anti-inflation).
export const SEED_PRICE: Record<Tier, number> = { common: 15, uncommon: 90, rare: 400, epic: 1800, legendary: 8000, mythic: 30000 };

// Conveyor tier odds. The rarity floor lifts tiers below it UP to the floor; top-tier odds never change (§2.3).
export const TIER_ODDS: Record<Tier, number> = { common: 0.55, uncommon: 0.25, rare: 0.12, epic: 0.055, legendary: 0.02, mythic: 0.005 };

// §3.4 mutations. Published in-UI (I-10).
export const MUTATIONS: { id: MutationId; mult: number; odds: number }[] = [
  { id: 'none', mult: 1, odds: 0.80 },
  { id: 'golden', mult: 4, odds: 0.07 },
  { id: 'holographic', mult: 6, odds: 0.04 },
  { id: 'colossal', mult: 3, odds: 0.045 },
  { id: 'feral', mult: 5, odds: 0.025 },
  { id: 'backwards', mult: 2, odds: 0.015 },
  { id: 'screaming', mult: 8, odds: 0.005 },
];

export const CONVEYOR_SLOTS = 6;
export const CONVEYOR_REFRESH_MS = 5 * 60_000;
export const OFFLINE_CAP_MS = 8 * 3600_000;
export const STARTING_SAP = 25;
export const SPEED_MAX_LEVEL = 10;
export const WATER_BONUS = 0.10;          // watering shortens remaining growth by 10%
export const WEED_COOLDOWN_MS = 5 * 60_000;
export const WEED_BONUS_SEC = 30;          // weeding pays 30 s of that plant's output
export const SIZE_MIN = 0.8;
export const SIZE_MAX = 1.5;

export const speedCost = (level: number): number => Math.round(50 * Math.pow(2, level));
export const speedMult = (level: number): number => 1 + 0.08 * level;
export const seedPrice = (tier: Tier, plotCount: number): number =>
  Math.round(SEED_PRICE[tier] * (1 + 0.15 * Math.max(0, plotCount - 6)));
export const mutationMult = (m: MutationId): number => MUTATIONS.find((x) => x.id === m)?.mult ?? 1;

export function sapPerSec(p: Plant, sp: Species): number {
  if (!p.revealed) return 0;
  return sp.sapBase * p.size * mutationMult(p.mutation);
}

export function weightedPick<T>(rng: () => number, items: T[], weight: (t: T) => number): T {
  const total = items.reduce((s, it) => s + weight(it), 0);
  let r = rng() * total;
  for (const it of items) {
    r -= weight(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

export function rollTier(rng: () => number, floor: Tier): Tier {
  const t = weightedPick(rng, TIERS, (x) => TIER_ODDS[x]);
  return tierIndex(t) < tierIndex(floor) ? floor : t;
}

export function rollConveyor(rng: () => number, roster: Species[], floor: Tier, plotCount: number): ConveyorSlot[] {
  const slots: ConveyorSlot[] = [];
  for (let i = 0; i < CONVEYOR_SLOTS; i++) {
    const tier = rollTier(rng, floor);
    const pool = roster.filter((s) => s.tier === tier);
    const sp = pool[Math.floor(rng() * pool.length)];
    slots.push({ speciesId: sp.id, tier, price: seedPrice(tier, plotCount), sold: false });
  }
  return slots;
}

export function rollReveal(rng: () => number): { size: number; mutation: MutationId } {
  const size = Math.round((SIZE_MIN + rng() * (SIZE_MAX - SIZE_MIN)) * 100) / 100;
  const mutation = weightedPick(rng, MUTATIONS, (m) => m.odds).id;
  return { size, mutation };
}
