import type { ClientMsg } from '../../shared/protocol';
import { COSMETIC_PRICES, EMOTES, HAT_COUNT, HAIR_STYLES, SKIN_TONES, BOUNTY_MAX_POST, BOUNTY_MIN_POST } from '../../shared/protocol';
import { MAX_PLOTS } from '../../shared/world';

const str = (v: unknown, max = 128): v is string => typeof v === 'string' && v.length <= max;
const id = (v: unknown): v is string => str(v) && v.length > 0;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const integer = (v: unknown, min: number, max: number): boolean => finite(v) && Number.isInteger(v) && v >= min && v <= max;
const plot = (v: unknown): boolean => integer(v, 0, MAX_PLOTS - 1);
const address = (v: unknown): boolean => str(v, 42) && /^0x[0-9a-fA-F]{40}$/.test(v);

/** Runtime boundary for JSON, not a replacement for authorization/game rules. */
export function isClientMsg(value: unknown): value is ClientMsg {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const m = value as Record<string, unknown>;
  switch (m.t) {
    // save is intentionally ignored, never trusted as progression.
    case 'hello': return str(m.id, 32) && /^[a-z0-9]{8,32}$/i.test(m.id) && str(m.secret, 64) && m.secret.length >= 8 && str(m.name, 256) && (m.village === undefined || id(m.village));
    case 'input': return finite(m.dx) && finite(m.dy) && finite(m.x) && finite(m.y) && ['down', 'up', 'side'].includes(m.d as string) && typeof m.f === 'boolean' && typeof m.m === 'boolean';
    case 'buy': return integer(m.slot, 0, 1000);
    case 'plant': return id(m.seedUid) && plot(m.plotId);
    case 'tend': return plot(m.plotId);
    case 'shop': return ['train', 'fence', 'repair', 'gnome', 'sprinkler', 'lock', 'scarecrow', 'mud', 'bell'].includes(m.item as string) && (m.plotId === undefined ? m.item !== 'lock' : plot(m.plotId));
    case 'uproot': return id(m.ownerId) && plot(m.plotId);
    case 'break': return id(m.ownerId);
    case 'chat': return str(m.text, 1000);
    case 'emote': return integer(m.e, 0, EMOTES.length - 1);
    case 'rename': return str(m.name, 256);
    case 'nonce': return address(m.address);
    case 'link': return address(m.address) && str(m.signature, 132) && /^0x[0-9a-fA-F]{130}$/.test(m.signature);
    case 'forage': return id(m.id);
    case 'bounty': return id(m.thiefId) && integer(m.amount, BOUNTY_MIN_POST, BOUNTY_MAX_POST);
    case 'visit': return id(m.village);
    case 'cosmetic': return typeof m.item === 'string' && Object.prototype.hasOwnProperty.call(COSMETIC_PRICES, m.item);
    case 'wardrobe': return (m.shirt !== undefined || m.hat !== undefined || m.skin !== undefined || m.hair !== undefined) && (m.shirt === undefined || integer(m.shirt, 0, 5)) && (m.hat === undefined || integer(m.hat, 0, HAT_COUNT - 1)) && (m.skin === undefined || integer(m.skin, 0, SKIN_TONES.length - 1)) && (m.hair === undefined || integer(m.hair, 0, HAIR_STYLES.length - 1));
    case 'nick': return plot(m.plotId) && str(m.name, 256);
    case 'talk': return id(m.npc);
    case 'mission': return id(m.id) && (m.action === 'accept' || m.action === 'claim');
    case 'ask': return id(m.npc) && str(m.text, 1000) && (m.requestId === undefined || (str(m.requestId, 64) && /^[a-zA-Z0-9-]+$/.test(m.requestId)));
    case 'ping': return finite(m.n);
    case 'cancel': case 'unlink': case 'sprint': case 'home': case 'villages': case 'claim': case 'tradeClose': return true;
    case 'register': case 'login': return typeof m.username === 'string' && m.username.length > 0 && m.username.length <= 32 && typeof m.password === 'string' && m.password.length > 0 && m.password.length <= 200;
    case 'tradeOpen': return typeof m.playerId === 'string' && m.playerId.length > 0 && m.playerId.length <= 64;
    case 'tradeOffer': return (m.kind === 'seed' || m.kind === 'plant') && typeof m.uid === 'string' && m.uid.length > 0 && m.uid.length <= 64 && typeof m.add === 'boolean';
    case 'tradeSap': return finite(m.sap) && m.sap >= 0;
    case 'tradeConfirm': return typeof m.confirmed === 'boolean';
    default: return false;
  }
}
