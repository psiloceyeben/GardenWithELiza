import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { WebSocket } from 'ws';
import { Game } from '../game';
import { SHOP_PRICES, LOCK_MS, STEAL_CAP_PER_HOUR, BOUNTY_MIN, BOUNTY_SEC, BASE_SPEED, MUD_SPEED, CARRY_SPEED, SPRINKLER_SPEED } from '../../../shared/protocol';
import { sapPerSec } from '../../../shared/economy';
import type { Plant, Species } from '../../../shared/types';
import { ROSTER } from '../roster';
const tagPayment = (plant: Plant) => Math.max(BOUNTY_MIN, Math.floor(sapPerSec(plant, ROSTER.find(s => s.id === plant.speciesId)! as Species) * BOUNTY_SEC));
import { TILE, lotGatePx } from '../../../shared/world';
async function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'pons-raid-test-'));
  const game = new Game(directory); await game.initialize();
  const socket = () => ({ OPEN: 1, readyState: 1, send() {}, close() {} }) as unknown as WebSocket;
  const owner = game.join(socket(), { t: 'hello', id: 'raidowner001', secret: 'owner-secret', name: 'Owner' })!;
  const thief = game.join(socket(), { t: 'hello', id: 'raidthief001', secret: 'thief-secret', name: 'Thief' })!;
  const rec = game.players.get(owner.id)!, attacker = game.players.get(thief.id)!; const now = Date.now();
  owner.shieldUntil = 0; thief.shieldUntil = 0; rec.sap = 2000;
  rec.plots[0] = { uid: 'original', speciesId: 'husk_holdings', tier: 'common', plantedAt: now - 60000, growMs: 30000,
    revealed: true, size: 1, mutation: 'none', watered: false, lastWeeded: now };
  const plot = game.lot(rec).plots[0]; thief.x = plot.tx * TILE + 16; thief.y = plot.ty * TILE + 16;
  game.store.touch(); return { game, owner, thief, rec, attacker, now, directory };
}
test('plot lock bought while uprooting is in progress prevents the theft and charges exactly once', async () => {
  const { game, owner, thief, rec, attacker, now } = await setup();
  try {
    game.onUproot(thief, attacker, rec.id, 0, now); assert(thief.channel); const end = thief.channel.endsAt;
    game.onShop(owner, rec, 'lock', 0, now + 1); assert.equal(rec.sap, 2000 - SHOP_PRICES.lock); assert.equal(rec.lockedUntil[0], now + 1 + LOCK_MS);
    game.onShop(owner, rec, 'lock', 0, now + 2); assert.equal(rec.sap, 2000 - SHOP_PRICES.lock);
    game.completeChannel(thief, attacker, end); assert.equal(rec.plots[0]?.uid, 'original'); assert.equal(thief.carry, null);
  } finally { await game.store.close(); }
});
test('successful uproot waits for duration and moves the exact plant once into persisted carry', async () => {
  const { game, thief, rec, attacker, now } = await setup();
  const carry = () => thief.carry;
  try {
    game.onUproot(thief, attacker, rec.id, 0, now); assert(thief.channel); const end = thief.channel.endsAt;
    game.completeChannel(thief, attacker, end - 1); assert(rec.plots[0]); assert.equal(thief.carry, null);
    game.completeChannel(thief, attacker, end); assert.equal(rec.plots[0], null); assert.equal(carry()?.plant.uid, 'original');
    assert.deepEqual(attacker.carried, thief.carry); game.completeChannel(thief, attacker, end + 1); assert.equal(carry()?.plant.uid, 'original');
  } finally { await game.store.close(); }
});
test('replaced plant or newly shielded owner invalidates pending uproot', async () => {
  for (const change of ['replace', 'shield']) {
    const { game, owner, thief, rec, attacker, now } = await setup();
    try {
      game.onUproot(thief, attacker, rec.id, 0, now); assert(thief.channel); const end = thief.channel.endsAt;
      if (change === 'replace') rec.plots[0] = { ...rec.plots[0]!, uid: 'replacement' }; else owner.shieldUntil = end + 1000;
      game.completeChannel(thief, attacker, end); assert(rec.plots[0]); assert.equal(thief.carry, null);
    } finally { await game.store.close(); }
  }
});
test('fence purchase, duplicate purchase, repair and insufficient funds have exact state changes', async () => {
  const { game, owner, rec, now } = await setup();
  try {
    game.onShop(owner, rec, 'fence', undefined, now); assert.equal(rec.sap, 1700); assert.equal(rec.defenses.gateHp, 3);
    game.onShop(owner, rec, 'fence', undefined, now); assert.equal(rec.sap, 1700);
    rec.defenses.gateHp = 1; game.onShop(owner, rec, 'repair', undefined, now); assert.equal(rec.sap, 1600); assert.equal(rec.defenses.gateHp, 3);
    rec.sap = 0; game.onShop(owner, rec, 'gnome', undefined, now); assert.equal(rec.sap, 0); assert(!rec.defenses.gnome);
  } finally { await game.store.close(); }
});

for (const change of ['move', 'full', 'cap', 'owner-offline', 'thief-offline'] as const) {
  test(`pending uproot is cancelled when eligibility changes: ${change}`, async () => {
    const { game, thief, rec, attacker, now } = await setup();
    try {
      game.onUproot(thief, attacker, rec.id, 0, now); assert(thief.channel); const end = thief.channel.endsAt;
      if (change === 'move') thief.x += 7;
      if (change === 'full') attacker.plots = attacker.plots.map((_, i) => ({ ...rec.plots[0]!, uid: `occupied-${i}` }));
      if (change === 'cap') rec.stolenLog = Array(STEAL_CAP_PER_HOUR).fill(now);
      if (change === 'owner-offline') game.leave(rec.id);
      if (change === 'thief-offline') game.leave(attacker.id);
      game.completeChannel(thief, attacker, end);
      assert.equal(rec.plots[0]?.uid, 'original'); assert.equal(thief.carry, null); assert(!attacker.carried);
    } finally { await game.store.close(); }
  });
}
test('mythic owner leaving their lot during uproot keeps the plant protected', async () => {
  const { game, owner, thief, rec, attacker, now } = await setup();
  try {
    rec.plots[0]!.tier = 'mythic'; owner.x = thief.x; owner.y = thief.y;
    game.onUproot(thief, attacker, rec.id, 0, now); assert(thief.channel); const end = thief.channel.endsAt;
    const elsewhere = game.lot(attacker).plots[0]; owner.x = elsewhere.tx * TILE + 16; owner.y = elsewhere.ty * TILE + 16;
    game.completeChannel(thief, attacker, end); assert.equal(rec.plots[0]?.uid, 'original'); assert.equal(thief.carry, null);
  } finally { await game.store.close(); }
});
test('gate requires three completed hits and a newly shielded owner cancels damage', async () => {
  const { game, owner, thief, rec, attacker, now } = await setup();
  try {
    game.onShop(owner, rec, 'fence', undefined, now); Object.assign(thief, lotGatePx(game.lot(rec)));
    let clock = now;
    for (let hit = 0; hit < 3; hit++) {
      game.onBreak(thief, attacker, rec.id, clock); assert(thief.channel); clock = thief.channel.endsAt;
      game.completeChannel(thief, attacker, clock - 1); assert.equal(rec.defenses.gateHp, 3 - hit);
      game.completeChannel(thief, attacker, clock); assert.equal(rec.defenses.gateHp, 2 - hit); clock++;
    }
    game.onShop(owner, rec, 'repair', undefined, clock); assert.equal(rec.defenses.gateHp, 3);
    game.onBreak(thief, attacker, rec.id, clock); assert(thief.channel); const end = thief.channel.endsAt;
    owner.shieldUntil = end + 1; game.completeChannel(thief, attacker, end); assert.equal(rec.defenses.gateHp, 3);
  } finally { await game.store.close(); }
});
test('defense purchases charge once and keep private/decoy information private', async () => {
  const { game, owner, rec, now } = await setup();
  try {
    rec.sap = 10000;
    for (const item of ['scarecrow', 'mud', 'bell', 'sprinkler', 'gnome'] as const) {
      const before = rec.sap; game.onShop(owner, rec, item, undefined, now);
      assert.equal(rec.sap, before - SHOP_PRICES[item]); assert(rec.defenses[item]);
      game.onShop(owner, rec, item, undefined, now); assert.equal(rec.sap, before - SHOP_PRICES[item]);
      if (item === 'scarecrow') assert.equal(game.publicDefenses(rec.defenses).gnome, true);
    }
    const visible = game.publicDefenses(rec.defenses);
    assert.equal(visible.bell, undefined); assert.equal(visible.scarecrow, undefined);
  } finally { await game.store.close(); }
});

test('posted bounties accumulate and recovery pays once while returning the exact plant', async () => {
  const { game, owner, thief, rec, attacker, now } = await setup();
  try {
    rec.stolenBy = [{ id: attacker.id, name: attacker.name, at: now }];
    game.onBounty(owner, rec, attacker.id, 100, now); game.onBounty(owner, rec, attacker.id, 150, now + 1);
    assert.equal(rec.sap, 1750); assert.equal(game.bountyOn(attacker, now + 1)?.amount, 250);
    game.onUproot(thief, attacker, rec.id, 0, now); assert(thief.channel); const end = thief.channel.endsAt;
    game.completeChannel(thief, attacker, end); assert(thief.carry);
    const before = rec.sap, expected = before + 250 + tagPayment(thief.carry.plant); game.recover(thief, attacker, rec, end + 1, true);
    assert.equal(rec.sap, expected); assert.equal(game.bountyOn(attacker, end + 1), null);
    assert.equal(rec.plots.filter(p => p?.uid === 'original').length, 1); assert.equal(rec.stats.tags, 1);
    const paid = rec.sap; game.recover(thief, attacker, rec, end + 2, true); assert.equal(rec.sap, paid); assert.equal(rec.stats.tags, 1);
  } finally { await game.store.close(); }
});
for (const wanted of [true, false]) test(`unrelated nearby gardener tags a carrier only with an active bounty: ${wanted}`, async () => {
  const { game, owner, thief, rec, attacker, now } = await setup();
  try {
    const socket = { OPEN: 1, readyState: 1, send() {}, close() {} } as unknown as WebSocket;
    const hunter = game.join(socket, { t: 'hello', id: 'bountyhunter01', secret: 'hunter-secret', name: 'Hunter' })!;
    const hunterRec = game.players.get(hunter.id)!;
    if (wanted) { rec.stolenBy = [{ id: attacker.id, name: attacker.name, at: now }]; game.onBounty(owner, rec, attacker.id, 100, now); }
    game.onUproot(thief, attacker, rec.id, 0, now); assert(thief.channel); const end = thief.channel.endsAt;
    game.completeChannel(thief, attacker, end); assert(thief.carry);
    owner.x = 0; owner.y = 0; hunter.x = thief.x; hunter.y = thief.y; const before = hunterRec.sap, expected = before + 100 + tagPayment(thief.carry.plant);
    game.tick(end + 1);
    if (wanted) { assert.equal(thief.carry, null); assert.equal(hunterRec.sap, expected); assert.equal(rec.plots[0]?.uid, 'original'); assert.equal(hunterRec.stats.tags, 1); }
    else { assert(thief.carry); assert.equal(hunterRec.sap, before); assert.equal(hunterRec.stats.tags, 0); }
  } finally { await game.store.close(); }
});

test('mud and sprinkler apply exact movement modifiers without slowing their owner', async () => {
  const { game, owner, thief, rec, attacker, now } = await setup();
  try {
    rec.defenses.mud = true; rec.defenses.sprinkler = true; owner.x = thief.x; owner.y = thief.y;
    assert.equal(game.speedOf(owner, rec, now), BASE_SPEED);
    assert.equal(game.speedOf(thief, attacker, now), BASE_SPEED * MUD_SPEED);
    thief.carry = { plant: rec.plots[0]!, from: rec.id, fromPlot: 0 };
    assert.equal(game.speedOf(thief, attacker, now), BASE_SPEED * MUD_SPEED * CARRY_SPEED * SPRINKLER_SPEED);
  } finally { await game.store.close(); }
});
for (const sameVillage of [true, false]) test(`gnome tags only within its own village: ${sameVillage}`, async () => {
  const { game, owner, thief, rec, attacker, now } = await setup();
  try {
    game.onUproot(thief, attacker, rec.id, 0, now); assert(thief.channel); const end = thief.channel.endsAt;
    game.completeChannel(thief, attacker, end); assert(thief.carry);
    rec.defenses.gnome = true; owner.x = 0; owner.y = 0;
    Object.assign(thief, game.gnomePos(rec, end + 1));
    if (!sameVillage) {
      const village = structuredClone(game.villages.get(rec.villageId)!); village.id = 'other-test-village'; village.n += 1;
      village.lots = village.lots.map(() => null); village.bounties = [];
      game.villages.set(village.id, village); game.maps.set(village.id, game.homeMap(rec)); attacker.visiting = village.id;
      // Matching coordinates in distinct villages must not trigger an owner tag either.
      owner.x = thief.x; owner.y = thief.y;
    }
    game.tick(end + 1);
    if (sameVillage) { assert.equal(thief.carry, null); assert.equal(rec.plots[0]?.uid, 'original'); assert.equal(rec.stats.tags, 1); }
    else { assert(thief.carry); assert.equal(rec.plots[0], null); assert.equal(rec.stats.tags, 0); }
  } finally { await game.store.close(); }
});
test('purchased bell alerts the absent owner once per entry, never the intruder or owner at home', async () => {
  const { game, owner, thief, rec, now } = await setup();
  const ownerMessages: any[] = [], thiefMessages: any[] = [];
  owner.ws.send = ((raw:string) => ownerMessages.push(JSON.parse(raw))) as any;
  thief.ws.send = ((raw:string) => thiefMessages.push(JSON.parse(raw))) as any;
  try {
    game.onShop(owner, rec, 'bell', undefined, now);
    assert(rec.defenses.bell); owner.x = 0; owner.y = 0;
    const entry = { x:thief.x, y:thief.y };
    const alerts = () => ownerMessages.filter(m => m.t === 'toast' && m.text.includes('Thief'));
    game.tick(now + 1); await game.commit(); assert.equal(alerts().length, 1);
    game.tick(now + 2); await game.commit(); assert.equal(alerts().length, 1);
    assert(!thiefMessages.some(m => m.t === 'toast' && m.text.includes('Thief')));
    thief.x = 0; thief.y = 0; game.tick(now + 3);
    Object.assign(thief, entry); game.tick(now + 4); await game.commit(); assert.equal(alerts().length, 2);
    thief.x = 0; thief.y = 0; game.tick(now + 5);
    Object.assign(owner, entry); Object.assign(thief, entry);
    game.tick(now + 6); await game.commit(); assert.equal(alerts().length, 2);
    assert.equal(game.publicDefenses(rec.defenses).bell, undefined);
  } finally { await game.store.close(); }
});

for (const defense of ['gnome', 'scarecrow'] as const) test(`purchased ${defense} has its intended uproot behavior`, async () => {
  const { game, owner, thief, rec, attacker, now } = await setup();
  try {
    owner.x = 0; owner.y = 0;
    game.onShop(owner, rec, defense, undefined, now); assert(rec.defenses[defense]);
    game.onUproot(thief, attacker, rec.id, 0, now); assert(thief.channel);
    const end = thief.channel.endsAt;
    // Fix patrol proximity without moving the thief out of channel range.
    game.gnomePos = () => ({ x:thief.x, y:thief.y });
    game.tick(end);
    assert.equal(thief.channel, null);
    if (defense === 'gnome') { assert.equal(thief.carry, null); assert.equal(rec.plots[0]?.uid, 'original'); }
    else { assert.equal(thief.carry?.plant.uid, 'original'); assert.equal(rec.plots[0], null); }
  } finally { await game.store.close(); }
});

test('nickname messages affect only the authenticated garden, sanitize text and allow clearing', async () => {
  const { game, owner, thief, rec, attacker, now } = await setup();
  try {
    game.handle(owner, { t: 'nick', plotId: 0, name: 'Captain Sprout' });
    game.handle(thief, { t: 'nick', plotId: 0, name: 'Intruder', ownerId: rec.id } as any);
    assert.equal(rec.plots[0]!.nick, 'Captain Sprout'); assert.equal(attacker.plots[0], null);
    assert.equal(game.publicLot(rec, now).plots[0].nick, 'Captain Sprout');
    game.handle(owner, { t: 'nick', plotId: 0, name: '  <Basil>\u0000 !  ' });
    assert.equal(rec.plots[0]!.nick, 'Basil !');
    game.handle(owner, { t: 'nick', plotId: 0, name: '12345678901234567890' });
    assert.equal(rec.plots[0]!.nick, '12345678901234');
    game.handle(owner, { t: 'nick', plotId: 0, name: '   ' });
    assert.equal(rec.plots[0]!.nick, undefined);
    assert.equal(game.publicLot(rec, now).plots[0].nick, undefined);
  } finally { await game.store.close(); }
});

test('a named plant keeps its identity through theft, new-owner rename and restart', async () => {
  const { game, owner, thief, rec, attacker, now, directory } = await setup();
  try {
    game.handle(owner, { t: 'nick', plotId: 0, name: 'Captain Sprout' });
    game.onUproot(thief, attacker, rec.id, 0, now); assert(thief.channel);
    const end = thief.channel.endsAt; game.completeChannel(thief, attacker, end);
    assert.equal(thief.carry?.plant.nick, 'Captain Sprout');
    game.handle(owner, { t: 'nick', plotId: 0, name: 'Too late' });
    assert.equal(thief.carry?.plant.nick, 'Captain Sprout');
    game.score(thief, attacker, end + 1);
    assert.equal(attacker.plots[0]!.uid, 'original');
    assert.equal(game.publicLot(attacker, end + 1).plots[0].nick, 'Captain Sprout');
    assert(game.feeds.get(attacker.villageId)?.some(e => e.kind === 'steal' && e.text.includes('"Captain Sprout"')));
    game.handle(thief, { t: 'nick', plotId: 0, name: 'Basil Bandit' });
    await game.commit();
  } finally { await game.store.close(); }
  const restart = new Game(directory); await restart.initialize();
  try {
    assert.equal(restart.players.get(rec.id)!.plots[0], null);
    const plant = restart.players.get(attacker.id)!.plots[0]!;
    assert.equal(plant.uid, 'original'); assert.equal(plant.nick, 'Basil Bandit');
  } finally { await restart.store.close(); }
});

test('expired bounty is removed durably and never reappears on restart', async () => {
  const { game, owner, rec, attacker, now, directory } = await setup();
  try {
    rec.stolenBy = [{ id: attacker.id, name: attacker.name, at: now }]; game.onBounty(owner, rec, attacker.id, 100, now);
    const until = game.bountyOn(attacker, now)!.until; await game.commit(); assert(!game.store.dirty);
    assert.equal(game.bountyOn(attacker, until), null); assert(game.store.dirty);
    await game.commit(); assert(!game.store.dirty);
    assert.equal(game.villages.get(attacker.villageId)!.bounties!.length, 0);
  } finally { await game.store.close(); }
  const restart = new Game(directory); await restart.initialize();
  try { assert.equal(restart.villages.get(attacker.villageId)!.bounties!.length, 0); }
  finally { await restart.store.close(); }
});
