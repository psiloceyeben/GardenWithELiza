// Box C only; restore retained QA gameplay into new databases, never overwrite it.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID,createHash}=require('node:crypto'),{isDeepStrictEqual,promisify}=require('node:util');
const {execFile}=require('node:child_process'),{Client}=require('pg');
const root=path.resolve(__dirname,'..');assert(process.platform==='linux' && root==='/opt/pons','Box C only');
const arg=name=>process.argv.find(s=>s.startsWith('--'+name+'='))?.slice(name.length+3);
const url=new URL(arg('database')),source=arg('source');
assert(url.hostname==='localhost' && url.port==='15432' && url.pathname==='/postgres'
  && /^\/opt\/pons\/pg-check\.[a-zA-Z0-9]+$/.test(url.searchParams.get('host')??''),'Only isolated pg-check admin sockets');
assert(/^pons_(browser|load)_[a-f0-9]{32}$/.test(source??''),'Source must be a retained QA database');
const directory=fs.mkdtempSync('/tmp/pons-backup-drill-'),archive=path.join(directory,'garden.dump');
const connection=name=>{const copy=new URL(url);copy.pathname='/'+name;return copy.toString();};
const env={...process.env};for(const key of Object.keys(env))if(key.startsWith('PG') || key.startsWith('PONS_'))delete env[key];
Object.assign(env,{PGHOST:url.searchParams.get('host'),PGPORT:'15432',PGUSER:decodeURIComponent(url.username),
  PATH:'/opt/pons/pg-test-runtime/usr/lib/postgresql/16/bin:'+env.PATH,
  LD_LIBRARY_PATH:'/opt/pons/pg-test-runtime/usr/lib/x86_64-linux-gnu'});
let step=0;
async function command(name,args,expectedFailure=false){
  let failed=false,stdout='',stderr='';
  try{({stdout,stderr}=await promisify(execFile)('bash',['tools/database_backup.sh',...args],{cwd:root,env:{...env,PGDATABASE:name},timeout:30000,maxBuffer:2*1024*1024}));}
  catch(error){failed=true;stdout=error.stdout??'';stderr=error.stderr??'';}
  fs.writeFileSync(path.join(directory,`${++step}-${args[0]}.log`),stdout+'\n'+stderr,{mode:0o600});
  assert.equal(failed,expectedFailure,'Unexpected backup/restore command result; inspect retained log');
}
async function inspect(name){
  const client=new Client({connectionString:connection(name)});await client.connect();
  try{
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const snapshot={};for(const table of ['players','villages','ledger','meta'])snapshot[table]=(await client.query(`SELECT * FROM pons.${table} ORDER BY id`)).rows;
    await client.query('COMMIT');return snapshot;
  }finally{await client.end();}
}
async function noPons(name){
  const client=new Client({connectionString:connection(name)});await client.connect();
  try{assert.equal((await client.query("SELECT count(*)::int AS n FROM pg_namespace WHERE nspname='pons'")).rows[0].n,0,'Failed restore left partial schema');}
  finally{await client.end();}
}
(async()=>{
  console.log(JSON.stringify({directory,source}));
  const before=await inspect(source);assert(before.players.length>0,'Source has no gameplay records');
  await command(source,['backup',archive]);assert.equal(fs.statSync(archive).mode&0o777,0o600);
  const digest=()=>createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),sha256=digest();
  await command(source,['backup',archive],true);assert.equal(digest(),sha256,'Refused backup modified archive');
  const dangling=path.join(directory,'dangling.dump'),missing=path.join(directory,'must-not-be-created');
  fs.symlinkSync(missing,dangling);
  await command(source,['backup',dangling],true);
  assert(fs.lstatSync(dangling).isSymbolicLink() && !fs.existsSync(missing),'Backup followed an existing dangling symlink');
  await command(source,['backup','relative-backup.dump'],true);
  const failedArchive=path.join(directory,'failed.dump');
  await command('pons_missing_'+randomUUID().replace(/-/g,''),['backup',failedArchive],true);
  assert(!fs.existsSync(failedArchive),'Failed dump published an archive');
  assert(!fs.readdirSync(directory).some(name=>name.startsWith('.pons-backup.')),'Backup left private temporary files');
  const restored='pons_restore_'+randomUUID().replace(/-/g,''),broken='pons_restore_'+randomUUID().replace(/-/g,'');
  const admin=new Client({connectionString:url.toString()});await admin.connect();
  try{await admin.query('CREATE DATABASE '+restored);await admin.query('CREATE DATABASE '+broken);}finally{await admin.end();}
  await command(restored,['restore',archive,'wrong_destination'],true);await noPons(restored);
  await command(restored,['restore',archive,restored]);
  assert(isDeepStrictEqual(await inspect(restored),before),'Restored records or ledger differ');
  await command(restored,['restore',archive,restored],true);
  assert(isDeepStrictEqual(await inspect(restored),before),'Occupied-destination refusal changed records');
  const truncated=path.join(directory,'truncated.dump'),bytes=fs.readFileSync(archive);assert(bytes.length>512);
  fs.writeFileSync(truncated,bytes.subarray(0,bytes.length-64),{flag:'wx',mode:0o600});
  // A valid table of contents alone must not be mistaken for a restorable archive.
  await promisify(execFile)('pg_restore',['--list',truncated],{env,timeout:10000});
  await command(broken,['restore',truncated,broken],true);await noPons(broken);
  for(const key of Object.keys(process.env))if(key.startsWith('PONS_'))delete process.env[key];
  process.env.PONS_DATABASE_URL=connection(restored);
  const {Game}=require('../server/dist/server/src/game.js');
  const game=new Game(fs.mkdtempSync('/tmp/pons-restored-game-'));await game.initialize();
  try{
    assert.equal(game.players.size,before.players.length);
    for(const row of before.players)assert(isDeepStrictEqual(game.players.get(row.id),row.data),'Restored game startup changed player state');
    await game.commit();
  }finally{await game.store.close();}
  const check=new Client({connectionString:connection(restored)});await check.connect();
  try{await assert.rejects(check.query('UPDATE pons.ledger SET delta=delta WHERE false'),/append-only/);}finally{await check.end();}
  assert(isDeepStrictEqual(await inspect(source),before),'Backup drill modified source gameplay');
  const result={result:'PASS gameplay backup/restore, refusal guards, truncated-archive rollback, restored Game startup and ledger immutability',source,restored,broken,players:before.players.length,ledgerEntries:before.ledger.length,sha256};
  fs.writeFileSync(path.join(directory,'result.json'),JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify({directory,...result}));
})().catch(error=>{console.error('Backup drill failed: '+error.message);process.exitCode=1;});
