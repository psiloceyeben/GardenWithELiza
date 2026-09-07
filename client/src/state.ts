// Local-only Layer G state for M1. Server-authoritative in M3.
import type { GameState, Plot } from '@shared/types';
import { STARTING_SAP, OFFLINE_CAP_MS, sapPerSec, rollConveyor, CONVEYOR_REFRESH_MS } from '@shared/economy';
import { mulberry32, randomSeed } from '@shared/rng';
import { ROSTER, speciesById } from './content';

const KEY = 'pons.save.v1';
export const PLOT_COUNT = 6; // M1 starter garden; M2 derives this from the wallet

export function newState(now: number): GameState {
  const plots: Plot[] = Array.from({ length: PLOT_COUNT }, (_, i) => ({ id: i, plant: null }));
  const rng = mulberry32(randomSeed());
  return {
    version: 1,
    sap: STARTING_SAP,
    plots,
    seeds: [],
    conveyor: { slots: rollConveyor(rng, ROSTER, 'common', PLOT_COUNT), refreshAt: now + CONVEYOR_REFRESH_MS },
    speedLevel: 0,
    rarityFloor: 'common',
    lastSeen: now,
    log: [],
    stats: { seedsBought: 0, reveals: 0, sessionStart: now, firstSeedAt: null },
  };
}

export function load(now: number): { state: GameState; offlineSap: number; fresh: boolean } {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  if (!raw) return { state: newState(now), offlineSap: 0, fresh: true };
  try {
    const st = JSON.parse(raw) as GameState;
    if (st.version !== 1) return { state: newState(now), offlineSap: 0, fresh: true };
    const elapsed = Math.min(Math.max(0, now - st.lastSeen), OFFLINE_CAP_MS);
    let offlineSap = 0;
    for (const p of st.plots) if (p.plant) offlineSap += sapPerSec(p.plant, speciesById(p.plant.speciesId)) * (elapsed / 1000);
    offlineSap = Math.floor(offlineSap);
    st.sap += offlineSap;
    st.lastSeen = now;
    st.stats.sessionStart = now;
    return { state: st, offlineSap, fresh: false };
  } catch {
    return { state: newState(now), offlineSap: 0, fresh: true };
  }
}

export function save(state: GameState, now: number): void {
  state.lastSeen = now;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export function reset(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
