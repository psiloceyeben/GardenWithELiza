import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {WebSocket} from 'ws';
import {Game} from '../game';
import {MISSIONS,MISSION_MAX_ACTIVE} from '../../../shared/missions';
const socket=()=>({OPEN:1,readyState:1,send(){},close(){}} as unknown as WebSocket);
const hello={t:'hello' as const,id:'missionplayer001',secret:'mission-secret',name:'Quest QA'};
async function setup(directory=undefined as string|undefined){
  directory??=await mkdtemp(join(tmpdir(),'pons-mission-test-'));
  const game=new Game(directory);await game.initialize();
  const live=game.join(socket(),hello)!,rec=game.players.get(live.id)!;
  const near=(npc:string)=>{const n=game.map(rec).npcs.find(n=>n.id===npc)!;live.x=n.tx*32+16;live.y=n.ty*32+16;};
  return {game,directory,live,rec,near};
}
test('every mission caps progress, rejects early/repeated claims and persists daily completion',async()=>{
  const {game,directory,live,rec,near}=await setup(),now=Date.UTC(2026,8,8,12),initial=rec.sap;
  try{
    for(const mission of MISSIONS){
      near(mission.npc);const before=rec.sap;
      game.onMission(live,rec,mission.id,'claim',now);assert.equal(rec.sap,before);
      game.onMission(live,rec,mission.id,'accept',now);
      game.progress(rec,mission.kind,mission.target-1);
      game.onMission(live,rec,mission.id,'claim',now);assert.equal(rec.sap,before);
      game.progress(rec,mission.kind,100);assert.equal(rec.missions!.active[mission.id],mission.target);
      game.onMission(live,rec,mission.id,'accept',now);assert.equal(rec.missions!.active[mission.id],mission.target);
      game.onMission(live,rec,mission.id,'claim',now);game.onMission(live,rec,mission.id,'claim',now);
      assert.equal(rec.sap,before+mission.reward);assert(!(mission.id in rec.missions!.active));
      game.onMission(live,rec,mission.id,'accept',now);assert(!(mission.id in rec.missions!.active));
    }
    assert.equal(rec.sap,initial+MISSIONS.reduce((n,m)=>n+m.reward,0));
  }finally{await game.store.close();}
  const reopened=await setup(directory);
  try{
    const {game:g,live:l,rec:r,near:n}=reopened,balance=r.sap;
    for(const m of MISSIONS){n(m.npc);g.onMission(l,r,m.id,'accept',now);g.onMission(l,r,m.id,'claim',now);assert(!(m.id in r.missions!.active));}
    assert.equal(r.sap,balance);
    const m=MISSIONS[0];n(m.npc);g.onMission(l,r,m.id,'accept',now+86400000);assert.equal(r.missions!.active[m.id],0);
  }finally{await reopened.game.store.close();}
});
test('mission acceptance enforces NPC range and active limit',async()=>{
  const {game,live,rec,near}=await setup(),now=Date.now();
  try{
    live.x=0;live.y=0;game.onMission(live,rec,MISSIONS[0].id,'accept',now);
    assert.equal(Object.keys(game.missionsOf(rec).active).length,0);
    for(const m of MISSIONS.slice(0,MISSION_MAX_ACTIVE+1)){near(m.npc);game.onMission(live,rec,m.id,'accept',now);}
    assert.equal(Object.keys(rec.missions!.active).length,MISSION_MAX_ACTIVE);
    assert(!(MISSIONS[MISSION_MAX_ACTIVE].id in rec.missions!.active));
  }finally{await game.store.close();}
});
