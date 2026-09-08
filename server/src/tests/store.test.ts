import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { Client } from 'pg';
import { Store } from '../store';
import { FilePersistence, PostgresPersistence, type Persistence, type Snapshot, type LedgerEntry } from '../persistence';
import { Game } from '../game';
import type { Plant } from '../../../shared/types';
import type { WebSocket } from 'ws';

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pons-store-test-'));
let checks=0;
function pass(name:string):void {checks++;console.log('PASS: '+name);}

async function fileChecks():Promise<void> {
  const dir=temp();
  fs.writeFileSync(path.join(dir,'players.json'),JSON.stringify({alice:{sap:20}}));
  fs.writeFileSync(path.join(dir,'villages.json'),JSON.stringify({v1:{lots:['alice']}}));
  fs.writeFileSync(path.join(dir,'ledger.log'),'1000\talice\t20\tinitial\n');
  const players=new Map<string,{sap:number}>(),villages=new Map<string,{lots:string[]}>();
  const store=new Store(dir,players,villages,new FilePersistence(dir));await store.load();
  assert.equal(players.get('alice')!.sap,20);assert.equal(villages.get('v1')!.lots[0],'alice');
  assert.ok(fs.existsSync(path.join(dir,'players.json')));pass('legacy migration preserves source files');
  players.get('alice')!.sap=15;store.ledger('alice',-5,'buy');await store.flush();
  const data=JSON.parse(fs.readFileSync(path.join(dir,'snapshot.json'),'utf8'));
  assert.equal(data.players.alice.sap,15);assert.equal(data.ledger.length,2);pass('player, village and ledger use one file generation');
  await store.close();
  const reloaded=new Store(dir,new Map(),new Map(),new FilePersistence(dir));await reloaded.load();
  assert.deepEqual(reloaded.players.get('alice'),{sap:15});await reloaded.close();pass('file restart restores committed data');
}

async function raceChecks():Promise<void> {
  let release: (()=>void)|null=null;
  const saved:Snapshot[]=[];
  const backend:Persistence={kind:'test',load:async()=>({players:{},villages:{}}),save:async(s)=>{
    saved.push(s);await new Promise<void>(r=>{release=r;});
  },close:async()=>{}};
  const players=new Map([['alice',{sap:10}]]),store=new Store(temp(),players,new Map(),backend);
  store.touch();store.ledger('alice',10,'initial');
  const first=store.flush();
  players.get('alice')!.sap=11;store.ledger('alice',1,'tick');
  release!();await first;
  assert.equal((saved[0].players.alice as {sap:number}).sap,10);assert.equal(store.dirty,true);
  const second=store.flush();release!();await second;
  assert.equal((saved[1].players.alice as {sap:number}).sap,11);assert.equal(store.dirty,false);
  await store.close();pass('writes during an in-flight save remain pending and snapshots are immutable');
}

async function gameChecks():Promise<void> {
  const dir=temp(),game=new Game(dir);await game.initialize();
  const now=Date.now();
  const owner=game.newPlayer('owner','secret','Owner',null,now);
  const thief=game.newPlayer('thief','secret','Thief',null,now);
  const plant:Plant={uid:'recover-me',speciesId:'gorbulon_sprig',tier:'common',plantedAt:now-60000,growMs:30000,revealed:true,size:1.2,mutation:'golden',watered:false,lastWeeded:now};
  thief.carried={plant,from:owner.id,fromPlot:0};game.store.touch();
  await game.store.close(); // committed in-flight raid, as a crash would leave it
  const restart=new Game(dir);await restart.initialize();
  assert.deepEqual(restart.players.get('owner')!.plots[0],plant);assert.equal(restart.players.get('thief')!.carried,null);
  await restart.store.close();
  const again=new Game(dir);await again.initialize();
  assert.equal(again.players.get('owner')!.plots.filter(p=>p?.uid===plant.uid).length,1);
  pass('restart returns an in-flight plant exactly once, preserving mutation and size');
  const sent:string[]=[];
  const ws={OPEN:1,readyState:1,send:(data:string)=>sent.push(data)} as unknown as WebSocket;
  const rec=again.players.get('owner')!;
  again.addSap(rec,5,'test-credit');again.send(ws,{t:'state',you:{sap:rec.sap}});
  assert.equal(sent.length,0);
  await again.commit();
  assert.equal(sent.length,1);
  const disk=JSON.parse(fs.readFileSync(path.join(dir,'snapshot.json'),'utf8'));
  assert.equal(JSON.parse(sent[0]).you.sap,disk.players.owner.sap);
  await again.store.close();pass('client state is emitted only after the matching save commits');
  const paid=new Game(temp());await paid.initialize();
  const liveSocket={OPEN:1,readyState:1,send:()=>{},close:()=>{}} as unknown as WebSocket;
  const live=paid.join(liveSocket,{t:'hello',id:'paidthroughtest',secret:'testsecret',name:'Paid Through'})!;
  const earning=paid.players.get(live.id)!;earning.plots[0]={...plant,mutation:'none'};
  const paidThrough=Date.now()+1000;paid.economy(paidThrough);await paid.commit();
  assert.equal(earning.lastSeen,paidThrough);
  await paid.store.close();pass('online accrual commits its paid-through timestamp');
}

async function postgresChecks(url:string):Promise<void> {
  const admin=new Client({connectionString:url});await admin.connect();
  const name='pons_storage_test_'+randomUUID().replace(/-/g,'');
  await admin.query('CREATE DATABASE '+name);
  const dbUrl=new URL(url);dbUrl.pathname='/'+name;
  const connection=dbUrl.toString(),inspector=new Client({connectionString:connection});await inspector.connect();
  const dir=temp(),players=new Map<string,{sap:number}>(),villages=new Map<string,{lots:string[]}>();
  const backend=new PostgresPersistence(connection),store=new Store(dir,players,villages,backend);
  await store.load();players.set('alice',{sap:25});villages.set('v1',{lots:['alice']});store.ledger('alice',25,'initial');await store.flush();
  assert.equal((await inspector.query('SELECT data FROM pons.players')).rows[0].data.sap,25);
  assert.equal((await inspector.query('SELECT count(*) FROM pons.ledger')).rows[0].count,'1');pass('PostgreSQL commits player, village and ledger data');
  await assert.rejects(new PostgresPersistence(connection).load(),/Another Pons Garden writer/);pass('a second authoritative writer is refused');
  await inspector.query(`CREATE FUNCTION pons.fail_test_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test write failure'; END $$;
    CREATE TRIGGER fail_test BEFORE UPDATE ON pons.villages FOR EACH STATEMENT EXECUTE FUNCTION pons.fail_test_write();`);
  players.get('alice')!.sap=20;villages.get('v1')!.lots.push('bob');store.ledger('alice',-5,'buy');
  await assert.rejects(store.flush(),/test write failure/);
  assert.equal(store.failed,true);assert.equal(store.dirty,true);
  assert.equal((await inspector.query('SELECT data FROM pons.players')).rows[0].data.sap,25);
  assert.equal((await inspector.query('SELECT count(*) FROM pons.ledger')).rows[0].count,'1');
  pass('failure midway through save rolls back both state and ledger');
  await inspector.query('DROP TRIGGER fail_test ON pons.villages');
  await store.flush();assert.equal(store.failed,false);
  assert.equal((await inspector.query('SELECT count(*) FROM pons.ledger')).rows[0].count,'2');
  pass('retry retains the failed ledger batch exactly once');
  await assert.rejects(inspector.query('UPDATE pons.ledger SET delta=0'),/append-only/);
  await assert.rejects(inspector.query('DELETE FROM pons.ledger'),/append-only/);
  await assert.rejects(inspector.query('TRUNCATE pons.ledger'),/append-only/);
  pass('database rejects ledger update, delete and truncate');
  await store.close();
  const restart=new Store(dir,new Map(),new Map(),new PostgresPersistence(connection));await restart.load();
  assert.deepEqual(restart.players.get('alice'),{sap:20});assert.deepEqual(restart.villages.get('v1'),{lots:['alice','bob']});
  await restart.close();pass('PostgreSQL restart reloads the last committed generation');
  const role='pons_runtime_'+randomUUID().replace(/-/g,'');
  await admin.query('CREATE ROLE '+role+' LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS');
  await inspector.query(`GRANT CONNECT ON DATABASE ${name} TO ${role};
    GRANT USAGE ON SCHEMA pons TO ${role};
    GRANT SELECT, INSERT, UPDATE, DELETE ON pons.players, pons.villages TO ${role};
    GRANT SELECT, INSERT ON pons.meta, pons.ledger TO ${role};`);
  const restrictedUrl=new URL(connection);restrictedUrl.username=role;restrictedUrl.password='';
  const runtime=new PostgresPersistence(restrictedUrl.toString(),'runtime');
  const loaded=(await runtime.load())!;assert.deepEqual(loaded.players.alice,{sap:20});
  loaded.players.alice={sap:19};
  await runtime.save(loaded,[{id:'least-privilege-entry',at:1000,playerId:'alice',delta:-1,reason:'test'}]);
  const stalled={...loaded,players:{...loaded.players,alice:{sap:18}}};
  const stalledEntry={id:'lock-retry-entry',at:1001,playerId:'alice',delta:-1,reason:'test-lock-retry'};
  await inspector.query('BEGIN');await inspector.query('LOCK TABLE pons.villages IN ACCESS EXCLUSIVE MODE');
  const blockedAt=Date.now();
  try { await assert.rejects(runtime.save(stalled,[stalledEntry]),(error:any)=>error.code==='55P03'); }
  finally { await inspector.query('ROLLBACK'); }
  assert(Date.now()-blockedAt<12000,'Lock timeout did not beat driver deadline');
  assert.equal((await inspector.query("SELECT data->>'sap' AS sap FROM pons.players WHERE id='alice'")).rows[0].sap,'19');
  assert.equal((await inspector.query("SELECT count(*) FROM pons.ledger WHERE id='lock-retry-entry'")).rows[0].count,'0');
  await inspector.query(`CREATE FUNCTION pons.slow_test_write() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN PERFORM pg_sleep(20); RETURN NEW; END $$;
    CREATE TRIGGER slow_test BEFORE INSERT ON pons.players FOR EACH ROW EXECUTE FUNCTION pons.slow_test_write();`);
  try { await assert.rejects(runtime.save(stalled,[stalledEntry]),(error:any)=>error.code==='57014'); }
  finally { await inspector.query('DROP TRIGGER slow_test ON pons.players'); }
  assert.equal((await inspector.query("SELECT data->>'sap' AS sap FROM pons.players WHERE id='alice'")).rows[0].sap,'19');
  await runtime.save(stalled,[stalledEntry]);await runtime.save(stalled,[stalledEntry]);
  assert.equal((await inspector.query("SELECT count(*) FROM pons.ledger WHERE id='lock-retry-entry'")).rows[0].count,'1');
  pass('server-side lock and statement timeouts roll back without partial state; released work retries exactly once');
  const sessions=await inspector.query(`SELECT pid FROM pg_stat_activity
    WHERE datname=$1 AND usename=$2 AND application_name='pons-garden'`,[name,role]);
  assert.equal(sessions.rowCount,1,'Fault injection must target exactly one isolated runtime connection');
  const lost=once((runtime as any).client,'error',{signal:AbortSignal.timeout(5000)});
  const [,terminated]=await Promise.all([lost,inspector.query('SELECT pg_terminate_backend($1) AS stopped',[sessions.rows[0].pid])]);
  assert.equal(terminated.rows[0].stopped,true);
  const failedStore=new Store(dir,new Map([['alice',{sap:17}]]),new Map(Object.entries(stalled.villages)),runtime);
  failedStore.touch();failedStore.ledger('alice',-1,'uncommitted-after-disconnect');
  await assert.rejects(failedStore.flush(),/^Error: Database connection lost; restart required$/);
  assert.equal(failedStore.failed,true);assert.equal(failedStore.dirty,true);
  // Closing a failed Store tries to flush, so close the terminated backend directly.
  await runtime.close();
  const recovered=new PostgresPersistence(restrictedUrl.toString(),'runtime');
  try {
    const saved=(await recovered.load())!;assert.deepEqual(saved,stalled);
    assert.equal((await inspector.query("SELECT count(*) FROM pons.ledger WHERE reason='uncommitted-after-disconnect'")).rows[0].count,'0');
    await recovered.save(saved,[]);
  } finally { await recovered.close(); }
  pass('terminated runtime connection fails saves visibly, retains dirty state and releases writer lock for committed-state recovery');
  const restricted=new Client({connectionString:restrictedUrl.toString()});await restricted.connect();
  try {
    assert.equal((await restricted.query("SELECT data->>'sap' AS sap FROM pons.players WHERE id='alice'")).rows[0].sap,'18');
    for(const sql of ['CREATE TABLE pons.forbidden(id int)','ALTER TABLE pons.ledger DISABLE TRIGGER immutable_ledger',
      'UPDATE pons.ledger SET delta=0','DELETE FROM pons.ledger','TRUNCATE pons.ledger',
      'DROP TABLE pons.players','UPDATE pons.meta SET version=2'])await assert.rejects(restricted.query(sql),/permission denied|must be owner/);
  } finally { await restricted.end(); }
  await inspector.query('ALTER TABLE pons.ledger DISABLE TRIGGER immutable_ledger');
  const unprotected=new PostgresPersistence(restrictedUrl.toString(),'runtime');
  try { await assert.rejects(unprotected.load(),/ledger protection/); } finally { await unprotected.close(); }
  await inspector.query('ALTER TABLE pons.ledger ENABLE TRIGGER immutable_ledger');
  pass('restricted runtime role saves gameplay but cannot mutate ledger, schema or version; disabled protection fails startup');
  await inspector.end();
  const migrationName=name+'_migration';await admin.query('CREATE DATABASE '+migrationName);
  const migrationUrl=new URL(connection);migrationUrl.pathname='/'+migrationName;
  const migrationDir=temp();
  const legacyPlayers=JSON.stringify({legacy:{sap:33}});
  fs.writeFileSync(path.join(migrationDir,'players.json'),legacyPlayers);
  fs.writeFileSync(path.join(migrationDir,'villages.json'),JSON.stringify({v1:{lots:['legacy']}}));
  fs.writeFileSync(path.join(migrationDir,'ledger.log'),'1000\tlegacy\t33\tinitial\n');
  const previousImport=process.env.PONS_IMPORT_LEGACY;delete process.env.PONS_IMPORT_LEGACY;
  const denied=new Store(migrationDir,new Map(),new Map(),new PostgresPersistence(migrationUrl.toString()));
  await assert.rejects(denied.load(),/PONS_IMPORT_LEGACY/);await denied.close();
  process.env.PONS_IMPORT_LEGACY='1';
  const imported=new Store(migrationDir,new Map(),new Map(),new PostgresPersistence(migrationUrl.toString()));await imported.load();
  assert.deepEqual(imported.players.get('legacy'),{sap:33});
  assert.equal(fs.readFileSync(path.join(migrationDir,'players.json'),'utf8'),legacyPlayers);
  await imported.close();
  if(previousImport===undefined)delete process.env.PONS_IMPORT_LEGACY;else process.env.PONS_IMPORT_LEGACY=previousImport;
  pass('PostgreSQL legacy import requires explicit configuration and preserves originals');
  await admin.end();
  console.log('Test database retained for inspection: '+name);
}

async function main():Promise<void> {
  if(process.env.PONS_DATABASE_URL)throw new Error('Tests must not use the production database variable');
  await fileChecks();await raceChecks();await gameChecks();
  if(!process.env.PONS_TEST_DATABASE_URL)throw new Error('PONS_TEST_DATABASE_URL is required for real PostgreSQL verification');
  await postgresChecks(process.env.PONS_TEST_DATABASE_URL);
  console.log('ALL '+checks+' persistence checks PASS');
}
void main().catch(error=>{console.error(error);process.exit(1);});
