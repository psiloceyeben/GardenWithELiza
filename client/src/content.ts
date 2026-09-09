import { resolveRoster, migrateSpeciesId } from '@shared/roster';
import copyJson from '@content/copy.json';
import type { Species, Tier, MutationId } from '@shared/types';

export const ROSTER: Species[] = resolveRoster(import.meta.env.VITE_PONS_ROSTER);
const byId = new Map(ROSTER.map((s) => [s.id, s]));
export const speciesById = (id: string): Species => {
  const s = byId.get(migrateSpeciesId(id));
  if (!s) throw new Error(`unknown species ${id}`);
  return s;
};

export const COPY = copyJson.ui as Record<string, string>;
export const TIER_NAME = copyJson.tiers as Record<Tier, string>;
export const MUTATION_NAME = copyJson.mutations as Record<MutationId, string>;
export const MUTATION_FLAVOR = copyJson.mutationFlavor as Record<string, string>;
