// Server-side roster binding. The only place the server reads PONS_ROSTER.
//
// Flip to the original-IP set with:  Environment=PONS_ROSTER=safe  in the systemd unit,
// then restart and rebuild the client. No data migration - ids are identical across
// modes, so every saved plant, art key and share URL keeps working. See shared/roster.ts.

import { resolveRoster, asRosterMode, speciesIndex, migrateSpeciesId, type RosterMode } from '../../shared/roster';
import type { Species } from '../../shared/types';

export const ROSTER_MODE: RosterMode = asRosterMode(process.env.PONS_ROSTER);
export const ROSTER: Species[] = resolveRoster(ROSTER_MODE);

const byId = speciesIndex(ROSTER);

// Saved gardens may hold pre-migration species ids; resolve them rather than throwing.

/** Throws on an unknown id: an unknown species is corrupt state, not a missing lookup. */
export const speciesById = (id: string): Species => {
  const s = byId.get(migrateSpeciesId(id));
  if (!s) throw new Error(`unknown species ${id}`);
  return s;
};

export const findSpecies = (id: string): Species | undefined => byId.get(migrateSpeciesId(id));
