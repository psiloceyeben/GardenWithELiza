// Season state on the server: tallies, the bell, and the prize ledger.
//
// The arithmetic all lives in shared/season.ts and is pure. This file owns the mutable
// parts - whose tally is whose, when the bell fires, and writing the ledger - and nothing
// more, so the numbers that decide a prize stay reproducible.
//
// PAYOUT BOUNDARY: this module computes standings and writes a ledger row naming the
// winners and their share. It never moves value. Transferring the prize is a human step
// performed by Benjamin against the ledger, by design (bible I-6 as amended, and
// RELEASE_PLAN.md s9B).

import fs from 'node:fs';
import path from 'node:path';
import {
  seasonNumberAt, seasonEnd, msUntilBell,
  emptyProfile, rollSeason, applySettlement, isPrizeEligible,
  bookValue, scoreOf, standings, settle, stealPoints,
  PRIZE_SPLIT, SETTLEMENTS,
  type PlayerProfile, type SeasonRecord, type Settlement, type Standing,
} from '../../shared/season';
import type { Plant, Species, Sector } from '../../shared/types';

export interface BellPlayer {
  /** Automated player. Ranks publicly, never paid - see Season Rules and the plugin README. */
  agent?: boolean;
  id: string;
  name: string;
  plots: (Plant | null)[];
  profile: PlayerProfile;
  /** Balances already decimal-adjusted; guests are 0/0 and simply never qualify. */
  ponsGarden: number;
  pons: number;
  /** Chosen before the bell; absent means the default. */
  settlement?: Settlement;
}

/** Unchosen settlement defaults to carry: the option that loses a player nothing. */
export const DEFAULT_SETTLEMENT: Settlement = 'carry';
export const asSettlement = (v: unknown): Settlement =>
  SETTLEMENTS.includes(v as Settlement) ? (v as Settlement) : DEFAULT_SETTLEMENT;

/** Ensure a profile exists and is rolled to the current season. Safe to call every tick. */
export function currentProfile(existing: PlayerProfile | undefined, now: number): PlayerProfile {
  const season = seasonNumberAt(now);
  if (!existing) return emptyProfile(season);
  return rollSeason(existing, season);
}

// --- tally mutators. Each returns a NEW profile; callers assign it back. ---------------

export const recordSteal = (p: PlayerProfile, victimId: string): PlayerProfile => ({
  ...p,
  tally: { ...p.tally, stealsByVictim: { ...p.tally.stealsByVictim, [victimId]: (p.tally.stealsByVictim[victimId] ?? 0) + 1 } },
});

export const recordTag = (p: PlayerProfile): PlayerProfile =>
  ({ ...p, tally: { ...p.tally, tags: p.tally.tags + 1 } });

export const recordDefenseHeld = (p: PlayerProfile): PlayerProfile =>
  ({ ...p, tally: { ...p.tally, defensesHeld: p.tally.defensesHeld + 1 } });

export const recordMission = (p: PlayerProfile): PlayerProfile =>
  ({ ...p, tally: { ...p.tally, missions: p.tally.missions + 1 } });

export const setSprintRecord = (p: PlayerProfile, holds: boolean): PlayerProfile =>
  ({ ...p, tally: { ...p.tally, holdsSprintRecord: holds } });

/** What the next steal from this victim is worth, for the "+10" toast. */
export const nextStealValue = (p: PlayerProfile, victimId: string): number =>
  stealPoints((p.tally.stealsByVictim[victimId] ?? 0) + 1);

// --- the bell --------------------------------------------------------------------------

export interface BellResult {
  season: number;
  bellAt: number;
  standings: Standing[];
  /** Sap to credit each player from their settlement. */
  sapAwards: Record<string, number>;
  profiles: Record<string, PlayerProfile>;
  /** Winners and their share of the pot. Informational: nothing is transferred here. */
  payouts: { playerId: string; name: string; prizeRank: number; share: number }[];
}

/**
 * Run the closing bell. Pure given its inputs, so a season can be replayed from the log
 * and produce a byte-identical result.
 */
export function runBell(
  players: BellPlayer[],
  season: number,
  bellAt: number,
  speciesOf: (id: string) => Species | undefined,
  market?: ReadonlyMap<Sector, number>,
): BellResult {
  const rows = players.map((pl) => {
    const book = bookValue(pl.plots, speciesOf, bellAt, market);
    return {
      playerId: pl.id,
      name: pl.name,
      score: scoreOf(pl.profile.tally, book),
      bookValue: book,
      eligible: !pl.agent && isPrizeEligible(pl.ponsGarden, pl.pons),
    };
  });

  const table = standings(rows);
  const byId = new Map(players.map((p) => [p.id, p]));
  const sapAwards: Record<string, number> = {};
  const profiles: Record<string, PlayerProfile> = {};

  for (const st of table) {
    const pl = byId.get(st.playerId)!;
    const choice = asSettlement(pl.settlement);
    const result = settle(choice, st.bookValue);
    const record: SeasonRecord = {
      season, score: st.score, bookValue: st.bookValue,
      rank: st.rank, prizeRank: st.prizeRank,
      settlement: choice, vintage: result.vintage, endedAt: bellAt,
    };
    // applySettlement is idempotent, so a replayed bell cannot pay twice.
    const { profile, sapAwarded } = applySettlement(pl.profile, record, result);
    profiles[st.playerId] = profile;
    sapAwards[st.playerId] = sapAwarded;
  }

  const payouts = table
    .filter((s) => s.prizeRank > 0)
    .map((s) => ({ playerId: s.playerId, name: s.name, prizeRank: s.prizeRank, share: PRIZE_SPLIT[s.prizeRank - 1] }));

  return { season, bellAt, standings: table, sapAwards, profiles, payouts };
}

// --- the prize ledger -------------------------------------------------------------------

export interface LedgerRow {
  season: number;
  bellAt: number;
  bellAtIso: string;
  /** Left null by the game. Benjamin fills these in when the transfer is made. */
  referencePriceUsd: number | null;
  potUsd: number;
  winners: { playerId: string; name: string; prizeRank: number; share: number; usd: number; ponsAmount: number | null; txHash: string | null }[];
  paidAt: string | null;
  note: string;
}

export const POT_USD = 100;

/**
 * Append one immutable row per season. Written at the bell so the winners are fixed by the
 * game and cannot drift afterwards; the amount and the transaction hash are filled in by
 * hand when Benjamin pays. Kept as JSONL so a bad row can never corrupt earlier ones.
 */
export function writeLedgerRow(dir: string, result: BellResult): LedgerRow {
  const row: LedgerRow = {
    season: result.season,
    bellAt: result.bellAt,
    bellAtIso: new Date(result.bellAt).toISOString(),
    referencePriceUsd: null,
    potUsd: POT_USD,
    winners: result.payouts.map((p) => ({
      ...p,
      usd: Math.round(POT_USD * p.share * 100) / 100,
      ponsAmount: null,
      txHash: null,
    })),
    paidAt: null,
    note: 'Winners fixed by the game at the bell. Reference price, PONS amount and tx hash are filled in by hand at payout. The game never moves value.',
  };
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, 'prize-ledger.jsonl'), JSON.stringify(row) + '\n', 'utf8');
  return row;
}

export function readLedger(dir: string): LedgerRow[] {
  const f = path.join(dir, 'prize-ledger.jsonl');
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as LedgerRow);
}

// --- scheduling --------------------------------------------------------------------------

/**
 * The next season owed a bell, or 0 if none is. Seasons settle strictly in order and one
 * per call, so a server that was down across several bells catches up one at a time rather
 * than collapsing them - each season's standings stay separately auditable.
 */
export const dueBellSeason = (lastSettled: number, now: number): number => {
  const current = seasonNumberAt(now);
  const newest = current - 1;            // the newest season that has actually ended
  if (newest < 1) return 0;              // season 1 is still running, or has not opened
  return lastSettled < newest ? lastSettled + 1 : 0;
};

export { msUntilBell, seasonNumberAt };
