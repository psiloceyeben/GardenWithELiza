import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isClientMsg } from '../validate-message';
import { Game } from '../game';

const address = `0x${'a'.repeat(40)}`;
const valid = [
  { t: 'hello', id: 'player123', secret: 'secret123', name: 'Gardener' },
  { t: 'input', dx: 0, dy: 1, x: 300, y: 400, d: 'down', f: false, m: true },
  { t: 'buy', slot: 0 }, { t: 'plant', seedUid: 's_123', plotId: 0 }, { t: 'tend', plotId: 19 },
  { t: 'shop', item: 'lock', plotId: 2 }, { t: 'uproot', ownerId: 'other123', plotId: 1 },
  { t: 'break', ownerId: 'other123' }, { t: 'chat', text: 'Hello' }, { t: 'emote', e: 0 },
  { t: 'rename', name: 'Gardener' }, { t: 'nonce', address }, { t: 'link', address, signature: `0x${'a'.repeat(130)}` },
  { t: 'forage', id: 'wild123' }, { t: 'bounty', thiefId: 'other123', amount: 50 },
  { t: 'visit', village: 'village123' }, { t: 'cosmetic', item: 'lantern' },
  { t: 'wardrobe', hat: 1, shirt: 3 }, { t: 'nick', plotId: 0, name: 'Sprout' },
  { t: 'talk', npc: 'pell' }, { t: 'mission', id: 'mission1', action: 'accept' },
  { t: 'ask', npc: 'pell', text: 'What is a fence?' }, { t: 'ping', n: 123 },
  ...['cancel', 'unlink', 'sprint', 'home', 'villages'].map(t => ({ t })),
];
test('every current message variant accepts representative valid intent', () => {
  for (const m of valid) assert.equal(isClientMsg(m), true, m.t);
});
test('structured or non-finite values cannot replace scalar fields', () => {
  for (const m of valid) for (const key of Object.keys(m)) {
    for (const value of [null, {}, [], NaN, Infinity, -Infinity]) {
      assert.equal(isClientMsg({ ...m, [key]: value }), false, `${m.t}.${key}: ${String(value)}`);
    }
  }
});
const hostile = [null, [], 1, 'hello', {}, { t: 'unknown' },
  ...['__proto__', 'constructor', 'toString', '-1', 0.5, -1, 1e100].map(slot => ({ t: 'buy', slot })),
  ...['__proto__', 'constructor', 'toString'].map(item => ({ t: 'cosmetic', item })),
  { t: 'shop', item: 'lock' }, { t: 'tend', plotId: 20 }, { t: 'tend', plotId: -1 },
  { t: 'bounty', thiefId: 'someone', amount: -100 }, { t: 'wardrobe', hat: 100 },
  { t: 'mission', id: 'mission1', action: 'anything' },
  { t: 'hello', id: {}, secret: 'secret123', name: 'Gardener' },
];
test('hostile indices, enum values and message shapes are rejected', () => {
  for (const m of hostile) assert.equal(isClientMsg(m), false, JSON.stringify(m));
});
test('invalid intents leave live and persisted player state unchanged', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'pons-protocol-'));
  const game = new Game(directory); await game.initialize();
  const ws = { readyState: 1, send() {}, close() {} } as any;
  try {
    const l = game.join(ws, valid[0] as any)!; assert(l);
    const rec = game.players.get(l.id)!;
    await game.commit();
    const before = JSON.stringify(rec);
    for (const message of hostile) await game.handle(l, message as any);
    game.onBuy(l, rec, '__proto__' as any);
    game.onCosmetic(l, rec, 'constructor' as any);
    assert.equal(JSON.stringify(rec), before);
    assert(Number.isFinite(rec.sap));
    await game.commit();
  } finally { await game.store.close(); }
  const restart = new Game(directory); await restart.initialize();
  try { assert(Number.isFinite(restart.players.get('player123')!.sap)); }
  finally { await restart.store.close(); }
});
