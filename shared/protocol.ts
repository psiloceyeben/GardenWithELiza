// Websocket protocol. JSON messages, `t` discriminates. Client sends intents; server owns state (bible §6.2).
import type { Plant, Seed, ConveyorSlot, Tier, MutationId, GameState } from './types';

export type Dir = 'down' | 'up' | 'side';

export interface Defenses {
  gateMax: number;      // 0 = no fence bought; gate always open
  gateHp: number;
  gnome: boolean;
  sprinkler: boolean;
  scarecrow?: boolean;  // decoy: looks like a gnome to everyone else, never tags
  mud?: boolean;        // slows every non-owner inside the lot
  bell?: boolean;       // owner is told the moment someone enters the lot
}

export interface Bounty { thiefId: string; thiefName: string; byName: string; amount: number; until: number; }
export interface VillageInfo { id: string; name: string; online: number; free: number; }
export interface Thief { id: string; name: string; at: number; }

/** What everyone in the village may see about a lot. */
export interface PublicPlot { i: number; speciesId: string; tier: Tier; revealed: boolean; size: number; mutation: MutationId; lockedUntil: number; weedy: boolean; }

/** Wild seed on the village grounds (phase one: foraging). */
export interface Wild { id: string; x: number; y: number; speciesId: string; tier: Tier; until: number; }
export type EventKind = 'seed_rain' | 'screaming_hour' | 'golden_hour';
export interface VillageEvent { kind: EventKind; startedAt: number; endsAt: number; }
export interface SprintEntry { name: string; ms: number; at: number; }
export interface PublicLot {
  lotId: number;
  ownerId: string;
  name: string;
  color: number;
  online: boolean;
  shielded: boolean;
  plotCount: number;
  plots: PublicPlot[];
  defenses: Defenses;
  land: LandView;
}

/** Layer C as rendered on a lot: derived, permanent, unstealable. */
export interface LandView { address: string | null; biome: number; treeStage: number; witherMarks: number; decorFlora: number; hybrids: boolean; }

/** Private state of the connected player (Layer G). */
export interface PrivateState {
  id: string;
  name: string;
  color: number;
  sap: number;
  seeds: Seed[];
  plots: (Plant | null)[];
  plotCount: number;
  conveyor: { slots: ConveyorSlot[]; refreshAt: number };
  speedLevel: number;
  rarityFloor: Tier;
  defenses: Defenses;
  lotId: number;
  villageId: string;
  stats: { seedsBought: number; reveals: number; steals: number; tags: number; stolenFrom: number };
  lockedUntil: number[];
  land: LandView;
  visiting: string | null;   // village id when away from home
  stolenBy: Thief[];         // who robbed you in the last hour (bounty targets)
}

export interface SnapPlayer { id: string; x: number; y: number; d: Dir; f: boolean; m: boolean; c: string; ch: number; b?: boolean; }

export type ClientMsg =
  | { t: 'hello'; id: string; secret: string; name: string; save?: GameState | null; village?: string }
  | { t: 'input'; dx: number; dy: number; x: number; y: number; d: Dir; f: boolean; m: boolean }
  | { t: 'buy'; slot: number }
  | { t: 'plant'; seedUid: string; plotId: number }
  | { t: 'tend'; plotId: number }
  | { t: 'shop'; item: ShopItem; plotId?: number }
  | { t: 'uproot'; ownerId: string; plotId: number }
  | { t: 'break'; ownerId: string }
  | { t: 'cancel' }
  | { t: 'chat'; text: string }
  | { t: 'emote'; e: number }
  | { t: 'rename'; name: string }
  | { t: 'nonce'; address: string }
  | { t: 'link'; address: string; signature: string }
  | { t: 'unlink' }
  | { t: 'forage'; id: string }
  | { t: 'sprint' }
  | { t: 'bounty'; thiefId: string; amount: number }
  | { t: 'visit'; village: string }
  | { t: 'home' }
  | { t: 'villages' }
  | { t: 'ping'; n: number };

export type ShopItem = 'train' | 'fence' | 'repair' | 'gnome' | 'sprinkler' | 'lock' | 'scarecrow' | 'mud' | 'bell';

export interface FeedEvent { at: number; kind: 'steal' | 'tag' | 'gate' | 'reveal' | 'join' | 'uproot' | 'break'; text: string; }

export type ServerMsg =
  | { t: 'welcome'; you: PrivateState; village: { id: string; seed: number; biome: number; name: string }; lots: PublicLot[]; players: SnapPlayer[]; names: Record<string, { name: string; color: number }>; feed: FeedEvent[]; now: number; villages: VillageInfo[] }
  | { t: 'villages'; list: VillageInfo[] }
  | { t: 'snap'; now: number; p: SnapPlayer[] }
  | { t: 'state'; you: Partial<PrivateState> }
  | { t: 'lot'; lot: PublicLot }
  | { t: 'players'; names: Record<string, { name: string; color: number }>; left?: string[] }
  | { t: 'feed'; e: FeedEvent }
  | { t: 'reveal'; plant: Plant }
  | { t: 'toast'; text: string }
  | { t: 'chat'; id: string; name: string; text: string }
  | { t: 'emote'; id: string; e: number }
  | { t: 'channel'; kind: 'uproot' | 'break' | null; endsAt: number; startedAt: number }
  | { t: 'carry'; speciesId: string | null }
  | { t: 'error'; text: string }
  | { t: 'nonce'; address: string; message: string }
  | { t: 'linked'; address: string | null; land: LandView; plotCount: number; rarityFloor: Tier }
  | { t: 'wild'; add?: Wild[]; remove?: string[]; all?: Wild[] }
  | { t: 'event'; ev: VillageEvent | null }
  | { t: 'sprint'; phase: 'start' | 'turn' | 'finish' | 'cancel'; ms?: number; best?: number; record?: boolean }
  | { t: 'board'; sprint: SprintEntry[]; bounties?: Bounty[] }
  | { t: 'pong'; n: number; now: number };

// Phase one [TUNABLE]
export const WILD_MAX = 8;
export const WILD_SPAWN_MS = 90_000;
export const WILD_TTL_MS = 10 * 60_000;
export const EVENT_PERIOD_MS = 20 * 60_000;
export const EVENT_LEN_MS = 3 * 60_000;
export const WEEDY_AFTER_MS = 20 * 60_000;
export const WEEDY_FACTOR = 0.5;
export const SPRINT_REWARD = 20;
export const SPRINT_RECORD_BONUS = 50;
export const SPRINT_COOLDOWN_MS = 5 * 60_000;

// Raid rules (bible §3.2) [TUNABLE]
export const UPROOT_MS = 3000;
export const BREAK_HIT_MS = 2000;
export const CARRY_SPEED = 0.7;
export const SPRINKLER_SPEED = 0.6;
export const TAG_RADIUS = 22;
export const GNOME_RADIUS = 44;
export const GRACE_MS = 10 * 60_000;
export const STEAL_CAP_PER_HOUR = 3;
export const BOUNTY_SEC = 60;
export const BOUNTY_MIN = 20;
export const LOCK_MS = 24 * 3600_000;
export const TICK_MS = 50;
export const SNAP_MS = 100;
export const BASE_SPEED = 90;
export const SHOP_PRICES = { fence: 300, repair: 100, gnome: 800, sprinkler: 500, lock: 150, scarecrow: 250, mud: 400, bell: 150 } as const;
export const MUD_SPEED = 0.6;
export const BOUNTY_MIN_POST = 50;
export const BOUNTY_MAX_POST = 2000;
export const BOUNTY_TTL_MS = 3600_000;
export const EMOTES = ['👋', '😂', '😭', '😡', '❤️', '💀'];
