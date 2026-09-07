// Fixture wallets for tests, the mock chain reader, and share-page demos. Addresses are made up.
import type { ChainSnapshot, GardenSpec } from './types';

const T0 = 1_757_000_000_000;
const base = (address: string, over: Partial<ChainSnapshot>): ChainSnapshot => ({
  address, takenAt: T0, ponsBalance: 0, stakeTime: 0, holdStreakDays: 0, unstakeEvents: [], walletAgeDays: 0,
  ecosystemHoldings: {}, stockDecor: { brokerNfts: 0, stockTokenKinds: 0, drops: 0 }, ...over,
});

export const FIXTURES: { name: string; snapshot: ChainSnapshot; expect: Omit<GardenSpec, 'biome' | 'address'> }[] = [
  { name: 'guest (zero balance, no history)', snapshot: base('0x0000000000000000000000000000000000000001', {}),
    expect: { plotCount: 10, rarityFloor: 'common', treeStage: 0, witherMarks: 0, hybridsUnlocked: false, decorFlora: 0 } },
  { name: 'fresh holder (bought yesterday)', snapshot: base('0x00000000000000000000000000000000000000f2', { ponsBalance: 500, stakeTime: 500, holdStreakDays: 1, walletAgeDays: 3 }),
    expect: { plotCount: 12, rarityFloor: 'common', treeStage: 1, witherMarks: 0, hybridsUnlocked: false, decorFlora: 0 } },
  { name: 'long holder (whale, 200 d streak)', snapshot: base('0x0000000000000000000000000000000000000ab3', { ponsBalance: 900_000, stakeTime: 1_500_000, holdStreakDays: 200, walletAgeDays: 400, ecosystemHoldings: { STONKBROKER: 12, DERP: 3 } }),
    expect: { plotCount: 20, rarityFloor: 'epic', treeStage: 4, witherMarks: 0, hybridsUnlocked: true, decorFlora: 0 } },
  { name: 'holder with two big sells', snapshot: base('0x000000000000000000000000000000000000c0d4', { ponsBalance: 4_000, stakeTime: 12_000, holdStreakDays: 12, walletAgeDays: 120, unstakeEvents: [{ at: T0 - 50e8, fraction: 0.5 }, { at: T0 - 20e8, fraction: 0.25 }, { at: T0 - 10e8, fraction: 0.05 }] }),
    expect: { plotCount: 16, rarityFloor: 'uncommon', treeStage: 2, witherMarks: 2, hybridsUnlocked: false, decorFlora: 0 } },
  { name: 'broker + stock decor (decor only, no gameplay effect)', snapshot: base('0x000000000000000000000000000000000000dec5', { ponsBalance: 100, stakeTime: 100, holdStreakDays: 40, walletAgeDays: 60, stockDecor: { brokerNfts: 2, stockTokenKinds: 5, drops: 7 } }),
    expect: { plotCount: 12, rarityFloor: 'rare', treeStage: 1, witherMarks: 0, hybridsUnlocked: false, decorFlora: 6 } },
];
