// Trading. Almost every test here is about one attack: stage something good, wait for the
// other person to confirm, swap it for something worse, and let the trade complete.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  openTrade, sideOf, otherSide, resetConfirmations, bothConfirmed, isExpired, isEmpty,
  canOffer, canOfferSap, hasRoom, describe as describeTrade,
  MAX_ITEMS_PER_SIDE, TRADE_TIMEOUT_MS,
} from '../../../shared/trade';

const NOW = Date.UTC(2026, 8, 9, 12, 0, 0);
const owns = () => true;
const fresh = () => openTrade('t1', 'alice', 'bob', NOW);

test('a trade completes only when both sides confirm', () => {
  const t = fresh();
  assert.equal(bothConfirmed(t), false);
  sideOf(t, 'alice')!.confirmed = true;
  assert.equal(bothConfirmed(t), false, 'one confirmation is not a trade');
  sideOf(t, 'bob')!.confirmed = true;
  assert.equal(bothConfirmed(t), true);
});

test('THE ATTACK: changing an offer after the other side confirmed resets both', () => {
  const t = fresh();
  sideOf(t, 'alice')!.items.push({ kind: 'plant', uid: 'good-one' });
  t.a.confirmed = true;
  t.b.confirmed = true;
  assert.equal(bothConfirmed(t), true, 'set up: both agreed on the good plant');

  // Alice swaps the good plant for junk. Every mutation must call resetConfirmations.
  t.a.items = [{ kind: 'plant', uid: 'junk' }];
  resetConfirmations(t);

  assert.equal(t.a.confirmed, false);
  assert.equal(t.b.confirmed, false, 'BOTH confirmations must clear, not just the changer');
  assert.equal(bothConfirmed(t), false, 'the swap cannot complete');
});

test('adding sap also resets, not just items', () => {
  const t = fresh();
  t.a.confirmed = true; t.b.confirmed = true;
  t.a.sap = 500;
  resetConfirmations(t);
  assert.equal(bothConfirmed(t), false);
});

test('a settled trade can never be reopened or confirmed', () => {
  const t = fresh();
  t.closed = 'completed';
  t.a.confirmed = true; t.b.confirmed = true;
  assert.equal(bothConfirmed(t), false, 'closed beats confirmed');
  assert.equal(canOffer(t, 'alice', { kind: 'seed', uid: 's1' }, owns), 'closed');
  assert.equal(canOfferSap(t, 'alice', 10, 1000), 'closed');
});

test('you cannot offer what you do not have, or offer it twice', () => {
  const t = fresh();
  assert.equal(canOffer(t, 'alice', { kind: 'seed', uid: 's1' }, () => false), 'not-owned');
  t.a.items.push({ kind: 'seed', uid: 's1' });
  assert.equal(canOffer(t, 'alice', { kind: 'seed', uid: 's1' }, owns), 'duplicate');
  // Same uid, different kind, is a different thing and is allowed.
  assert.equal(canOffer(t, 'alice', { kind: 'plant', uid: 's1' }, owns), null);
});

test('a stranger cannot touch somebody else�s trade', () => {
  const t = fresh();
  assert.equal(canOffer(t, 'mallory', { kind: 'seed', uid: 's1' }, owns), 'not-in-trade');
  assert.equal(canOfferSap(t, 'mallory', 5, 1000), 'not-in-trade');
  assert.equal(sideOf(t, 'mallory'), null);
  assert.equal(otherSide(t, 'alice')!.playerId, 'bob');
});

test('sap offers are bounded by the balance and must be whole and positive', () => {
  const t = fresh();
  assert.equal(canOfferSap(t, 'alice', 100, 1000), null);
  assert.equal(canOfferSap(t, 'alice', 1001, 1000), 'not-enough-sap');
  assert.equal(canOfferSap(t, 'alice', -5, 1000), 'negative');
  assert.equal(canOfferSap(t, 'alice', 1.5, 1000), 'negative');
  assert.equal(canOfferSap(t, 'alice', NaN, 1000), 'negative');
});

test('a side cannot hold more than the cap', () => {
  const t = fresh();
  for (let i = 0; i < MAX_ITEMS_PER_SIDE; i++) t.a.items.push({ kind: 'seed', uid: `s${i}` });
  assert.equal(canOffer(t, 'alice', { kind: 'seed', uid: 'extra' }, owns), 'too-many');
});

test('an empty trade is not a trade', () => {
  const t = fresh();
  assert.equal(isEmpty(t), true);
  t.a.sap = 1;
  assert.equal(isEmpty(t), false);
});

test('both sides must have room for what they receive', () => {
  const t = fresh();
  t.b.items = [{ kind: 'plant', uid: 'p1' }, { kind: 'plant', uid: 'p2' }, { kind: 'seed', uid: 's1' }];
  assert.equal(hasRoom(t.a, t.b, 2, 5), true, 'two free plots is enough for two plants');
  assert.equal(hasRoom(t.a, t.b, 1, 5), false, 'one free plot is not');
  assert.equal(hasRoom(t.a, t.b, 2, 0), false, 'no seed room');
});

test('trades expire so an abandoned window does not hold items hostage', () => {
  const t = fresh();
  assert.equal(isExpired(t, NOW + TRADE_TIMEOUT_MS - 1), false);
  assert.equal(isExpired(t, NOW + TRADE_TIMEOUT_MS + 1), true);
});

test('the feed line reads like a sentence', () => {
  const t = fresh();
  t.a.items = [{ kind: 'plant', uid: 'p1' }];
  t.b.items = [{ kind: 'seed', uid: 's1' }, { kind: 'seed', uid: 's2' }];
  t.b.sap = 300;
  const line = describeTrade(t, (id) => (id === 'alice' ? 'Marla' : 'Nix'));
  assert.equal(line, 'Marla traded 1 plant for 2 seeds + 300 Sap with Nix');
});

// --- gates ---------------------------------------------------------------------------
// A fence is a defence against neighbours. Buying one used to lock the owner out of their
// own garden, which is the least useful thing a purchase has ever done.

test('a closed gate opens for its owner and nobody else', () => {
  const lots = [
    { ownerId: 'alice', gate: { tx: 10, ty: 20 }, gateHp: 3 },
    { ownerId: 'bob', gate: { tx: 30, ty: 40 }, gateHp: 0 },
  ];
  // The shape both the server and the two client renderers implement.
  const closedFor = (viewerId: string) => (tx: number, ty: number): boolean => {
    for (const l of lots) {
      if (l.gate.tx === tx && l.gate.ty === ty) {
        return l.ownerId !== viewerId && l.gateHp > 0;
      }
    }
    return false;
  };

  assert.equal(closedFor('alice')(10, 20), false, 'the owner walks through their own fence');
  assert.equal(closedFor('bob')(10, 20), true, 'a neighbour does not');
  assert.equal(closedFor('alice')(30, 40), false, 'an unfenced gate is open to everyone');
  assert.equal(closedFor('alice')(99, 99), false, 'a tile with no gate is never closed');
});

// --- shield --------------------------------------------------------------------------
// The shield used to return true for anyone with no live socket, so closing the tab made a
// garden permanently unrobbable. With most players offline at any moment, that left almost
// nothing to raid and contradicted the "secure for five minutes" message shown on join.

test('the shield is purely time-based and does not depend on being connected', () => {
  const GRACE = 5 * 60_000;
  const shielded = (rec: { shieldUntil?: number }, now: number) => now < (rec.shieldUntil ?? 0);

  const fresh = { shieldUntil: NOW + GRACE };
  assert.equal(shielded(fresh, NOW), true, 'a new garden is safe');
  assert.equal(shielded(fresh, NOW + GRACE - 1), true, 'right up to the boundary');
  assert.equal(shielded(fresh, NOW + GRACE + 1), false, 'and open immediately after');

  // The old bug: an offline player. Connection state is not consulted at all now.
  assert.equal(shielded(fresh, NOW + 60 * 60_000), false, 'being offline does not extend it');
  assert.equal(shielded({}, NOW), false, 'a record with no grace set is not shielded forever');
});
