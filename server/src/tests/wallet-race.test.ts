import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { WebSocket } from 'ws';
import { Game } from '../game';
import { signForTest } from '../sig';
import { signMessage } from '../../../shared/chain';
import { MockReader } from '../../../chain-reader/src';
import type { ChainSnapshot } from '../../../shared/derive/types';
const key = '4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318';
const address = signForTest('test', key).address;
function socket(messages: any[] = []) { return { OPEN: 1, readyState: 1, send(data: string) { messages.push(JSON.parse(data)); }, close() {} } as unknown as WebSocket; }
async function setup() {
  const game = new Game(mkdtempSync(join(tmpdir(), 'pons-wallet-race-'))); await game.initialize();
  const pending: ((snapshot: ChainSnapshot) => void)[] = [];
  game.reader = { kind: 'delayed-test', snapshot: () => new Promise(resolve => pending.push(resolve)) };
  const messages: any[] = [];
  const live = game.join(socket(messages), { t: 'hello', id: 'testdevice0001', secret: 'testsecret0001', name: 'Tester' })!;
  const snapshot = await new MockReader().snapshot(address);
  return { game, live, pending, snapshot, messages };
}
function signedLink(game: Game, live: NonNullable<ReturnType<Game['join']>>) {
  const now = Date.now(); game.onNonce(live, address, now); const n = live.nonce!;
  const signed = signForTest(signMessage(address, n.value, n.issuedAt), key);
  return game.onLink(live, game.players.get(live.id)!, address, signed.signature, now);
}
test('unlink invalidates an already signed pending chain read', async () => {
  const { game, live, pending, snapshot } = await setup();
  try {
    const linking = signedLink(game, live); game.handle(live, { t: 'unlink' }); pending[0](snapshot); await linking;
    assert.equal(game.players.get(live.id)!.address, null);
  } finally { await game.store.close(); }
});
test('reconnect with the same player ID rejects the old connection completion and messages', async () => {
  const { game, live, pending, snapshot } = await setup();
  try {
    const linking = signedLink(game, live);
    const rec = game.players.get(live.id)!;
    const fresh = game.join(socket(), { t: 'hello', id: rec.id, secret: rec.secret, name: rec.name })!;
    assert.notEqual(fresh, live); pending[0](snapshot); await linking;
    assert(!rec.address);
    game.handle(live, { t: 'rename', name: 'Stale message' }); assert.notEqual(rec.name, 'Stale message');
  } finally { await game.store.close(); }
});
test('new nonce supersedes a pending signed attempt', async () => {
  const { game, live, pending, snapshot } = await setup();
  try {
    const linking = signedLink(game, live); game.onNonce(live, address, Date.now()); pending[0](snapshot); await linking;
    assert(!game.players.get(live.id)!.address); assert(live.nonce);
  } finally { await game.store.close(); }
});
test('simultaneous signed claims converge on one wallet-owned player', async () => {
  const { game, live, pending, snapshot } = await setup();
  try {
    const second = game.join(socket(), { t: 'hello', id: 'testdevice0002', secret: 'testsecret0002', name: 'Second' })!;
    const firstLink = signedLink(game, live), secondLink = signedLink(game, second);
    pending[0](snapshot); await firstLink; pending[1](snapshot); await secondLink;
    assert.equal([...game.players.values()].filter(p => p.address === address).length, 1);
    assert(!game.players.get(second.id)!.address);
  } finally { await game.store.close(); }
});
test('nonce is consumed once and invalid signatures never invoke chain reads', async () => {
  const { game, live, pending, snapshot } = await setup();
  try {
    const linking = signedLink(game, live);
    await game.onLink(live, game.players.get(live.id)!, address, 'invalid', Date.now()); assert.equal(pending.length, 1);
    pending[0](snapshot); await linking; assert.equal(game.players.get(live.id)!.address, address);
    game.onNonce(live, address, Date.now());
    await game.onLink(live, game.players.get(live.id)!, address, 'invalid', Date.now()); assert.equal(pending.length, 1);
  } finally { await game.store.close(); }
});

test('failed signed chain refresh preserves the saved garden, hides provider details and permits retry', async () => {
  const {game,live,pending,snapshot,messages}=await setup();
  try {
    const guest=game.players.get(live.id)!;guest.sap=1000;
    game.onBuy(live,guest,0);assert.equal(guest.seeds.length,1);assert(guest.sap<1000);
    const first=signedLink(game,live);pending[0](snapshot);await first;await game.commit();
    const rec=game.players.get(live.id)!,before=structuredClone(rec);
    let calls=0;
    game.reader={kind:'failure-test',async snapshot(){calls++;throw new Error('https://provider.invalid/private-rpc-key');}};
    messages.length=0;
    await signedLink(game,live);await game.commit();
    assert.deepEqual(rec,before);assert.equal(game.live.get(rec.id),live);assert.equal(live.nonce,null);
    assert.equal(calls,1);assert(messages.some(m=>m.t==='toast'));
    assert(!messages.some(m=>m.t==='linked' || m.t==='identity'));
    assert(!JSON.stringify(messages).includes('private-rpc-key'));
    await game.onLink(live,rec,address,'replayed',Date.now());assert.equal(calls,1);
    game.reader={kind:'recovered-test',async snapshot(){calls++;return snapshot;}};
    messages.length=0;await signedLink(game,live);await game.commit();
    assert.equal(calls,2);assert(messages.some(m=>m.t==='linked' && m.address===address));
    assert.equal(rec.sap,before.sap);assert.deepEqual(rec.plots,before.plots);assert.deepEqual(rec.seeds,before.seeds);
  } finally { await game.store.close(); }
});

test('a stale provider failure cannot interrupt the newer signed attempt', async () => {
  const {game,live,pending,snapshot,messages}=await setup();
  try {
    let rejectOld!: (error: Error)=>void;
    game.reader={kind:'old-failure-test',snapshot:()=>new Promise((_resolve,reject)=>{rejectOld=reject;})};
    const old=signedLink(game,live);
    game.reader={kind:'new-pending-test',snapshot:()=>new Promise(resolve=>pending.push(resolve))};
    const fresh=signedLink(game,live);await game.commit();messages.length=0;
    rejectOld(new Error('private-provider-detail'));await old;await game.commit();
    assert.equal(messages.length,0);assert.equal(game.live.get(live.id),live);
    pending[0](snapshot);await fresh;await game.commit();
    assert.equal(game.players.get(live.id)!.address,address);
    assert(messages.some(m=>m.t==='linked' && m.address===address));
  } finally { await game.store.close(); }
});
