// M1 local save: read once for migration to the server, then cleared.
import type { GameState } from '@shared/types';
const KEY = 'pons.save.v1';

export function takeLegacySave(): GameState | null {
  // Preserve old local data for an explicit migration/export decision. Do not
  // transmit client-controlled inventory or delete it on an attempted sign-in.
  return null;
}
