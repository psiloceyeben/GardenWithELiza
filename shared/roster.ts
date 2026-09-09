// Roster resolution. THE FLIP LIVES HERE.
//
// content/roster.json holds one entry per species with a stable neutral `id` and TWO
// display sets: `market` (the STOCKNAMEplant larp) and `safe` (original IP). Everything
// the game persists or keys art from - ids, tiers, sectors, sapBase - is shared between
// them, so switching rosters is a display change and never a data migration.
//
// Bible I-9 as amended 2026-09-08 makes "the flip stays cheap" a standing release-blocker
// condition. `assertFlipSafe()` below is what enforces it; call it from tests.
//
// This module must stay usable from BOTH the node server and the Vite client, so it never
// touches process.env or import.meta. Each side reads its own env and passes the mode in.

import rosterJson from '../content/roster.json';
import type { Species, Tier, Sector } from './types';

export const ROSTER_MODES = ['market', 'safe'] as const;
export type RosterMode = (typeof ROSTER_MODES)[number];
export const DEFAULT_ROSTER_MODE: RosterMode = 'market';

interface DisplaySet { name: string; ticker: string; silhouette: string; idle: string; flavor: string }
interface RosterEntry {
  id: string;
  tier: Tier;
  sector: Sector;
  sapBase: number;
  status: 'exemplar' | 'candidate';
  hybrid?: boolean;
  market: DisplaySet;
  safe: DisplaySet;
}

const ENTRIES = rosterJson.species as unknown as RosterEntry[];

/** Coerce arbitrary input (env var, query string) to a valid mode. Unknown -> default. */
export const asRosterMode = (v: unknown): RosterMode =>
  (ROSTER_MODES as readonly string[]).includes(String(v)) ? (v as RosterMode) : DEFAULT_ROSTER_MODE;

/** Flatten the dual-name roster into the flat Species shape the game uses. */
export function resolveRoster(mode: unknown = DEFAULT_ROSTER_MODE): Species[] {
  const m = asRosterMode(mode);
  return ENTRIES.map((e) => {
    const d = e[m];
    return {
      id: e.id,
      name: d.name,
      ticker: d.ticker,
      sector: e.sector,
      tier: e.tier,
      silhouette: d.silhouette,
      idle: d.idle,
      flavor: d.flavor,
      sapBase: e.sapBase,
      status: e.status,
      ...(e.hybrid ? { hybrid: true } : {}),
    };
  });
}

/** Ids are the identity layer and never vary by mode. Art keys off these. */
export const SPECIES_IDS: string[] = ENTRIES.map((e) => e.id);

export const SECTORS: Sector[] = [
  'shells', 'growth', 'retail', 'staples', 'financials',
  'energy', 'semis', 'biotech', 'adtech', 'funds',
];

export const speciesIndex = (roster: Species[]): Map<string, Species> =>
  new Map(roster.map((s) => [s.id, s]));

/**
 * The release-blocker check from the amended I-9: prove a roster flip is display-only.
 * Throws with a specific reason rather than returning a boolean, so a failing CI run
 * names the defect. Called from server/src/tests/roster-flip.test.ts.
 */
export function assertFlipSafe(): void {
  const market = resolveRoster('market');
  const safe = resolveRoster('safe');

  if (market.length !== safe.length) {
    throw new Error(`roster length differs: market=${market.length} safe=${safe.length}`);
  }

  for (let i = 0; i < market.length; i++) {
    const a = market[i];
    const b = safe[i];
    // Identity and every gameplay-affecting field must be identical across modes.
    for (const k of ['id', 'tier', 'sector', 'sapBase'] as const) {
      if (a[k] !== b[k]) {
        throw new Error(`species ${a.id}: ${k} differs across rosters (${String(a[k])} vs ${String(b[k])})`);
      }
    }
    // Display strings must actually differ, or the "safe" set is not a real reskin.
    if (a.name === b.name) {
      throw new Error(`species ${a.id}: safe roster reuses the market name "${a.name}"`);
    }
  }

  const ids = new Set(SPECIES_IDS);
  if (ids.size !== SPECIES_IDS.length) throw new Error('duplicate species id in roster');

  // An id that embeds a market name would leak the larp into saves, art keys and share
  // URLs, which is exactly what makes a reskin expensive. Ids come from the safe set.
  for (const s of market) {
    const bare = s.name.toLowerCase().replace(/plant$/, '');
    if (bare.length >= 3 && s.id.toLowerCase().includes(bare)) {
      throw new Error(`species id "${s.id}" embeds market name "${s.name}"; ids must be neutral`);
    }
  }
}

/**
 * Legacy species ids from the pre-2026-09-08 nineteen-species roster, mapped onto the
 * thirty-species board. Saved gardens predate the market roster, and a player who logs in
 * after the switch must find their plants intact rather than gone.
 *
 * Every mapping is TIER-PRESERVING: a rare stays rare, so nobody's garden gains or loses
 * value across the migration and no season standing is distorted by it.
 */
export const LEGACY_SPECIES: Readonly<Record<string, string>> = {
  // common
  gorbulon_sprig: 'husk_holdings', plain_gerald: 'moonwort',
  bogwort: 'bagholly', concerned_radish: 'pennysprout',
  // uncommon
  weeping_wumbus: 'fernance_brothers', clammy_pete: 'voltvine',
  low_ambition_tulip: 'ticker_tulip', corn_that_knows: 'panopticus_palm',
  // rare
  unlicensed_carrot: 'divvy_fig', pumpkin_esquire: 'bullrush',
  bartholomew_bean: 'middling_mills', sunflower_who_lied: 'everbloom',
  melonhound: 'orchard_prime',
  // epic
  sir_blombus: 'beargonia', duchess_turnip: 'aunt_hazels',
  grabby_bertrand: 'mahogany_board', pineapple_enforcer: 'cornerstone_cactus',
  cactusberry_vicar: 'custodian_cypress',
  // legendary
  fraudulent_orchid: 'circuit_sequoia', lord_eggplant: 'blue_chip_oak',
  bamboo_inspector: 'trillion_thistle',
  // mythic
  yelling_tuber: 'the_index',
};

/** Resolve a possibly-legacy species id to a current one. Unknown ids pass through. */
export const migrateSpeciesId = (id: string): string => LEGACY_SPECIES[id] ?? id;
