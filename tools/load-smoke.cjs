// Box C only. Isolated file/PostgreSQL server, 200 protocol clients, bounded duration.
// Purchases, periodic free wardrobe writes, input/pings and persisted readback.
const { spawn } = require('node:child_process');
const { mkdtempSync, readFileSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {Client}=require('pg');
const { WebSocket } = require('ws');
const root = path.resolve(__dirname, '..');
assert(process.platform==='linux' && root==='/opt/pons','Run only on Box C /opt/pons');
const availableMB = () => Number(readFileSync('/proc/meminfo', 'utf8').match(/^MemAvailable:\s+(\d+)/m)[1]) / 1024;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const percentile = (a, p) => a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : null;
const args=process.argv.slice(2);
assert(args.every(a=>/^--seconds=\d+$/.test(a) || a.startsWith('--database=')) && new Set(args.map(a=>a.split('=')[0])).size===args.length,'Use --seconds=30..300 and optional isolated --database=');
const seconds=Number(args.find(a=>a.startsWith('--seconds='))?.slice(10)??30);
const database=args.find(a=>a.startsWith('--database='))?.slice(11);
assert(Number.isInteger(seconds) && seconds >= 30 && seconds <= 300, 'Duration must be 30..300 seconds');
(async () => {
  assert(availableMB() >= 1500, 'Insufficient host memory headroom; no load started');
  const directory = mkdtempSync(path.join(tmpdir(), 'pons-load-smoke-'));
  let databaseConnection,databaseName;
  if(database){
    const url=new URL(database);
    assert(url.hostname==='localhost' && url.port==='15432' && url.pathname==='/postgres'
      && /^\/opt\/pons\/pg-check\.[a-zA-Z0-9]+$/.test(url.searchParams.get('host')??''),'Only isolated pg-check admin sockets are allowed');
    const admin=new Client({connectionString:database});await admin.connect();
    databaseName='pons_load_'+randomUUID().replace(/-/g,'');
    try{await admin.query('CREATE DATABASE '+databaseName);}finally{await admin.end();}
    url.pathname='/'+databaseName;databaseConnection=url.toString();
    console.log(JSON.stringify({directory,databaseName,note:'Isolated test database retained for inspection'}));
  }
  const env = { ...process.env }; for (const key of Object.keys(env)) if (key.startsWith('PONS_')) delete env[key];
  Object.assign(env, { PONS_HOST: '127.0.0.1', PONS_PORT: '0', PONS_DATA: directory });
  if(databaseConnection)env.PONS_DATABASE_URL=databaseConnection;
  const child = spawn(process.execPath, ['--max-old-space-size=256', 'server/dist/server/src/index.js'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '', failure = null, stopping = false, peakRssMB = 0;
  child.stdout.on('data', d => { log += d; }); child.stderr.on('data', d => { log += d; });
  const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  const clients = [], latencies = [], gaps = [], memorySamples = [];
  let timer,report;
  try {
    const deadline = Date.now() + 15000;
    while (!/pons server :(\d+)/.test(log)) {
      assert(child.exitCode === null && Date.now() < deadline, log || 'Server startup timeout'); await sleep(50);
    }
    const port = log.match(/pons server :(\d+)/)[1];
    for (let i = 0; i < 200; i++) {
      const c = { id: `loadplayer${String(i).padStart(4, '0')}`, ready: false, purchased: false, x: 0, y: 0, lastSnap: 0, offer: null, expectedSkin:0,expectedHair:0,skin:0,hair:0,seedUid:null };
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`); c.ws = ws; clients.push(c);
      ws.on('error', e => { failure ??= e.message; });
      ws.on('close', code => { if (!stopping) failure ??= `Unexpected client close ${code}`; });
      ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', id: c.id, secret: `loadsecret${i}abc`, name: `Load ${i}` })));
      ws.on('message', raw => {
        const m = JSON.parse(String(raw)), now = Date.now();
        if (m.t === 'welcome') {
          c.ready = true; const me = m.players.find(p => p.id === c.id); c.x = me.x; c.y = me.y;
          const slot = m.you.conveyor.slots.findIndex(s => !s.sold && s.price <= m.you.sap);
          c.offer = { sap: m.you.sap, slot, prices: m.you.conveyor.slots.map(s => s.price) };
          if (slot >= 0) ws.send(JSON.stringify({ t: 'buy', slot }));
        }
        if (m.t === 'state'){
          if(m.you.seeds?.length){c.purchased=true;c.seedUid=m.you.seeds[0].uid;}
          if(m.you.skin!==undefined)c.skin=m.you.skin;
          if(m.you.hair!==undefined)c.hair=m.you.hair;
        }
        if (m.t === 'pong') latencies.push(now - m.n);
        if (m.t === 'snap') { if (c.lastSnap) gaps.push(now - c.lastSnap); c.lastSnap = now; }
        if (m.t === 'correction') { c.x = m.x; c.y = m.y; }
      });
      if (i % 10 === 9) await sleep(100);
    }
    const readyDeadline = Date.now() + 15000;
    while (!clients.every(c => c.ready)) { assert(!failure && Date.now() < readyDeadline, failure || 'Join timeout'); await sleep(50); }
    console.log(`200 clients joined isolated server; measuring ${seconds} seconds on ${process.version}`);
    let tick = 0;
    timer = setInterval(() => {
      tick++;
      for (const c of clients) if (c.ws.readyState === 1) {
        c.ws.send(JSON.stringify({ t: 'input', dx: 0, dy: 0, x: c.x, y: c.y, d: 'down', f: false, m: false }));
        if (tick % 5 === 0) c.ws.send(JSON.stringify({ t: 'ping', n: Date.now() }));
        if(tick%50===0){
          c.expectedSkin=(tick/50)%6;c.expectedHair=(tick/50)%5;
          c.ws.send(JSON.stringify({t:'wardrobe',skin:c.expectedSkin,hair:c.expectedHair}));
        }
      }
    }, 100);
    for (let second = 0; second < seconds; second++) {
      await sleep(1000);
      assert(!failure, failure); assert(availableMB() >= 768, 'Host memory safety floor reached; aborting');
      const status = readFileSync(`/proc/${child.pid}/status`, 'utf8');
      const rssMB = Number(status.match(/^VmRSS:\s+(\d+)/m)[1]) / 1024;
      peakRssMB = Math.max(peakRssMB, rssMB);
      memorySamples.push({ second: second + 1, rssMB });
      if ((second + 1) % 30 === 0) console.log(JSON.stringify({ elapsedSeconds: second + 1, rssMB, pongs: latencies.length }));
    }
    clearInterval(timer);
    const commitDeadline=Date.now()+5000;
    while(!clients.every(c=>c.purchased && c.skin===c.expectedSkin && c.hair===c.expectedHair)){
      assert(!failure && Date.now()<commitDeadline,'Final purchase/wardrobe acknowledgement missing');await sleep(20);
    }
    const health = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(5000) }).then(r => r.json());
    report = { runtime: process.version, databaseName, clients: clients.length, wardrobeRounds:Math.floor(tick/50), purchased: clients.filter(c => c.purchased).length, missingPurchases: clients.filter(c => !c.purchased).map(c => ({ id: c.id, offer: c.offer })), measuredSeconds: seconds,
      pongs: latencies.length, p95RttMs: percentile(latencies, .95), p99RttMs: percentile(latencies, .99),
      p99SnapshotGapMs: percentile(gaps, .99), maxSnapshotGapMs: gaps.reduce((max, gap) => Math.max(max, gap), 0), peakServerRssMB: peakRssMB, memorySamples, health };
    writeFileSync(path.join(directory, 'load-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ directory, ...report, memorySamples: `${memorySamples.length} samples in load-report.json` }));
    assert.equal(health.online, 200); assert.equal(report.purchased, 200); assert(health.ok);
    assert.equal(health.storage,databaseConnection?'postgres':'file');
    assert(report.pongs >= seconds * 200 * 2 * .8); assert(report.p95RttMs < 250); assert(report.p99RttMs < 500);
    assert(report.maxSnapshotGapMs < 1000);
  } finally {
    stopping = true; clearInterval(timer); for (const c of clients) c.ws.terminate();
    child.kill('SIGTERM'); const deadline = setTimeout(() => child.kill('SIGKILL'), 22000);
    try { const result = await exited; writeFileSync(path.join(directory, 'server.log'), log); assert.equal(result.code, 0, log); }
    finally { clearTimeout(deadline); }
  }
  // A new persistence connection must recover acknowledged purchases and cosmetics.
  const {FilePersistence,PostgresPersistence}=require('../server/dist/server/src/persistence.js');
  const reopened=databaseConnection?new PostgresPersistence(databaseConnection):new FilePersistence(directory);
  try{
    const saved=await reopened.load();assert.equal(Object.keys(saved.players).length,200);
    for(const c of clients){
      const player=saved.players[c.id];assert(player);
      assert.equal(player.seeds.length,1);assert.equal(player.seeds[0].uid,c.seedUid);
      assert.equal(player.sap,c.offer.sap-c.offer.prices[c.offer.slot]);
      assert.equal(player.skin??0,c.expectedSkin);assert.equal(player.hair??0,c.expectedHair);
    }
  }finally{await reopened.close();}
  let purchases;
  if(databaseConnection){
    const inspector=new Client({connectionString:databaseConnection});await inspector.connect();
    try{purchases=(await inspector.query("SELECT player_id,delta FROM pons.ledger WHERE reason LIKE 'buy:%'")).rows;}
    finally{await inspector.end();}
  }else purchases=JSON.parse(readFileSync(path.join(directory,'snapshot.json'),'utf8')).ledger.filter(e=>e.reason.startsWith('buy:')).map(e=>({player_id:e.playerId,delta:e.delta}));
  assert.equal(purchases.length,200);assert.equal(new Set(purchases.map(p=>p.player_id)).size,200);
  for(const c of clients)assert.equal(purchases.find(p=>p.player_id===c.id).delta,-c.offer.prices[c.offer.slot]);
  report.persistedReadback={players:200,seeds:200,uniquePurchaseLedgerEntries:200,wardrobe:true};
  writeFileSync(path.join(directory,'load-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({directory,result:'PASS bounded load and post-shutdown persistence readback',persistedReadback:report.persistedReadback}));
})().catch(e => { console.error(e); process.exitCode = 1; });
