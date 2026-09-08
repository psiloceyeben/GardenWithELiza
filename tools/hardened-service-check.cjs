// Box C only. One fresh transient service/save; never alter the public unit.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const {WebSocket}=require('ws');
const run=promisify(execFile),root=path.resolve(__dirname,'..');
assert(process.platform==='linux' && root==='/opt/pons','Box C only');
const id='pons-sandbox-qa-'+randomUUID().replace(/-/g,''),unit=id+'.service';
const directory=fs.mkdtempSync('/tmp/pons-hardened-service-');
const database=process.argv.find(a=>a.startsWith('--database='))?.slice(11);
assert(process.argv.slice(2).every(a=>a.startsWith('--database=')) && process.argv.length<=3,'Only optional isolated --database= is supported');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function command(file,args){return (await run(file,args,{timeout:25000,maxBuffer:1024*1024})).stdout.trim();}
async function properties(){return Object.fromEntries((await command('systemctl',['show',unit,'-p','MainPID','-p','ActiveState','-p','ExecMainStatus','-p','DynamicUser','-p','ProtectSystem','-p','NoNewPrivileges'])).split('\n').map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));}
async function ready(previousPid){
  const end=Date.now()+15000;
  while(Date.now()<end){
    const state=await properties();assert(state.ActiveState!=='failed','Isolated service failed');
    if(Number(state.MainPID)>0 && state.MainPID!==previousPid){
      const log=await command('journalctl',['-u',unit,'--no-pager','-o','cat']);
      const ports=[...log.matchAll(/pons server :(\d+)/g)];
      if(ports.length){
        const port=Number(ports.at(-1)[1]);
        try{const h=await fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(1000)}).then(r=>r.json());
          if(h.ok){assert.equal(h.storage,database?'postgres':'file');assert.equal(h.reader,'cached(mock)');return {state,port};}
        }catch{}
      }
    }
    await pause(100);
  }
  throw Error('Isolated service startup deadline');
}
const identity={id:'sandboxdevice001',secret:'sandboxsecret001',name:'Sandbox QA'};
async function session(port,buy){
  return new Promise((resolve,reject)=>{
    const ws=new WebSocket(`ws://127.0.0.1:${port}`);let complete=false,expected;
    const timer=setTimeout(()=>finish(Error('Isolated gameplay deadline')),10000);
    const finish=(error,value)=>{if(complete)return;complete=true;clearTimeout(timer);ws.terminate();error?reject(error):resolve(value);};
    ws.on('error',finish);ws.on('open',()=>ws.send(JSON.stringify({t:'hello',...identity})));
    ws.on('message',raw=>{try{
      const m=JSON.parse(raw);
      if(m.t==='welcome'){
        if(!buy)return finish(null,{sap:m.you.sap,seeds:m.you.seeds.map(s=>s.uid)});
        const slot=m.you.conveyor.slots.findIndex(s=>!s.sold && s.price<=m.you.sap);assert(slot>=0);
        expected=m.you.sap-m.you.conveyor.slots[slot].price;ws.send(JSON.stringify({t:'buy',slot}));
      }
      if(buy && m.t==='state' && m.you.seeds?.length){assert.equal(m.you.sap,expected);finish(null,{sap:expected,seeds:m.you.seeds.map(s=>s.uid)});}
    }catch(error){finish(error);}});
  });
}
(async()=>{
  const available=Number(fs.readFileSync('/proc/meminfo','utf8').match(/^MemAvailable:\s+(\d+)/m)[1]);
  assert(available>=1500*1024,'Insufficient host memory headroom');
  console.log(JSON.stringify({directory,unit,stateDirectory:'/var/lib/'+id}));
  let started=false;
  try{
    let databaseConnection,databaseName,socketPath;
    if(database){
      const url=new URL(database);socketPath=url.searchParams.get('host');
      assert(url.hostname==='localhost' && url.port==='15432' && url.pathname==='/postgres'
        && /^\/opt\/pons\/pg-check\.[a-zA-Z0-9]+$/.test(socketPath??''),'Only isolated pg-check admin socket');
      const {Client}=require('pg'),admin=new Client({connectionString:database});await admin.connect();
      databaseName='pons_sandbox_'+randomUUID().replace(/-/g,'');
      const role='pons_sandbox_runtime_'+randomUUID().replace(/-/g,'');
      try{await admin.query('CREATE DATABASE '+databaseName);await admin.query('CREATE ROLE '+role+' LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS');}
      finally{await admin.end();}
      url.pathname='/'+databaseName;
      const {PostgresPersistence}=require('../server/dist/server/src/persistence.js');
      const bootstrap=new PostgresPersistence(url.toString());try{await bootstrap.load();}finally{await bootstrap.close();}
      const owner=new Client({connectionString:url.toString()});await owner.connect();
      try{await owner.query(`GRANT CONNECT ON DATABASE ${databaseName} TO ${role}; GRANT USAGE ON SCHEMA pons TO ${role};
        GRANT SELECT, INSERT, UPDATE, DELETE ON pons.players, pons.villages TO ${role}; GRANT SELECT, INSERT ON pons.meta, pons.ledger TO ${role};`);}
      finally{await owner.end();}
      url.username=role;url.password='';databaseConnection=url.toString();
      url.searchParams.set('host','/run/'+id);
      fs.writeFileSync(path.join(directory,'database-url'),url.toString(),{flag:'wx',mode:0o600});
    }
    const settings=['DynamicUser=yes','StateDirectory='+id,'StateDirectoryMode=0700','WorkingDirectory=/opt/pons',
      'NoNewPrivileges=yes','ProtectSystem=strict','ProtectHome=yes','PrivateTmp=yes','PrivateDevices=yes',
      'ProtectKernelTunables=yes','ProtectKernelModules=yes','ProtectControlGroups=yes','RestrictSUIDSGID=yes',
      'RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6','CapabilityBoundingSet=','UMask=0077',
      'MemoryMax=256M','TasksMax=32','RuntimeMaxSec=120','TimeoutStopSec=25'];
    if(database)settings.push('RuntimeDirectory='+id,'RuntimeDirectoryMode=0700',
      'BindReadOnlyPaths='+socketPath+'/.s.PGSQL.15432:/run/'+id+'/.s.PGSQL.15432',
      'LoadCredential=database-url:'+path.join(directory,'database-url'));
    await command('systemd-run',['--unit='+unit,...settings.map(s=>'--property='+s),
      '/usr/bin/env','-i','PATH=/usr/bin:/bin','PONS_HOST=127.0.0.1','PONS_PORT=0','PONS_DATA=/var/lib/'+id,
      ...(database?['PONS_DATABASE_URL_FILE=/run/credentials/'+unit+'/database-url','PONS_DATABASE_SCHEMA_MODE=runtime']:[]),
      process.execPath,'/opt/pons/tools/sandbox-game-server.cjs']);started=true;
    const first=await ready();assert.equal(first.state.DynamicUser,'yes');assert.equal(first.state.ProtectSystem,'strict');assert.equal(first.state.NoNewPrivileges,'yes');
    const status=fs.readFileSync(`/proc/${first.state.MainPID}/status`,'utf8');
    const effectiveUid=Number(status.match(/^Uid:\s+\d+\s+(\d+)/m)[1]);assert(effectiveUid>0);
    const saved=await session(first.port,true);
    await command('systemctl',['restart',unit]);
    const second=await ready(first.state.MainPID);
    assert.deepEqual(await session(second.port,false),saved);
    await command('systemctl',['stop',unit]);started=false;
    const file='/var/lib/private/'+id+'/snapshot.json';let snapshot;
    if(database){
      assert(!fs.existsSync(file),'PostgreSQL service silently wrote a file snapshot');
      const {PostgresPersistence}=require('../server/dist/server/src/persistence.js');
      const reopened=new PostgresPersistence(databaseConnection,'runtime');
      try{snapshot=await reopened.load();}finally{await reopened.close();}
      const {Client}=require('pg'),reader=new Client({connectionString:databaseConnection});await reader.connect();
      try{snapshot.ledger=(await reader.query('SELECT reason FROM pons.ledger')).rows;}finally{await reader.end();}
    }else{snapshot=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(fs.statSync(file).mode&0o777,0o600);}
    assert.equal(snapshot.players[identity.id].sap,saved.sap);assert.deepEqual(snapshot.players[identity.id].seeds.map(s=>s.uid),saved.seeds);
    assert.equal(snapshot.ledger.filter(e=>e.reason.startsWith('buy:')).length,1);
    const log=await command('journalctl',['-u',unit,'--no-pager','-o','cat']);
    fs.writeFileSync(path.join(directory,'service.log'),log,{mode:0o600});
    assert.equal((log.match(/PASS sandbox boundary probes:/g)??[]).length,2,'Boundary probes must pass before and after restart');
    const result={result:'PASS enforced sandbox boundaries, dynamic non-root identity, purchase, graceful restart and exact saved recovery',unit,effectiveUid,storage:database?'postgres':'file',databaseName,stateDirectory:'/var/lib/private/'+id};
    fs.writeFileSync(path.join(directory,'result.json'),JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify({directory,...result}));
  }finally{if(started)await command('systemctl',['stop',unit]);}
})().catch(error=>{console.error('Isolated service check failed: '+error.message);process.exitCode=1;});
