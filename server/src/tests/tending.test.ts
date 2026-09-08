import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {WebSocket} from 'ws';
import {Game} from '../game';

async function setup(){
  const directory=await mkdtemp(join(tmpdir(),'pons-tending-test-')),game=new Game(directory);await game.initialize();
  const ws={OPEN:1,readyState:1,send(){},close(){}} as unknown as WebSocket;
  const live=game.join(ws,{t:'hello',id:'tendingplayer001',secret:'tending-secret',name:'Gardener'})!;
  const rec=game.players.get(live.id)!,plot=game.lot(rec).plots[0];
  live.x=plot.tx*32+16;live.y=plot.ty*32+16;
  rec.seeds=[{uid:'tend-seed',speciesId:'gorbulon_sprig',tier:'common'}];
  return {directory,game,live,rec};
}
for(const reason of ['distance','village','invalid-index'] as const)test('planting and tending reject '+reason+' without mutation',async()=>{
  const {game,live,rec}=await setup();
  try{
    if(reason==='distance')live.x+=40.01;
    if(reason==='village')rec.visiting='other-village';
    const plotId=reason==='invalid-index'?-1:0;
    const seeds=JSON.stringify(rec.seeds);
    game.onPlant(live,rec,'tend-seed',plotId,Date.now());
    assert.equal(JSON.stringify(rec.seeds),seeds);assert.equal(rec.plots[0],null);
    for(const revealed of [false,true]){
      rec.plots[0]={uid:'p-test',speciesId:'gorbulon_sprig',tier:'common',plantedAt:Date.now(),growMs:30000,revealed,size:1,mutation:'none',watered:false,lastWeeded:0};
      const before=JSON.stringify(rec.plots),sap=rec.sap;
      game.onTend(live,rec,plotId,Date.now());
      assert.equal(JSON.stringify(rec.plots),before);assert.equal(rec.sap,sap);
    }
  }finally{await game.store.close();}
});
test('reachable planting, watering and tending are single-use within their cooldown and persist',async()=>{
  const {directory,game,live,rec}=await setup();let timestamp=0,sap=0;
  try{
    live.x+=40; // inclusive server boundary
    await game.handle(live,{t:'plant',seedUid:'tend-seed',plotId:0});
    const plant=rec.plots[0]!;assert(plant);assert.equal(rec.seeds.length,0);
    await game.handle(live,{t:'plant',seedUid:'tend-seed',plotId:0});assert.equal(rec.plots[0],plant);
    await game.handle(live,{t:'tend',plotId:0});assert(plant.watered);assert(plant.growMs<30000);
    const watered=plant.growMs;await game.handle(live,{t:'tend',plotId:0});assert.equal(plant.growMs,watered);
    plant.revealed=true;plant.lastWeeded=0;
    const before=rec.sap;
    await game.handle(live,{t:'tend',plotId:0});
    timestamp=plant.lastWeeded;sap=rec.sap;
    assert(timestamp>0);assert.equal(sap-before,30);
    await game.handle(live,{t:'tend',plotId:0});assert.equal(rec.sap,sap);assert.equal(plant.lastWeeded,timestamp);
  }finally{await game.store.close();}
  const reopened=new Game(directory);await reopened.initialize();
  try{const saved=reopened.players.get(live.id)!;assert.equal(saved.sap,sap);assert.equal(saved.plots[0]!.lastWeeded,timestamp);assert(saved.plots[0]!.watered);}
  finally{await reopened.store.close();}
});
