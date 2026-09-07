// Layer C inputs and output (bible §2). ChainSnapshot is what the chain reader produces for one address;
// GardenSpec is the permanent, unstealable land derived from it. Both are plain data so they serialise unchanged.
import type { Tier } from '../types';

export interface UnstakeEvent { at: number; fraction: number; }   // fraction of then-holdings sold (>= 0.2 to count)

export interface ChainSnapshot {
  address: string;              // lowercase 0x…
  takenAt: number;              // ms
  ponsBalance: number;          // whole tokens
  stakeTime: number;            // Σ(balance × days) — token-days
  holdStreakDays: number;       // days since last balance decrease
  unstakeEvents: UnstakeEvent[];
  walletAgeDays: number;        // since first tx on Robinhood Chain
  ecosystemHoldings: Record<string, number>;  // allowlisted MEME tokens only (never stock tokens / broker NFTs)
  stockDecor: { brokerNfts: number; stockTokenKinds: number; drops: number };  // counts only; feeds visuals only (I-3)
}

export interface GardenSpec {
  address: string | null;       // null = guest garden
  plotCount: number;
  rarityFloor: Tier;
  biome: number;                // 0..BIOME_COUNT-1, cosmetic
  treeStage: number;            // 0 seedling .. 4 fruiting
  witherMarks: number;          // permanent stumps on the border
  hybridsUnlocked: boolean;
  decorFlora: number;           // 0..DECOR_MAX exotic background flora (no gameplay effect)
}
