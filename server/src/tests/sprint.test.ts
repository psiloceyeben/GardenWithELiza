import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {WebSocket} from 'ws';
import {Game} from '../game';
import {SPRINT_REWARD,SPRINT_RECORD_BONUS,SPRINT_COOLDOWN_MS} from '../../../shared/protocol';
const socket=()=>({OPEN:1,readyState:1,send(){},close(){}} as unknown as WebSocket);
const hello={t:'hello' as const,id:'sprintplayer001',secret:'sprint-secret',name:'Runner'};
async function setup(){
  const directory=await mkdtemp(join(tmpdir(),'pons-sprint-test-')),game=new Game(directory);await game.initialize();
  const live=game.join(socket(),hello)!,rec=game.players.get(live.id)!,v=game.map(rec);
  const track={x:v.track.tx*32+32,y:v.track.ty*32+16},f=v.props.find(p=>p.kind==='fountain')!;
  const fountain={x:f.tx*32+32,y:f.ty*32+32};Object.assign(live,track);
  return {game,directory,live,rec,track,fountain,now:Date.now()};
}
test('sprint requires fountain turn, rewards once and keeps cooldown across restart',async()=>{
  const {game,directory,live,rec,track,fountain,now}=await setup();const initial=rec.sap;
  try{
    game.life.sprintStart(live,rec,now);game.life.tick(now+1000);assert.equal(rec.sap,initial);
    Object.assign(live,fountain);game.life.tick(now+2000);
    Object.assign(live,track);game.life.tick(now+5000);game.life.tick(now+5001);
    assert.equal(rec.sap,initial+SPRINT_REWARD+SPRINT_RECORD_BONUS);assert.equal(rec.lastSprintAt,now+5000);
    assert.equal(game.villages.get(rec.villageId)!.sprint!.length,1);
  }finally{await game.store.close();}
  const reopened=new Game(directory);await reopened.initialize();
  try{
    const l=reopened.join(socket(),hello)!,r=reopened.players.get(l.id)!;Object.assign(l,track);
    reopened.life.sprintStart(l,r,now+6000);assert(!reopened.life.sprints.has(l.id));
    reopened.life.sprintStart(l,r,now+5000+SPRINT_COOLDOWN_MS);assert(reopened.life.sprints.has(l.id));
  }finally{await reopened.store.close();}
});
for(const reason of ['connection','village','timeout','carry'] as const)test('sprint cancels without reward after '+reason+' change',async()=>{
  const {game,live,rec,now}=await setup();const initial=rec.sap;
  try{
    game.life.sprintStart(live,rec,now);assert(game.life.sprints.has(live.id));
    if(reason==='connection')game.join(socket(),hello);
    if(reason==='village')rec.visiting='another-village';
    if(reason==='carry')live.carry={} as typeof live.carry;
    game.life.tick(now+(reason==='timeout'?30001:1000));
    assert(!game.life.sprints.has(live.id));assert.equal(rec.sap,initial);assert.equal(rec.lastSprintAt,undefined);
    live.carry=null;
  }finally{await game.store.close();}
});
