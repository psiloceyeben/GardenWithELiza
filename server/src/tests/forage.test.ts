import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {WebSocket} from 'ws';
import {Game} from '../game';

async function setup(){
  const directory=await mkdtemp(join(tmpdir(),'pons-forage-test-')),game=new Game(directory);await game.initialize();
  const socket=()=>({OPEN:1,readyState:1,send(){},close(){}} as unknown as WebSocket);
  const a=game.join(socket(),{t:'hello',id:'forageplayer001',secret:'forage-secret-a',name:'Forager A'})!;
  const b=game.join(socket(),{t:'hello',id:'forageplayer002',secret:'forage-secret-b',name:'Forager B'})!;
  const ar=game.players.get(a.id)!,br=game.players.get(b.id)!;
  a.x=b.x=200;a.y=b.y=200;
  const wild={id:'wild-fixture',x:200,y:200,speciesId:'husk_holdings',tier:'common' as const,until:Date.now()+60000};
  game.life.wild.set(ar.villageId,[wild]);return {game,directory,a,b,ar,br,wild};
}
test('competing forage intents and replay award exactly one persisted seed',async()=>{
  const {game,directory,a,b,ar,br,wild}=await setup();
  try{
    await Promise.all([game.handle(a,{t:'forage',id:wild.id}),game.handle(b,{t:'forage',id:wild.id})]);
    game.handle(a,{t:'forage',id:wild.id});game.handle(b,{t:'forage',id:wild.id});
    assert.equal(ar.seeds.length+br.seeds.length,1);
    assert.equal(ar.seeds[0].speciesId,wild.speciesId);assert.equal(ar.seeds[0].tier,wild.tier);
    assert.equal(game.life.wild.get(ar.villageId)!.length,0);
  }finally{await game.store.close();}
  const reopened=new Game(directory);await reopened.initialize();
  try{assert.equal(reopened.players.get(a.id)!.seeds.length+reopened.players.get(b.id)!.seeds.length,1);}
  finally{await reopened.store.close();}
});
for(const reason of ['expired','out-of-range','inventory-full','other-village'] as const)test('forage rejects '+reason+' without consuming plant or granting a seed',async()=>{
  const {game,a,ar,wild}=await setup();
  try{
    if(reason==='expired')wild.until=1000;
    if(reason==='out-of-range')a.x=245;
    if(reason==='inventory-full')ar.seeds=Array.from({length:40},(_,i)=>({uid:'seed-'+i,speciesId:wild.speciesId,tier:wild.tier}));
    if(reason==='other-village')ar.visiting='unrelated-village';
    const before=JSON.stringify(ar.seeds);
    if(reason==='expired')game.life.forage(a,ar,wild.id,1000);
    else game.handle(a,{t:'forage',id:wild.id});
    assert.equal(JSON.stringify(ar.seeds),before);assert.equal(game.life.wild.get(ar.villageId)![0].id,wild.id);
  }finally{await game.store.close();}
});
