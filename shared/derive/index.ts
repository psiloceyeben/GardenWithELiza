// deriveGarden(address, snapshot) -> GardenSpec. Pure, deterministic, identical on server, client and share renderer.
// Conduit, not reservoir: anyone can recompute every garden from public chain data (bible §6.3).
import type { ChainSnapshot, GardenSpec } from './types';
import { BIOME_COUNT, GUEST_PLOTS, PLOT_LADDER, FLOOR_LADDER, TREE_LADDER, UNSTAKE_MIN_FRACTION, HYBRID_MIN_TOKENS, DECOR_MAX } from './constants';
export * from './types';
export * from './constants';

export function guestGarden(): GardenSpec {
  return { address: null, plotCount: GUEST_PLOTS, rarityFloor: 'common', biome: 0, treeStage: 0, witherMarks: 0, hybridsUnlocked: false, decorFlora: 0 };
}

/** FNV-1a over the lowercase address; stable across runtimes (no BigInt, no crypto). */
export function addressHash(address: string): number {
  let h = 0x811c9dc5;
  const s = address.toLowerCase();
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

export function deriveGarden(address: string, snap: ChainSnapshot): GardenSpec {
  const addr = address.toLowerCase();
  const stake = Math.max(0, snap.stakeTime || 0);
  const plotCount = stake > 0 ? PLOT_LADDER.find((r) => stake >= r.min)!.plots : GUEST_PLOTS;
  const streak = Math.max(0, snap.holdStreakDays || 0);
  const rarityFloor = FLOOR_LADDER.find((r) => streak >= r.minDays)!.floor;
  const biome = addressHash(addr) % BIOME_COUNT;
  let treeStage = 0;
  for (let i = 0; i < TREE_LADDER.length; i++) if (stake >= TREE_LADDER[i] && (i === 0 || stake > 0)) treeStage = i;
  const witherMarks = (snap.unstakeEvents || []).filter((e) => e.fraction >= UNSTAKE_MIN_FRACTION).length;
  const held = Object.values(snap.ecosystemHoldings || {}).filter((v) => v > 0).length;
  const hybridsUnlocked = held >= HYBRID_MIN_TOKENS;
  const d = snap.stockDecor || { brokerNfts: 0, stockTokenKinds: 0, drops: 0 };
  const decorFlora = Math.min(DECOR_MAX, (d.brokerNfts > 0 ? 1 : 0) + Math.min(3, d.stockTokenKinds) + Math.min(2, Math.floor(d.drops / 3)));
  return { address: addr, plotCount, rarityFloor, biome, treeStage, witherMarks, hybridsUnlocked, decorFlora };
}
