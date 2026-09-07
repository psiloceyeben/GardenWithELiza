// Shared types. Layer G (game state) for M1; Layer C (GardenSpec) arrives in M2 via derive/.
export type Tier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type MutationId = 'none' | 'golden' | 'holographic' | 'colossal' | 'feral' | 'backwards' | 'screaming';

export interface Species {
  id: string;
  name: string;
  tier: Tier;
  silhouette: string;
  idle: string;
  flavor: string;
  sapBase: number;
  status: 'exemplar' | 'candidate';
  hybrid?: boolean;   // only offered when the wallet unlocks hybrids (bible §2.5); standard yields
}

export interface Seed { uid: string; speciesId: string; tier: Tier; }

export interface Plant {
  uid: string;
  speciesId: string;
  tier: Tier;
  plantedAt: number;
  growMs: number;
  revealed: boolean;
  size: number;          // 0.8 .. 1.5
  mutation: MutationId;
  watered: boolean;
  lastWeeded: number;
}

export interface Plot { id: number; plant: Plant | null; }

export interface ConveyorSlot { speciesId: string; tier: Tier; price: number; sold: boolean; }

export interface GameState {
  version: number;
  sap: number;
  plots: Plot[];
  seeds: Seed[];
  conveyor: { slots: ConveyorSlot[]; refreshAt: number };
  speedLevel: number;
  rarityFloor: Tier;     // M1: always 'common'; M2: from deriveGarden
  lastSeen: number;
  log: string[];
  stats: { seedsBought: number; reveals: number; sessionStart: number; firstSeedAt: number | null };
}
