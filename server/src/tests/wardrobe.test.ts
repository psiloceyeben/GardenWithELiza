import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Game } from '../game';
import { isClientMsg } from '../validate-message';
async function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'pons-wardrobe-'));
  const game = new Game(directory); await game.initialize(); const messages: any[] = [];
  const l = game.join({ OPEN: 1, readyState: 1, send(raw: string) { messages.push(JSON.parse(raw)); }, close() {} } as any,
    { t: 'hello', id: 'wardrobe123', secret: 'wardrobesecret', name: 'Style tester' })!;
  const rec = game.players.get(l.id)!;
  return { game, l, rec, directory, messages };
}

test('all hairstyles are free, replicated and persistent; malformed and unaffordable combined requests are atomic', async()=>{
  const {game,l,rec,directory,messages}=await setup();
  try {
    rec.sap=0; assert.equal(game.privateState(rec).hair,0);
    for(let hair=0;hair<5;hair++) {
      assert(isClientMsg({t:'wardrobe',hair}));
      await game.handle(l,{t:'wardrobe',hair});
      assert.equal(game.privateState(rec).hair,hair); assert.equal(rec.sap,0);
      assert.equal(game.nameEntry(rec).hair,hair);
    }
    await game.commit();
    assert(messages.some(m=>m.t==='players' && m.names[l.id]?.hair===4));
    assert(messages.some(m=>m.t==='state' && m.you.hair===4));
    const before=JSON.stringify(rec);
    for(const hair of [-1,5,1.5,NaN,Infinity,'2',null,{},[]]) {
      assert(!isClientMsg({t:'wardrobe',skin:2,hair}));
      game.onWardrobe(l,rec,undefined,undefined,2,hair as number);
      assert.equal(JSON.stringify(rec),before);
    }
    game.onWardrobe(l,rec,(rec.color+1)%6,1,2,1);
    assert.equal(JSON.stringify(rec),before);
  } finally {await game.store.close();}
  const reopened=new Game(directory);await reopened.initialize();
  try {assert.equal(reopened.privateState(reopened.players.get(l.id)!).hair,4);}
  finally {await reopened.store.close();}
});
test('combined wardrobe request is all-or-nothing when the complete outfit is unaffordable', async () => {
  const { game, l, rec } = await setup();
  try {
    rec.sap = 100; game.store.touch(); const before = JSON.stringify(rec);
    game.onWardrobe(l, rec, (rec.color + 1) % 6, 1);
    assert.equal(JSON.stringify(rec), before);
  } finally { await game.store.close(); }
});
test('outfit charges once, privately reports ownership and survives restart with free hat re-equipping', async () => {
  const { game, l, rec, directory, messages } = await setup();
  try {
    rec.sap = 1000; game.store.touch(); const color = (rec.color + 1) % 6;
    game.onWardrobe(l, rec, color, 1); assert.equal(rec.sap, 750);
    game.onWardrobe(l, rec, color, 1); assert.equal(rec.sap, 750);
    game.onWardrobe(l, rec, undefined, 0); assert.equal(rec.sap, 750);
    game.onWardrobe(l, rec, undefined, 1); assert.equal(rec.sap, 750);
    await game.commit();
    assert(messages.some(m => m.t === 'state' && m.you.hats?.includes(1)));
    assert(game.privateState(rec).hats?.includes(1));
  } finally { await game.store.close(); }
  const restart = new Game(directory); await restart.initialize();
  try { const rec = restart.players.get('wardrobe123')!; assert.equal(rec.sap, 750); assert.equal(rec.hat, 1); assert.deepEqual(rec.hats, [0, 1]); }
  finally { await restart.store.close(); }
});
test('invalid combined choice cannot partially charge the shirt', async () => {
  const { game, l, rec } = await setup();
  try {
    rec.sap = 1000; const before = JSON.stringify(rec);
    game.onWardrobe(l, rec, (rec.color + 1) % 6, 999);
    assert.equal(JSON.stringify(rec), before);
  } finally { await game.store.close(); }
});

test('skin choices are free, validated, broadcast and persisted without partial outfit updates',async()=>{
  const {game,l,rec,directory,messages}=await setup();
  try{
    rec.sap=0;assert.equal(game.privateState(rec).skin,0);
    await game.handle(l,{t:'wardrobe',skin:5});
    await game.commit();
    assert.equal(rec.skin,5);assert.equal(rec.sap,0);assert.equal(game.nameEntry(rec).skin,5);
    assert(messages.some(m=>m.t==='players' && m.names[l.id]?.skin===5));
    assert(messages.some(m=>m.t==='state' && m.you.skin===5));
    for(const skin of [-1,6,1.5,NaN]){
      await game.handle(l,{t:'wardrobe',skin});assert.equal(rec.skin,5);
      game.onWardrobe(l,rec,undefined,undefined,skin);assert.equal(rec.skin,5);
    }
    game.onWardrobe(l,rec,(rec.color+1)%6,undefined,2);
    assert.equal(rec.skin,5,'Unaffordable combined request must not change the free choice either');
  }finally{await game.store.close();}
  const reopened=new Game(directory);await reopened.initialize();
  try{assert.equal(reopened.privateState(reopened.players.get(l.id)!).skin,5);}
  finally{await reopened.store.close();}
});
