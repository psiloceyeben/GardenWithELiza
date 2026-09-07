// M1 local save: read once for migration to the server, then cleared.
import type { GameState } from '@shared/types';
const KEY = 'pons.save.v1';

export function takeLegacySave(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return null;
    const st = JSON.parse(raw) as GameState;
    localStorage.removeItem(KEY);
    return st.version === 1 ? st : null;
  } catch { return null; }
}
