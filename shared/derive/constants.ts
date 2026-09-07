// Every value here is [TUNABLE] (bible §2). Change with care: land is permanent and players will notice.
import type { Tier } from '../types';

export const BIOME_COUNT = 8;
export const GUEST_PLOTS = 10;   // Ben 2026-09-07: everyone starts with ten empty plots and grows from there

// §2.2 stakeTime (token-days) -> plots (ladder shifted above the ten-plot start; cap stays 20)
export const PLOT_LADDER: { min: number; plots: number }[] = [
  { min: 1_000_000, plots: 20 },
  { min: 100_000, plots: 18 },
  { min: 10_000, plots: 16 },
  { min: 1_000, plots: 14 },
  { min: Number.MIN_VALUE, plots: 12 },
];

// §2.3 holdStreak (days) -> minimum conveyor tier
export const FLOOR_LADDER: { minDays: number; floor: Tier }[] = [
  { minDays: 365, floor: 'legendary' },
  { minDays: 90, floor: 'epic' },
  { minDays: 30, floor: 'rare' },
  { minDays: 7, floor: 'uncommon' },
  { minDays: 0, floor: 'common' },
];

// §2.5 conviction tree growth stage by stakeTime (token-days)
export const TREE_LADDER: number[] = [0, 100, 2_000, 30_000, 300_000]; // stage i requires >= TREE_LADDER[i]

export const UNSTAKE_MIN_FRACTION = 0.2;   // balance decreases below this are not wither-marks
export const HYBRID_MIN_TOKENS = 2;         // distinct allowlisted meme tokens held
export const DECOR_MAX = 6;
