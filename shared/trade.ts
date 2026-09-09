// Player to player trading.
//
// The whole design exists to defeat one trick: staging a good item, waiting for the other
// person to confirm, then swapping it for a worse one before the trade completes. Every
// scam-resistant trade UI in every game solves this the same way, and it is worth stating
// plainly because it is the only rule that matters:
//
//   ANY CHANGE TO EITHER SIDE RESETS BOTH CONFIRMATIONS.
//
// A trade only completes when both players confirmed the exact contents currently on the
// table. Confirmations do not survive an edit, so there is no window to swap into.
//
// Everything here is pure. The server owns the sessions; this owns the rules.

import type { Plant, Seed } from './types';

export type TradeItemKind = 'seed' | 'plant';
export interface TradeItem { kind: TradeItemKind; uid: string }

export interface TradeSide {
  playerId: string;
  items: TradeItem[];
  sap: number;
  confirmed: boolean;
}

export interface TradeSession {
  id: string;
  a: TradeSide;
  b: TradeSide;
  openedAt: number;
  /** Set once completed or cancelled; a settled session is never reused. */
  closed: 'completed' | 'cancelled' | 'expired' | null;
}

export const MAX_ITEMS_PER_SIDE = 6;
export const TRADE_TIMEOUT_MS = 3 * 60_000;
/** How close two players must stand. Trading is a thing you do face to face in the village. */
export const TRADE_RANGE_PX = 96;

export const newSide = (playerId: string): TradeSide =>
  ({ playerId, items: [], sap: 0, confirmed: false });

export const openTrade = (id: string, aId: string, bId: string, now: number): TradeSession =>
  ({ id, a: newSide(aId), b: newSide(bId), openedAt: now, closed: null });

export const sideOf = (t: TradeSession, playerId: string): TradeSide | null =>
  t.a.playerId === playerId ? t.a : t.b.playerId === playerId ? t.b : null;

export const otherSide = (t: TradeSession, playerId: string): TradeSide | null =>
  t.a.playerId === playerId ? t.b : t.b.playerId === playerId ? t.a : null;

/**
 * THE RULE. Called by every mutation, without exception. If you add a new way to change a
 * trade and forget this, you have reintroduced the swap.
 */
export function resetConfirmations(t: TradeSession): void {
  t.a.confirmed = false;
  t.b.confirmed = false;
}

export const isExpired = (t: TradeSession, now: number): boolean =>
  now - t.openedAt > TRADE_TIMEOUT_MS;

export const bothConfirmed = (t: TradeSession): boolean =>
  t.a.confirmed && t.b.confirmed && !t.closed;

// --- validation -------------------------------------------------------------------------

export type TradeError =
  | 'not-in-trade' | 'closed' | 'too-many' | 'duplicate' | 'not-owned'
  | 'not-enough-sap' | 'negative' | 'no-room' | 'nothing-offered';

/** Can this player put this item on the table? */
export function canOffer(
  t: TradeSession,
  playerId: string,
  item: TradeItem,
  owns: (kind: TradeItemKind, uid: string) => boolean,
): TradeError | null {
  if (t.closed) return 'closed';
  const side = sideOf(t, playerId);
  if (!side) return 'not-in-trade';
  if (side.items.length >= MAX_ITEMS_PER_SIDE) return 'too-many';
  if (side.items.some((i) => i.kind === item.kind && i.uid === item.uid)) return 'duplicate';
  if (!owns(item.kind, item.uid)) return 'not-owned';
  return null;
}

export function canOfferSap(t: TradeSession, playerId: string, sap: number, balance: number): TradeError | null {
  if (t.closed) return 'closed';
  const side = sideOf(t, playerId);
  if (!side) return 'not-in-trade';
  if (!Number.isFinite(sap) || sap < 0 || !Number.isInteger(sap)) return 'negative';
  if (sap > balance) return 'not-enough-sap';
  return null;
}

/**
 * A trade must move something. Two empty sides confirming each other is not a trade, it is a
 * handshake, and letting it complete just adds noise to the feed.
 */
export const isEmpty = (t: TradeSession): boolean =>
  !t.a.items.length && !t.b.items.length && !t.a.sap && !t.b.sap;

/**
 * Both players need room for what they are receiving. Checked at completion rather than at
 * offer time, because a plot can fill up while the trade is open.
 */
export function hasRoom(side: TradeSide, incoming: TradeSide, freePlots: number, seedRoom: number): boolean {
  const plants = incoming.items.filter((i) => i.kind === 'plant').length;
  const seeds = incoming.items.filter((i) => i.kind === 'seed').length;
  void side;
  return plants <= freePlots && seeds <= seedRoom;
}

/** A short, readable summary for the feed. */
export function describe(t: TradeSession, nameOf: (id: string) => string): string {
  const part = (s: TradeSide) => {
    const bits: string[] = [];
    const plants = s.items.filter((i) => i.kind === 'plant').length;
    const seeds = s.items.filter((i) => i.kind === 'seed').length;
    if (plants) bits.push(`${plants} plant${plants > 1 ? 's' : ''}`);
    if (seeds) bits.push(`${seeds} seed${seeds > 1 ? 's' : ''}`);
    if (s.sap) bits.push(`${s.sap} Sap`);
    return bits.length ? bits.join(' + ') : 'nothing';
  };
  return `${nameOf(t.a.playerId)} traded ${part(t.a)} for ${part(t.b)} with ${nameOf(t.b.playerId)}`;
}

export type { Plant, Seed };
