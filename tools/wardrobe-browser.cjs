// Box C only. Isolated saves, loopback HTTP/game servers, real headless Chromium.
const { chromium } = require('/opt/pons-browser-qa/node_modules/playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), assets = path.join(root, 'client/dist');
assert(process.platform==='linux' && root==='/opt/pons','Box C only');
const database=process.argv.find(a=>a.startsWith('--database='))?.slice(11);
const runtimeDatabase=process.argv.includes('--runtime-database');
assert(!runtimeDatabase || database,'Restricted runtime requires an isolated database URL');
const delay = ms => new Promise(r => setTimeout(r, ms));
const perspectiveRaid = process.argv.includes('--perspective-raid');
const focusMode = process.argv.includes('--focus');
const gardenMode = process.argv.includes('--perspective-garden') || focusMode;
const walletNew=process.argv.includes('--wallet-new');
const staleWallet=process.argv.includes('--stale-wallet');
const walletReject=process.argv.includes('--wallet-reject');
const walletProvider=process.argv.find(arg=>arg.startsWith('--wallet-provider='))?.split('=')[1]??'metamask';
assert(['metamask','phantom','coinbase','rabby'].includes(walletProvider));
assert(!walletReject || walletNew,'Rejection recovery requires --wallet-new');
const walletHandoff=process.argv.includes('--wallet-handoff') || walletNew || staleWallet;
const raidMode = process.argv.includes('--raid') || perspectiveRaid || process.argv.includes('--appearance') || process.argv.includes('--gate-raid') || process.argv.includes('--gnome-raid');
const allModelSpecies=['gorbulon_sprig','plain_gerald','concerned_radish','unlicensed_carrot','clammy_pete','cactusberry_vicar','sir_blombus','weeping_wumbus','melonhound','pumpkin_esquire','corn_that_knows','bamboo_inspector','duchess_turnip','lord_eggplant','yelling_tuber','low_ambition_tulip','sunflower_who_lied','bogwort','bartholomew_bean','pineapple_enforcer','grabby_bertrand','fraudulent_orchid'];
const plantPage=Number(process.argv.find(arg=>arg.startsWith('--plant-page='))?.split('=')[1]??0);
assert(Number.isInteger(plantPage) && plantPage>=0 && plantPage*10<allModelSpecies.length,'Invalid plant fixture page');
const modelSpecies=allModelSpecies.slice(plantPage*10,(plantPage+1)*10);
(async () => {
  for (const key of Object.keys(process.env)) if (key.startsWith('PONS_')) delete process.env[key];
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pons-wardrobe-browser-'));
  const { Game } = require('../server/dist/server/src/game.js');
  const fixture = new Game(directory); await fixture.initialize();
  const identity = { id: 'wardrobebrowser123', secret: 'wardrobebrowsersecret', name: 'Style QA' };
  let walletFixture;
  if(walletHandoff){
    const {signForTest}=require('../server/dist/server/src/sig.js');
    const {MockReader}=require('../server/dist/chain-reader/src/index.js');
    const {deriveGarden}=require('../server/dist/shared/derive/index.js');
    let key,address,expected;
    for(let i=0;i<100;i++){
      key=require('node:crypto').randomBytes(32).toString('hex');
      address=signForTest('isolated browser fixture',key).address;
      expected=deriveGarden(address,await new MockReader().snapshot(address));
      if(!walletNew || (expected.plotCount>10 && expected.decorFlora>0 && expected.treeStage>0))break;
    }
    if(walletNew)assert(expected.plotCount>10 && expected.decorFlora>0 && expected.treeStage>0,'No suitable generated mock fixture');
    walletFixture={address,expected,sign:message=>signForTest(message,key).signature,methods:[]};
    if(!walletNew){
    const owner=fixture.newPlayer('walletowner001','wallet-owner-secret','Wallet Gardener',null,Date.now());
    owner.address=address;owner.skin=4;owner.hat=1;owner.hats=[0,1];owner.sap=321;
    if(staleWallet)owner.secret='rotated-wallet-owner-secret';
    owner.plots[0]={uid:'wallet-owned-plant',speciesId:'gorbulon_sprig',tier:'common',plantedAt:Date.now(),growMs:3600000,revealed:false,size:1,mutation:'none',watered:false,lastWeeded:Date.now(),nick:'Saved Sprout'};
    fixture.store.touch();
    }
  }
  const rec = fixture.newPlayer(identity.id, identity.secret, identity.name, null, Date.now());
  rec.sap = 1000; rec.color = 0; rec.hat = 0; rec.hats = [0, 1]; fixture.store.touch();
  if(process.argv.includes('--defenses'))rec.sap=3000;
  if(process.argv.includes('--legacy-clock'))rec.defenses.gnome=true;
  rec.plots[0] = { uid: 'qa-plant', speciesId: 'gorbulon_sprig', tier: 'common', plantedAt: Date.now(), growMs: 3600000,
    revealed: false, size: 1, mutation: 'none', watered: false, lastWeeded: Date.now() };
  if(process.argv.includes('--tend-weeds')){
    rec.plots[0].revealed=true;
    rec.plots[0].lastWeeded=Date.now()-21*60_000;
  }
  const raiderIdentity = { id: 'raidbrowser123', secret: 'raidbrowsersecret', name: 'Raid QA' };
  if(process.argv.includes('--plants')) {
    for(const [i,speciesId] of modelSpecies.entries())
      rec.plots[i]={...rec.plots[0],uid:'plant-model-'+i,speciesId,revealed:true};
    fixture.store.touch();
  }
  if (gardenMode) { rec.sap = 25; rec.plots[0] = null; fixture.store.touch(); }
  if (raidMode) {
    rec.plots[0].revealed = true; rec.plots[0].nick = 'Captain Sprout';
    if(process.argv.includes('--wander')) {rec.plots[0].mutation='golden';rec.plots[0].size=1.3;}
    const raider=fixture.newPlayer(raiderIdentity.id, raiderIdentity.secret, raiderIdentity.name, null, Date.now());
    if(process.argv.includes('--appearance'))raider.color=0;
    if(process.argv.includes('--gate-raid'))rec.plots[0]=null;
    fixture.store.touch();
  }
  // Wardrobe cost checks need a stable balance, without passive plant income.
  if(process.argv.includes('--hair')){assert(process.argv.includes('--appearance'));rec.plots[0]=null;fixture.store.touch();}
  await fixture.store.close();
  let databaseConnection,databaseName;
  if(database){
    const url=new URL(database);
    assert(url.hostname==='localhost' && url.port==='15432' && url.pathname==='/postgres'
      && /^\/opt\/pons\/pg-check\.[a-zA-Z0-9]+$/.test(url.searchParams.get('host')??''),'Only isolated pg-check admin sockets are allowed');
    const {Client}=require('pg'),admin=new Client({connectionString:database});await admin.connect();
    databaseName='pons_browser_'+require('node:crypto').randomUUID().replace(/-/g,'');
    try{await admin.query('CREATE DATABASE '+databaseName);}finally{await admin.end();}
    url.pathname='/'+databaseName;databaseConnection=url.toString();
    if(runtimeDatabase){
      const {PostgresPersistence}=require('../server/dist/server/src/persistence.js');
      const bootstrap=new PostgresPersistence(databaseConnection,'bootstrap');
      try{await bootstrap.load();}finally{await bootstrap.close();}
      const role='pons_browser_runtime_'+require('node:crypto').randomUUID().replace(/-/g,'');
      const owner=new Client({connectionString:databaseConnection});await owner.connect();
      try{
        await owner.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
          GRANT CONNECT ON DATABASE ${databaseName} TO ${role};
          GRANT USAGE ON SCHEMA pons TO ${role};
          GRANT SELECT, INSERT, UPDATE, DELETE ON pons.players, pons.villages TO ${role};
          GRANT SELECT, INSERT ON pons.meta, pons.ledger TO ${role};`);
      }finally{await owner.end();}
      url.username=role;url.password='';databaseConnection=url.toString();
      console.log(JSON.stringify({directory,role,schemaMode:'runtime',note:'Restricted QA role retained; schema remains owner-owned'}));
    }
    console.log(JSON.stringify({directory,databaseName,note:'Isolated PostgreSQL browser fixture retained'}));
  }
  const child = spawn(process.execPath, [raidMode ? 'tools/raid-browser-server.cjs' : 'server/dist/server/src/index.js'], { cwd: root,
    env: { ...process.env, PONS_HOST: '127.0.0.1', PONS_PORT: '0', PONS_DATA: directory,
      ...(databaseConnection?{PONS_DATABASE_URL:databaseConnection,PONS_IMPORT_LEGACY:'1',PONS_DATABASE_SCHEMA_MODE:runtimeDatabase?'runtime':'bootstrap'}:{}) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; child.stdout.on('data', d => { log += d; }); child.stderr.on('data', d => { log += d; });
  const exited = new Promise(r => child.once('exit', code => r(code)));
  const web = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://local');
    const file = path.resolve(assets, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(assets + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
    const type = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type }); fs.createReadStream(file).pipe(res);
  });
  let browser,testFailed=false;
  const expectedDatabase=new Map();
  const rememberDatabaseState=async page=>{
    const you=await page.evaluate(()=>{
      const s=window.pons,p=s?.you;if(!s?.ready || !p)return null;
      return {id:p.id,sap:p.sap,skin:p.skin??0,hair:p.hair??0,hat:p.hat,
        seeds:p.seeds.map(seed=>seed.uid),plots:p.plots.map(plant=>plant?{uid:plant.uid,nick:plant.nick??null,size:plant.size,mutation:plant.mutation}:null)};
    });
    if(you)expectedDatabase.set(you.id,you);
  };
  try {
    const until = Date.now() + 15000;
    while (!/pons server :(\d+)/.test(log)) { assert(child.exitCode === null && Date.now() < until, log); await delay(50); }
    const gamePort = log.match(/pons server :(\d+)/)[1];
    const health=await fetch(`http://127.0.0.1:${gamePort}/health`).then(r=>r.json());
    assert.equal(health.storage,databaseConnection?'postgres':'file');assert.equal(health.reader,'cached(mock)');
    await new Promise(r => web.listen(0, '127.0.0.1', r));
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: true });
    await context.addInitScript(({identity,preserve,stale}) => {
      if(stale && sessionStorage.getItem('qaIdentitySeeded'))return;
      if(!preserve || !localStorage.getItem('pons.identity.v1'))localStorage.setItem('pons.identity.v1',JSON.stringify(identity));
      if(stale)sessionStorage.setItem('qaIdentitySeeded','1');
    }, {identity:staleWallet?{id:'walletowner001',secret:'wallet-owner-secret',name:'Wallet Gardener'}:identity,preserve:walletHandoff,stale:staleWallet});
    if(walletHandoff){
      await context.exposeBinding('qaWalletRequest',async(_source,args)=>{
        walletFixture.methods.push(args.method);
        console.log('QA_WALLET_METHOD',args.method);
        if(args.method==='eth_requestAccounts' || args.method==='eth_accounts')return [walletFixture.address];
        if(args.method==='personal_sign'){
          assert.equal(args.params[1],walletFixture.address);
          assert.equal(typeof args.params[0],'string');
          if(walletReject && walletFixture.methods.filter(m=>m==='personal_sign').length===1)return {qaRejected:true};
          return walletFixture.sign(args.params[0]);
        }
        throw new Error('Unexpected wallet method: '+args.method);
      });
      await context.addInitScript(providerId=>{
        const provider={request:async args=>{
          const result=await window.qaWalletRequest(args);
          if(result?.qaRejected)throw {code:4001,message:'User rejected the test signature'};
          return result;
        },on(){},removeListener(){}};
        const rdns={metamask:'io.metamask',phantom:'app.phantom',coinbase:'com.coinbase.wallet',rabby:'io.rabby'}[providerId];
        // Discovery path only; no legacy flags to mask a broken announcement.
        window.addEventListener('eip6963:requestProvider',()=>window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{rdns,name:'Isolated QA provider'},provider}})));
      },walletProvider);
    }
    if(process.argv.includes('--duplicate-session') || staleWallet)await context.addInitScript(()=>{
      window.qaSocketCount=0;const Original=window.WebSocket;
      window.WebSocket=class extends Original{constructor(...args){super(...args);window.qaSocketCount++;}};
    });
    const page = await context.newPage(), errors = [];
    if(process.argv.includes('--skin'))await page.addInitScript(()=>{
      window.qaGraphicsContexts=new Set();const original=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(...args){
        const result=original.apply(this,args);
        if(result && (args[0]==='webgl' || args[0]==='webgl2'))window.qaGraphicsContexts.add(result);
        return result;
      };
    });
    if(process.argv.includes('--legacy-clock'))await page.addInitScript(()=>{const real=Date.now.bind(Date);Date.now=()=>real()+3600000;});
    page.on('pageerror', e => errors.push(e.message));
    const viewQuery=process.argv.includes('--default-view') ? '' :
      `${process.argv.includes('--perspective') || process.argv.includes('--wander') || perspectiveRaid || gardenMode ? '&view=perspective' : '&view=orthographic'}${process.argv.includes('--wander') ? '&characters=wander' : '&characters=sprites'}`;
    await page.goto(`http://127.0.0.1:${web.address().port}/?ws=ws://127.0.0.1:${gamePort}${viewQuery}`);
    if(process.argv.includes('--status-layout')){
      await page.waitForFunction(()=>window.pons?.ready);
      // Pin synthetic notices while measuring layout, independent of seasonal timing.
      await page.evaluate(()=>{window.pons.hud.banner=()=>{};});
      const samples=[];
      for(const width of [320,390,600,601,960,1280,1920]){
        await page.setViewportSize({width,height:900});
        for(const count of [0,1,5])for(const bannerVisible of [false,true]){
          const result=await page.evaluate(({count,bannerVisible})=>{
            const feed=document.getElementById('feed');feed.replaceChildren();
            for(let i=0;i<count;i++){
              const entry=document.createElement('div');entry.className='fe fe-steal';
              entry.textContent='Garden Explorer stole Curious Gardener’s Sir Blombus of the Damp “Captain Sprout” (Golden).';feed.append(entry);
            }
            const banner=document.getElementById('banner');banner.hidden=!bannerVisible;
            banner.textContent='Golden Hour. Reveals shine brighter. ends in 1:30';
            const toast=document.getElementById('toast');toast.classList.add('on');
            toast.textContent='Village: Ash Yard #1. Move: arrows / WASD / tap. Interact: tap a plot or press E.';
            const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
            return {hud:rect('hud'),feed:rect('feed'),banner:bannerVisible?rect('banner'):null,toast:rect('toast'),feedVisible:[...feed.children].filter(e=>getComputedStyle(e).display!=='none').length};
          },{count,bannerVisible});
          assert.equal(result.feedVisible,width<=600?Math.min(count,1):count);
          const firstBottom=Math.max(result.hud.bottom,result.feed.bottom);
          if(result.banner)assert(result.banner.top>=firstBottom+5,`Event overlaps status at ${width}/${count}`);
          assert(result.toast.top>=(result.banner?.bottom??firstBottom)+5,`Notice overlaps preceding row at ${width}/${count}`);
          for(const rect of Object.values(result).filter(v=>v && typeof v==='object'))assert(rect.left>=0 && rect.right<=width,`Status exceeds width ${width}`);
          samples.push({width,count,bannerVisible,...result});
        }
        if(width===320 || width===960)await page.screenshot({path:path.join(directory,`status-layout-${width}.png`)});
      }
      fs.writeFileSync(path.join(directory,'status-layout.json'),JSON.stringify(samples,null,2));
      assert.deepEqual(errors,[]);console.log(JSON.stringify({directory,result:'PASS 42 status layouts: empty/single/full feed, event shown/hidden, notices, seven widths across desktop breakpoint',errors}));return;
    }
    if(process.argv.includes('--duplicate-session')){
      if(process.argv.includes('--duplicate-legacy')){const url=new URL(page.url());url.searchParams.set('r','2d');await page.goto(url.href);}
      await page.waitForFunction(()=>window.pons?.ready);
      const duplicate=await context.newPage();duplicate.on('pageerror',e=>errors.push(e.message));
      await duplicate.goto(page.url());await duplicate.waitForFunction(()=>window.pons?.ready);
      await page.locator('#session-replaced').waitFor({state:'visible'});
      await page.waitForTimeout(2500);
      assert(await page.evaluate(()=>!window.pons.ready && !window.pons.net.connected && window.qaSocketCount===1));
      assert(await duplicate.evaluate(()=>window.pons.ready && window.pons.net.connected && window.qaSocketCount===1));
      await page.screenshot({path:path.join(directory,'session-replaced.png')});
      await page.getByRole('button',{name:'Play in this tab',exact:true}).click();
      await page.waitForFunction(()=>window.pons?.ready && !document.getElementById('session-replaced'));
      await duplicate.locator('#session-replaced').waitFor({state:'visible'});
      await page.waitForTimeout(2500);
      assert(await page.evaluate(()=>window.pons.ready && window.pons.net.connected && window.qaSocketCount===1));
      assert(await duplicate.evaluate(()=>!window.pons.ready && !window.pons.net.connected && window.qaSocketCount===1));
      assert.deepEqual(errors,[]);
      console.log(JSON.stringify({directory,result:'PASS duplicate tabs stop reconnecting, explicit takeover reverses ownership without a reconnect loop',legacy:process.argv.includes('--duplicate-legacy'),errors}));
      return;
    }
    if(walletHandoff){
      if(staleWallet){
        if(process.argv.includes('--stale-legacy')){const url=new URL(page.url());url.searchParams.set('r','2d');await page.goto(url.href);}
        await page.locator('#identity-rejected').waitFor({state:'visible'});
        await page.waitForTimeout(2500);
        assert(await page.evaluate(()=>!window.pons.ready && !window.pons.net.connected && window.qaSocketCount===1 && JSON.parse(localStorage.getItem('pons.identity.v1')).secret==='wallet-owner-secret'));
        await page.screenshot({path:path.join(directory,'identity-rejected.png')});
        await page.getByRole('button',{name:'Sign in again',exact:true}).click();
        await page.locator('#name-modal').waitFor({state:'visible'});
        assert.equal(await page.evaluate(()=>localStorage.getItem('pons.identity.v1')),null);
        await page.locator(`#wallets [data-wallet="${walletProvider}"]`).click();
      }else{
      await page.waitForFunction(()=>window.pons?.ready && window.pons.you.id==='wardrobebrowser123');
      await page.locator('#btn-land').click();
      await page.locator(`[data-wallet="${walletProvider}"]`).click();
      }
      if(walletReject){
        await page.waitForFunction(()=>!window.pons.linking && document.getElementById('toast').textContent==='Wallet sign-in cancelled. Your garden is unchanged.');
        assert.equal(walletFixture.methods.filter(m=>m==='personal_sign').length,1);
        assert(await page.evaluate(()=>{
          const you=window.pons.you;
          return you.id==='wardrobebrowser123' && you.land.address===null && you.sap===1000 && you.plotCount===10 && you.plots[0]?.uid==='qa-plant';
        }));
        await page.locator(`[data-wallet="${walletProvider}"]`).click();
      }
      if(walletNew){
        const expected=walletFixture.expected;
        const verify=async()=>{
          await page.waitForFunction(expected=>{
            const s=window.pons,you=s?.you,lot=s?.lots.get(you?.id)?.lot,r=window.pons3d;
            return s?.ready && you.id==='wardrobebrowser123' && you.land.address===expected.address
              && you.plotCount===expected.plotCount && you.rarityFloor===expected.rarityFloor
              && you.land.biome===expected.biome && you.land.treeStage===expected.treeStage
              && you.land.witherMarks===expected.witherMarks && you.land.decorFlora===expected.decorFlora
              && you.land.hybrids===expected.hybridsUnlocked && lot?.land.decorFlora===expected.decorFlora
              && r.treeModels.get('tree'+you.id)?.stage===expected.treeStage
              && [...r.decorModels.keys()].filter(id=>id.startsWith('decor'+you.id)).length===expected.decorFlora;
          },expected,{timeout:45000});
          assert(await page.evaluate(()=>window.pons.you.plots[0]?.uid==='qa-plant' && window.pons.you.sap===1000));
        };
        await verify();await page.reload();await verify();
        await page.locator('#btn-land').click();await page.locator('#btn-unlink').click();
        await page.waitForFunction(()=>window.pons.you.land.address===null && [...window.pons3d.decorModels.keys()].every(id=>!id.startsWith('decor'+window.pons.you.id)));
        await page.reload();await page.waitForFunction(()=>window.pons?.ready && window.pons.you.land.address===null);
        assert(await page.evaluate(count=>window.pons.you.plotCount===count && window.pons.you.plots[0]?.uid==='qa-plant',expected.plotCount));
        assert.deepEqual(walletFixture.methods,[...(walletReject?['eth_requestAccounts','eth_accounts','personal_sign']:[]),'eth_requestAccounts','eth_accounts','personal_sign','eth_accounts']);
        assert.deepEqual(errors,[]);
        console.log(JSON.stringify({directory,walletProvider,walletReject,result:'PASS signed new-wallet mock derivation, private/public land and 3D tree/decor, saved crop and expanded plots, reconnect and unlink cleanup',expected,errors}));
        return;
      }
      await page.waitForFunction(()=>window.pons?.ready && window.pons.you.id==='walletowner001',null,{timeout:45000});
      const verify=async()=>{
        assert(await page.evaluate(address=>{
          const s=window.pons,you=s.you,saved=JSON.parse(localStorage.getItem('pons.identity.v1'));
          return you.land.address===address && saved.id===you.id && you.sap===321 && you.skin===4 && you.hat===1
            && you.plots[0]?.uid==='wallet-owned-plant' && you.plots[0]?.nick==='Saved Sprout'
            && !you.plots.some(p=>p?.uid==='qa-plant');
        },walletFixture.address));
        if(!process.argv.includes('--stale-legacy'))await page.waitForFunction(()=>window.pons3d.localAvatar?.asset.state.skinColor==='#8b593e' && window.pons3d.localAvatar?.hatStyle==='cap');
      };
      await verify();await page.reload();
      await page.waitForFunction(()=>window.pons?.ready && window.pons.you.id==='walletowner001');await verify();
      assert.equal(walletFixture.methods.filter(m=>m==='personal_sign').length,1);
      assert(walletFixture.methods.every(m=>['eth_requestAccounts','eth_accounts','personal_sign'].includes(m)));
      await page.locator('#btn-land').click();await page.locator('#btn-unlink').waitFor();
      await page.screenshot({path:path.join(directory,'wallet-handoff.png')});
      assert.deepEqual(errors,[]);
      console.log(JSON.stringify({directory,staleWallet,result:'PASS simulated-provider real signature, guest-to-wallet identity handoff, preserved garden/wardrobe, automatic and manual reload, sign-in methods only',methods:walletFixture.methods,errors}));
      return;
    }
    if(process.argv.includes('--sprint') || process.argv.includes('--sprint-mission')){
      await page.waitForFunction(()=>window.pons?.ready);
      const missionMode=process.argv.includes('--sprint-mission');
      const visitWarden=async()=>{
        await page.evaluate(()=>{const s=window.pons,n=s.village.npcs.find(n=>n.id==='warden');s.onTap(n.tx*32+16,n.ty*32+16);});
      };
      if(missionMode){
        await visitWarden();
        await page.locator('[data-mission="sprint1"][data-action="accept"]').waitFor({timeout:60000});
        await page.locator('[data-mission="sprint1"][data-action="accept"]').click();
        await page.waitForFunction(()=>window.pons.you.missions.active.sprint1===0);
        await page.locator('#panel-close').click();
      }
      const route=await page.evaluate(()=>{
        const s=window.pons,v=s.village,f=v.props.find(p=>p.kind==='fountain');
        return {track:{x:v.track.tx*32+32,y:v.track.ty*32+16},turn:{x:f.tx*32+32,y:f.ty*32+32+48}};
      });
      await page.evaluate(p=>window.pons.onTap(p.x,p.y),route.track);
      await page.waitForFunction(()=>window.pons.sprintStartedAt>0,null,{timeout:60000});
      await page.evaluate(p=>window.pons.goTo(p),route.turn);
      await page.waitForFunction(()=>document.getElementById('toast')?.textContent.includes('Now back to the track!'),null,{timeout:20000});
      await page.evaluate(p=>window.pons.goTo(p),route.track);
      await page.waitForFunction(()=>window.pons.sprintStartedAt===0 && window.pons.you.sap===1070 && window.pons.board.length===1,null,{timeout:20000});
      const entry=await page.evaluate(()=>window.pons.board[0]);assert.equal(entry.name,identity.name);assert(entry.ms>0 && entry.ms<=30000);
      await page.locator('#btn-feed').click();
      assert((await page.locator('#panel-body').innerText()).includes(identity.name));
      await page.screenshot({path:path.join(directory,'sprint-board.png')});
      await page.reload();await page.waitForFunction(()=>window.pons?.ready && window.pons.board.length===1);
      assert.deepEqual(await page.evaluate(()=>window.pons.board[0]),entry);
      await page.evaluate(p=>window.pons.onTap(p.x,p.y),route.track);
      await page.waitForFunction(()=>document.getElementById('toast')?.textContent.includes('Catch your breath first.'),null,{timeout:60000});
      assert(await page.evaluate(()=>window.pons.sprintStartedAt===0 && window.pons.you.sap===1070 && window.pons.board.length===1));
      if(missionMode){
        assert(await page.evaluate(()=>window.pons.you.missions.active.sprint1===1));
        await visitWarden();
        await page.locator('[data-mission="sprint1"][data-action="claim"]').waitFor({timeout:60000});
        await page.locator('[data-mission="sprint1"][data-action="claim"]').click();
        await page.waitForFunction(()=>window.pons.you.sap===1130 && !!window.pons.you.missions.done.sprint1 && !('sprint1' in window.pons.you.missions.active));
        assert.equal(await page.locator('[data-mission="sprint1"]').isDisabled(),true);
        await page.screenshot({path:path.join(directory,'sprint-mission-claimed.png')});
        await page.reload();await page.waitForFunction(()=>window.pons?.ready && window.pons.you.sap===1130 && !!window.pons.you.missions.done.sprint1);
        assert(!await page.evaluate(()=>'sprint1' in window.pons.you.missions.active));
        console.log(JSON.stringify({directory,result:'PASS real NPC mission acceptance, lap progress, post-reload claim, 60 Sap reward and persisted completion'}));
      }
      assert.deepEqual(errors,[]);console.log(JSON.stringify({directory,entry,result:'PASS real sprint traversal, checkpoint, reward, leaderboard UI/reload and cooldown',errors}));return;
    }
    if(process.argv.includes('--forage')){
      await page.waitForFunction(()=>window.pons?.ready && window.pons.wilds.size>0);
      const target=await page.evaluate(()=>{
        const s=window.pons,w=[...s.wilds.values()].map(v=>v.w).sort((a,b)=>Math.hypot(a.x-s.player.x,a.y-s.player.y)-Math.hypot(b.x-s.player.x,b.y-s.player.y))[0];
        window.qaForageSeeds=s.you.seeds.map(seed=>seed.uid);return w;
      });
      await page.waitForFunction(id=>window.pons3d.plantModels.has('wild'+id),target.id);
      await page.evaluate(w=>{window.qaForageRoot=window.pons3d.plantModels.get('wild'+w.id).root;window.pons.onTap(w.x,w.y);},target);
      await page.waitForFunction(id=>!window.pons.wilds.has(id) && window.pons.you.seeds.length===window.qaForageSeeds.length+1,target.id,{timeout:90000});
      const seed=await page.evaluate(()=>window.pons.you.seeds.find(seed=>!window.qaForageSeeds.includes(seed.uid)));
      assert.equal(seed.speciesId,target.speciesId);assert.equal(seed.tier,target.tier);
      await page.waitForFunction(id=>!window.pons3d.plantModels.has('wild'+id),target.id);
      assert(await page.evaluate(()=>window.qaForageRoot.parent===null && window.qaForageRoot.children.length===0));
      await page.screenshot({path:path.join(directory,'forage-complete.png')});
      await page.reload();await page.waitForFunction(uid=>window.pons?.you?.seeds.some(s=>s.uid===uid),seed.uid);
      assert(await page.evaluate(uid=>window.pons.you.seeds.filter(s=>s.uid===uid).length===1,seed.uid));
      assert.deepEqual(errors,[]);console.log(JSON.stringify({directory,target,seed,result:'PASS server-spawned wild, real path/forage, one matching seed, model cleanup and reload',errors}));return;
    }
    if(process.argv.includes('--legacy-clock')){
      const url=new URL(page.url());url.searchParams.set('r','2d');await page.goto(url.href);
      await page.waitForFunction(()=>window.pons?.lots && [...window.pons.lots.values()].some(v=>v.gnome?.getData('patrolAt')>1e12));
      assert(await page.evaluate(()=>{
        const s=window.pons,v=[...s.lots.values()].find(v=>v.gnome),stamp=v.gnome.getData('patrolAt'),a=stamp/1500;
        return Math.abs(Date.now()-stamp-3600000)<2000 &&
          Math.abs(v.gnome.x-(v.geo.center.x+Math.cos(a)*52))<1e-6 &&
          Math.abs(v.gnome.y-(v.geo.center.y+Math.sin(a)*40))<1e-6;
      }));
      assert.deepEqual(errors,[]);console.log(JSON.stringify({directory,result:'PASS legacy gnome patrol follows server epoch despite one-hour browser wall-clock skew',errors}));return;
    }
    if(process.argv.includes('--gates')) {
      await page.waitForFunction(()=>window.pons?.ready && window.pons3d.localAvatar);
      await page.locator('#btn-shop').click();await page.locator('[data-shop="fence"]').click();
      await page.waitForFunction(()=>window.pons.you.sap===700 && window.pons3d.decorModels.get('gate'+window.pons.you.id)?.kind==='gate:intact');
      await page.locator('#panel-close').click();
      for(const [state,hp] of [['damaged',1],['broken',0]]){
        await page.evaluate(hp=>{
          const s=window.pons,entry=[...s.lots.values()].find(e=>e.lot.ownerId===s.you.id);
          window.qaGateOld=window.pons3d.decorModels.get('gate'+s.you.id).root;
          entry.lot.defenses={...entry.lot.defenses,gateHp:hp};
        },hp);
        await page.waitForFunction(state=>window.pons3d.decorModels.get('gate'+window.pons.you.id)?.kind==='gate:'+state,state);
        assert(await page.evaluate(()=>window.qaGateOld.parent===null));
        await page.screenshot({path:path.join(directory,'gate-'+state+'.png')});
      }
      await page.reload();
      await page.waitForFunction(()=>window.pons?.ready && window.pons3d.decorModels.get('gate'+window.pons.you.id)?.kind==='gate:intact');
      assert(await page.evaluate(()=>window.pons.you.sap===700));
      assert.deepEqual(errors,[]);console.log(JSON.stringify({directory,result:'PASS fence purchase/reload and synthetic public gate damage-state projection',errors}));return;
    }
    if(process.argv.includes('--defenses')) {
      await page.waitForFunction(()=>window.pons?.ready && window.pons3d.localAvatar);
      await page.locator('#btn-shop').click();
      await page.locator('[data-shop="gnome"]').click();
      await page.waitForFunction(()=>window.pons.you.defenses.gnome && window.pons.you.sap===2200);
      await page.locator('[data-shop="sprinkler"]').click();
      await page.waitForFunction(()=>window.pons.you.defenses.sprinkler && window.pons.you.sap===1700);
      for(const [hat,sap] of [[0,1500],[1,1150],[2,950]]){
        await page.evaluate(()=>{window.qaOldGnome=window.pons3d.decorModels.get('gnome'+window.pons.you.id).root;});
        await page.locator(`[data-cos="ghat${hat}"]`).click();
        await page.waitForFunction(({hat,sap})=>window.pons.you.sap===sap && window.pons3d.decorModels.get('gnome'+window.pons.you.id)?.kind==='gnome:'+hat,{hat,sap});
        assert(await page.evaluate(()=>window.qaOldGnome.parent===null));
      }
      await page.locator('#panel-close').click();
      assert(await page.evaluate(()=>{
        const id=window.pons.you.id,r=window.pons3d;
        return r.decorModels.has('sprinkler'+id) && !r.actors.has('sprinkler'+id) && !r.actors.has('gnome'+id) && !r.actors.has('ghat'+id);
      }));
      await page.screenshot({path:path.join(directory,'defense-models.png')});
      assert(await page.evaluate(()=>{
        const s=window.pons,r=window.pons3d,root=r.decorModels.get('gnome'+s.you.id).root;
        const c=[...s.lots.values()].find(v=>v.lot.ownerId===s.you.id).geo.center;
        const stamp=root.userData.patrolAt,a=stamp/1500;
        return stamp>1e12 && Math.abs(stamp-s.serverClock.now())<1000 &&
          Math.abs(root.position.x*32-(c.x+Math.cos(a)*52))<1e-6 &&
          Math.abs(root.position.z*32-(c.y+Math.sin(a)*40))<1e-6;
      }),'gnome render position must follow server epoch patrol phase');
      await page.reload();
      await page.waitForFunction(()=>window.pons?.ready && window.pons3d.decorModels.get('gnome'+window.pons.you.id)?.kind==='gnome:2');
      assert(await page.evaluate(()=>window.pons.you.sap===950 && window.pons.you.defenses.sprinkler));
      assert.deepEqual(errors,[]);console.log(JSON.stringify({directory,result:'PASS real gnome/sprinkler/three hat purchases, replacement and persistence',errors}));return;
    }
    if(process.argv.includes('--cosmetics')) {
      await page.waitForFunction(()=>window.pons?.ready && window.pons3d.localAvatar);
      assert(await page.evaluate(()=>window.pons3d.decorModels.size===0));
      await page.locator('#btn-shop').click();
      await page.locator('[data-cos="lantern"]').click();
      await page.waitForFunction(()=>window.pons.you.cosmetics.lantern && window.pons.you.sap===750);
      await page.locator('[data-cos="nameplate"]').click();
      await page.waitForFunction(()=>window.pons.you.cosmetics.nameplate && window.pons.you.sap===600);
      await page.locator('#panel-close').click();
      await page.waitForFunction(()=>window.pons3d.decorModels.size===3);
      assert(await page.evaluate(()=>{
        const r=window.pons3d;
        return [...r.decorModels].every(([id,m])=>!r.actors.has(id) && m.root.parent===r.scene && m.root.scale.x===(m.kind==='lamp'?.75:1));
      }));
      await page.evaluate(()=>{window.qaCosTarget={x:window.pons.player.x,y:window.pons.player.y+80};window.pons.onTap(window.qaCosTarget.x,window.qaCosTarget.y);});
      await page.waitForFunction(()=>Math.hypot(window.pons.player.x-window.qaCosTarget.x,window.pons.player.y-window.qaCosTarget.y)<20,{},{timeout:15000});
      await page.screenshot({path:path.join(directory,'cosmetics-models.png')});
      await page.reload();
      await page.waitForFunction(()=>window.pons?.ready && window.pons3d.decorModels.size===3);
      assert(await page.evaluate(()=>window.pons.you.cosmetics.lantern && window.pons.you.cosmetics.nameplate && window.pons.you.sap===600));
      // Render-only removal of the lot, as when it leaves the current world.
      await page.evaluate(()=>{
        const s=window.pons;window.qaLots=[...s.lots];window.qaCosRoots=[...window.pons3d.decorModels.values()].map(p=>p.root);
        window.qaCosResources=0;window.qaCosDisposed=0;
        for(const root of window.qaCosRoots)root.traverse(o=>{if(o.isMesh)for(const resource of [o.geometry,...(Array.isArray(o.material)?o.material:[o.material])]){
          window.qaCosResources++;resource.addEventListener('dispose',()=>window.qaCosDisposed++);
        }});s.lots.clear();
      });
      await page.waitForFunction(()=>window.pons3d.decorModels.size===0);
      assert(await page.evaluate(()=>window.qaCosRoots.every(r=>r.parent===null) && window.qaCosDisposed===window.qaCosResources && window.qaCosResources>0));
      await page.evaluate(()=>{for(const [id,lot] of window.qaLots)window.pons.lots.set(id,lot);});
      await page.waitForFunction(()=>window.pons3d.decorModels.size===3);
      assert.deepEqual(errors,[]);console.log(JSON.stringify({directory,result:'PASS real cosmetic purchases, exact Sap charges, model projection, reload and synthetic lot removal/reappearance',errors}));return;
    }
    if(process.argv.includes('--plaza')) {
      await page.waitForFunction(()=>window.pons?.ready && window.pons3d.localAvatar);
      await page.evaluate(()=>window.pons.onTap(51*32+16,34*32+16));
      await page.waitForFunction(()=>Math.hypot(window.pons.player.x-(51*32+16),window.pons.player.y-(34*32+16))<26,{},{timeout:30000});
      assert(await page.evaluate(()=>{
        const r=window.pons3d,s=window.pons,kinds=['lamp','fountain','bench','board','stall','sign','pot','track'];
        return kinds.every(kind=>s.village.props.some(p=>p.kind===kind)) &&
          s.village.props.every((p,i)=>!kinds.includes(p.kind) || (r.plazaModels.get('prop'+i)?.parent===r.scene && !r.actors.has('prop'+i)));
      }));
      await page.screenshot({path:path.join(directory,'plaza-models.png')});
      await page.evaluate(()=>window.pons.onTap(58*32+16,42*32+16));
      await page.waitForFunction(()=>Math.hypot(window.pons.player.x-(58*32+16),window.pons.player.y-(42*32+16))<26,{},{timeout:30000});
      await page.screenshot({path:path.join(directory,'fountain-model.png')});
      assert.deepEqual(errors,[]);console.log(JSON.stringify({directory,result:'PASS real path into plaza and eight prop families without billboards',errors}));return;
    }
    if(process.argv.includes('--decor')) {
      await page.waitForFunction(()=>window.pons?.ready && window.pons3d.localAvatar);
      // Render-only public-land fixture, not a wallet or broker ownership claim.
      await page.evaluate(()=>{
        const s=window.pons,entry=[...s.lots.values()].find(e=>e.lot.ownerId===s.you.id);
        window.qaDecorLand=entry.lot.land;
        entry.lot.land={...entry.lot.land,witherMarks:1,decorFlora:3};
      });
      await page.waitForFunction(()=>window.pons3d.decorModels.size===4);
      assert(await page.evaluate(()=>{
        const r=window.pons3d;
        return [...r.decorModels].every(([id,p])=>p.root.parent===r.scene && !r.actors.has(id));
      }));
      await page.screenshot({path:path.join(directory,'decor-models.png')});
      await page.evaluate(()=>{
        const s=window.pons;window.qaDecorRoots=[...window.pons3d.decorModels.values()].map(p=>p.root);
        window.qaDecorResources=0;window.qaDecorDisposed=0;
        for(const root of window.qaDecorRoots)root.traverse(o=>{if(o.isMesh){
          for(const resource of [o.geometry,...(Array.isArray(o.material)?o.material:[o.material])]){
            window.qaDecorResources++;resource.addEventListener('dispose',()=>window.qaDecorDisposed++);
          }
        }});
        [...s.lots.values()].find(e=>e.lot.ownerId===s.you.id).lot.land=window.qaDecorLand;
      });
      await page.waitForFunction(()=>window.pons3d.decorModels.size===0);
      assert(await page.evaluate(()=>window.qaDecorRoots.every(root=>root.parent===null) && window.qaDecorResources>0 && window.qaDecorDisposed===window.qaDecorResources));
      assert.deepEqual(errors,[]);console.log(JSON.stringify({directory,result:'PASS synthetic public-land scenery projection and removal',errors}));return;
    }
    if(process.argv.includes('--tend-weeds')) {
      await page.waitForFunction(()=>window.pons?.ready && window.pons3d.decorModels.has(window.pons.you.id+':0weed'));
      await page.waitForFunction(()=>Number(document.getElementById('sps').textContent)>0);
      const weedyRate=await page.evaluate(()=>Number(document.getElementById('sps').textContent));
      const before=await page.evaluate(()=>{
        const s=window.pons,own=s.lots.get(s.you.id),p=own.geo.plots[0];
        window.qaWeedRoot=window.pons3d.decorModels.get(s.you.id+':0weed').root;
        s.goTo({x:p.tx*32+16,y:p.ty*32+40});
        return s.you.plots[0].lastWeeded;
      });
      await page.waitForFunction(()=>!window.pons.moving && window.pons.path.length===0,null,{timeout:60000});
      const clickPlot=async()=>{
        const point=await page.evaluate(()=>{
          const s=window.pons,r=window.pons3d,p=s.lots.get(s.you.id).geo.plots[0];
          const v=r.camera.position.clone().set(p.tx+.5,0,p.ty+.5).project(r.camera);
          const rect=r.renderer.domElement.getBoundingClientRect();
          return {x:rect.left+(v.x+1)*rect.width/2,y:rect.top+(1-v.y)*rect.height/2};
        });
        assert(point.x>0 && point.x<1280 && point.y>0 && point.y<900);
        await page.mouse.click(point.x,point.y);
      };
      await page.screenshot({path:path.join(directory,'tend-before.png')});
      await clickPlot();
      await page.waitForFunction(before=>window.pons.you.plots[0].lastWeeded>before,before);
      await page.waitForFunction(()=>!window.pons3d.decorModels.has(window.pons.you.id+':0weed'));
      await page.waitForFunction(rate=>Number(document.getElementById('sps').textContent)===rate*2,weedyRate);
      assert(await page.evaluate(()=>window.qaWeedRoot.parent===null && !window.pons.lots.get(window.pons.you.id).lot.plots[0].weedy));
      const tended=await page.evaluate(()=>window.pons.you.plots[0].lastWeeded);
      await clickPlot();
      await page.waitForTimeout(500);
      assert.equal(await page.evaluate(()=>window.pons.you.plots[0].lastWeeded),tended,'Cooldown must prevent repeated tending');
      await page.reload();
      await page.waitForFunction(tended=>window.pons?.ready && window.pons.you.plots[0].lastWeeded===tended,tended);
      assert(await page.evaluate(()=>!window.pons.lots.get(window.pons.you.id).lot.plots[0].weedy && !window.pons3d.decorModels.has(window.pons.you.id+':0weed')));
      await page.screenshot({path:path.join(directory,'tend-reloaded.png')});
      assert.deepEqual(errors,[]);
      console.log(JSON.stringify({directory,weedyRate,restoredRate:weedyRate*2,result:'PASS aged saved plant, normal path and perspective click tending, restored income rate, public weeds/model removal, cooldown and reconnect',errors}));
      return;
    }
    if(process.argv.includes('--plants')) {
      await page.waitForFunction(count => window.pons?.ready && window.pons3d.plantModels.size>=count,modelSpecies.length);
      assert(await page.evaluate(count => window.pons.you.plots.slice(0,count).every((p,i)=>{
        const id=window.pons.you.id+':'+i,r=window.pons3d;
        return r.plantModels.get(id)?.key===p.speciesId+':4' && !r.actors.has(id);
      }),modelSpecies.length));
      await page.screenshot({path:path.join(directory,'plant-models.png')});
      if(process.argv.includes('--face-idle')){
        for(const field of ['idleBrow','idleEyes']){
          await page.waitForFunction(field=>[...window.pons3d.plantModels.values()].some(p=>{
            const part=p.root.userData[field];return part && (field==='idleBrow'?part.position.y>.03:part.scale.y<.5);
          }),field,{timeout:16000});
        }
        await page.emulateMedia({reducedMotion:'reduce'});
        await page.waitForFunction(()=>{
          const roots=[...window.pons3d.plantModels.values()].map(p=>p.root);
          const brow=roots.find(r=>r.userData.idleBrow)?.userData.idleBrow;
          const eyes=roots.find(r=>r.userData.idleEyes)?.userData.idleEyes;
          return brow?.position.y===0 && eyes?.scale.y===1;
        });
        await page.emulateMedia({reducedMotion:'no-preference'});
        await page.waitForFunction(()=>[...window.pons3d.plantModels.values()].some(p=>p.root.userData.idleBrow?.position.y>.03),null,{timeout:16000});
        await page.screenshot({path:path.join(directory,'face-idles.png')});
      }
      if(process.argv.includes('--idle')){
        await page.waitForFunction(()=>[...window.pons3d.plantModels.values()].some(p=>p.root.userData.idleBody?.rotation.x>.03),null,{timeout:16000});
        const moving=await page.evaluate(()=>{
          const root=[...window.pons3d.plantModels.values()].find(p=>p.root.userData.idleBody).root;
          return {nod:root.userData.idleBody.rotation.x,soil:root.children.filter(c=>c!==root.userData.idleBody).map(c=>c.rotation.toArray())};
        });
        assert(moving.nod>0 && moving.nod<=.18);
        await page.screenshot({path:path.join(directory,'tulip-nod.png')});
        await page.emulateMedia({reducedMotion:'reduce'});
        await page.waitForFunction(()=>[...window.pons3d.plantModels.values()].filter(p=>p.root.userData.idleBody).every(p=>p.root.userData.idleBody.rotation.x===0));
        assert.deepEqual(await page.evaluate(()=>{
          const root=[...window.pons3d.plantModels.values()].find(p=>p.root.userData.idleBody).root;
          return root.children.filter(c=>c!==root.userData.idleBody).map(c=>c.rotation.toArray());
        }),moving.soil);
        await page.emulateMedia({reducedMotion:'no-preference'});
        await page.waitForFunction(()=>[...window.pons3d.plantModels.values()].some(p=>p.root.userData.idleBody?.rotation.x>.03),null,{timeout:16000});
      }
      if(process.argv.includes('--weeds')){
        // Render-only public condition transition; not a real tending verification.
        await page.evaluate(()=>{const s=window.pons;s.lots.get(s.you.id).lot.plots[0].weedy=true;});
        await page.waitForFunction(()=>window.pons3d.decorModels.has(window.pons.you.id+':0weed'));
        assert(await page.evaluate(()=>{
          const r=window.pons3d,id=window.pons.you.id+':0weed',root=r.decorModels.get(id).root;
          window.qaWeedRoot=root;window.qaWeedDisposed=0;window.qaWeedResources=0;
          root.traverse(o=>{if(o.isMesh)for(const resource of [o.geometry,o.material]){
            window.qaWeedResources++;resource.addEventListener('dispose',()=>window.qaWeedDisposed++);
          }});
          return root.parent===r.scene && root.children.length===10 && !r.actors.has(id);
        }));
        await page.screenshot({path:path.join(directory,'weeds-3d.png')});
        await page.evaluate(()=>{const s=window.pons;s.lots.get(s.you.id).lot.plots[0].weedy=false;});
        await page.waitForFunction(()=>!window.pons3d.decorModels.has(window.pons.you.id+':0weed'));
        assert(await page.evaluate(()=>window.qaWeedRoot.parent===null && window.qaWeedDisposed===window.qaWeedResources));
      }
      if(process.argv.includes('--benchmark')){
        const metrics=await page.evaluate(async()=>{
          const intervals=[];let last=performance.now();
          for(let i=0;i<120;i++)await new Promise(resolve=>requestAnimationFrame(t=>{intervals.push(t-last);last=t;resolve();}));
          intervals.sort((a,b)=>a-b);
          const r=window.pons3d;
          return {frames:intervals.length,medianFrameMs:intervals[60],p95FrameMs:intervals[114],drawCalls:r.renderer.info.render.calls,triangles:r.renderer.info.render.triangles,geometries:r.renderer.info.memory.geometries,
            plants:[...r.plantModels.values()].map(p=>({key:p.key,meshes:p.root.children.length}))};
        });
        fs.writeFileSync(path.join(directory,'render-metrics.json'),JSON.stringify(metrics,null,2));console.log(JSON.stringify({directory,metrics}));
      }
      // Synthetic render-only wild fixture; does not claim a real forage action.
      await page.evaluate(() => {
        const s=window.pons;s.wilds.set('visual-wild',{w:{id:'visual-wild',speciesId:'clammy_pete',tier:'common',x:s.player.x+32,y:s.player.y,until:Date.now()+60000}});
      });
      await page.waitForFunction(() => window.pons3d.plantModels.has('wildvisual-wild'));
      assert(await page.evaluate(() => !window.pons3d.actors.has('wildvisual-wild')));
      await page.evaluate(() => {window.qaWildRoot=window.pons3d.plantModels.get('wildvisual-wild').root;window.pons.wilds.delete('visual-wild');});
      await page.waitForFunction(() => !window.pons3d.plantModels.has('wildvisual-wild'));
      assert(await page.evaluate(() => window.qaWildRoot.parent===null && window.qaWildRoot.children.length===0));
      if(process.argv.includes('--lifecycle')){
        const samples=[];
        for(let cycle=0;cycle<44;cycle++){
          const species=allModelSpecies[cycle%allModelSpecies.length];
          await page.evaluate(species=>{
            const s=window.pons;
            s.wilds.set('lifecycle',{w:{id:'lifecycle',speciesId:species,tier:'common',x:s.player.x+32,y:s.player.y,until:Date.now()+60000}});
          },species);
          await page.waitForFunction(species=>window.pons3d.plantModels.get('wildlifecycle')?.key===species+':2',species);
          const result=await page.evaluate(async()=>{
            const r=window.pons3d,root=r.plantModels.get('wildlifecycle').root;
            let expected=0,disposed=0;
            root.traverse(o=>{if(o.isMesh){expected++;o.geometry.addEventListener('dispose',()=>disposed++);}});
            for(const material of root.userData.materials){expected++;material.addEventListener('dispose',()=>disposed++);}
            const before=r.renderer.info.memory.geometries;
            window.pons.wilds.delete('lifecycle');
            await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
            return {expected,disposed,detached:root.parent===null,cleared:root.children.length===0 && root.userData.materials.length===0,
              removed:!r.plantModels.has('wildlifecycle'),before,after:r.renderer.info.memory.geometries};
          });
          assert(result.expected>0 && result.expected===result.disposed && result.detached && result.cleared && result.removed);
          samples.push({cycle,species,...result});
        }
        fs.writeFileSync(path.join(directory,'plant-lifecycle.json'),JSON.stringify(samples,null,2));
        console.log(JSON.stringify({directory,result:'PASS 44 render-only creation/removal cycles across all 22 species; every owned geometry/material disposed',first:samples[0],last:samples.at(-1)}));
      }
      assert.deepEqual(errors,[]);console.log(JSON.stringify({directory,species:modelSpecies.length,result:'PASS saved species projected into 3D plot models without billboards; synthetic wild projection/cleanup',errors}));return;
    }
    if (gardenMode) {
      await page.waitForFunction(() => window.pons?.ready);
      await page.locator('#btn-conveyor').click(); await page.locator('[data-buy="0"]').click();
      await page.waitForFunction(() => window.pons.you.seeds.length === 1);
      assert.equal(await page.evaluate(() => window.pons.you.seeds[0].tier),'common');
      await page.locator('#btn-seeds').click();
      const seedButton = page.locator('button[data-seed]');
      assert(await seedButton.getAttribute('aria-label'));
      await seedButton.focus();
      if (focusMode) {
        for (let i=0;i<30;i++) {
          const result = await page.evaluate(() => {
            const button=document.querySelector('button[data-seed]');
            const before=document.activeElement===button;
            window.pons.hud.refresh();
            return {before,after:document.activeElement===document.querySelector('button[data-seed]'),active:document.activeElement?.tagName};
          });
          assert(result.before && result.after,`Focus iteration ${i}: ${JSON.stringify(result)}`);
          await page.waitForTimeout(100);
        }
        await page.evaluate(() => { window.qaUiInteractions=0; window.pons.interactNearest=()=>window.qaUiInteractions++; });
        await page.keyboard.press(process.argv.includes('--space') ? 'Space' : 'Enter');
        await page.waitForFunction(() => !!window.pons.selectedSeed && document.getElementById('panel').hidden);
        assert.equal(await page.evaluate(() => window.qaUiInteractions),0,'UI activation leaked into game interaction');
        assert.deepEqual(errors,[]);
        console.log(JSON.stringify({directory,key:process.argv.includes('--space')?'Space':'Enter',result:'PASS 30 forced panel refreshes retain seed focus; keyboard selection does not trigger game interaction',errors}));
        return;
      }
      await page.waitForTimeout(1500); // span real state pushes while reading the card
      const focus=await page.evaluate(()=>{
        const current=document.querySelector('button[data-seed]');
        return {focused:!!current && document.activeElement===current,active:document.activeElement?.outerHTML.slice(0,300),seed:current?.outerHTML.slice(0,300)};
      });
      assert(focus.focused,JSON.stringify({reason:'State refresh dropped seed keyboard focus',...focus}));
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => !!window.pons.selectedSeed && document.getElementById('panel').hidden);
      await page.evaluate(() => { const s=window.pons, own=[...s.lots.values()].find(v=>v.lot.ownerId===s.you.id), p=own.geo.plots[0]; s.goTo({x:p.tx*32+16,y:p.ty*32+40}); });
      await page.waitForFunction(() => !window.pons.moving && window.pons.path.length===0,null,{timeout:60000});
      await page.waitForTimeout(500);
      const clickPlot = async () => {
        const point = await page.evaluate(() => {
          const s=window.pons, v=window.pons3d, own=[...s.lots.values()].find(v=>v.lot.ownerId===s.you.id), p=own.geo.plots[0];
          const projected=v.camera.position.clone().set(p.tx+0.5,0,p.ty+0.5).project(v.camera);
          const r=v.renderer.domElement.getBoundingClientRect(); return {x:r.left+(projected.x+1)*r.width/2,y:r.top+(1-projected.y)*r.height/2};
        });
        assert(point.x>0 && point.x<1280 && point.y>0 && point.y<900,'Plot not in camera view');
        await page.mouse.click(point.x,point.y);
      };
      await clickPlot(); await page.waitForFunction(() => !!window.pons.you.plots[0]);
      const planted = await page.evaluate(() => ({uid:window.pons.you.plots[0].uid,growMs:window.pons.you.plots[0].growMs}));
      assert.equal(planted.growMs,30000); assert.equal(await page.evaluate(() => window.pons.you.seeds.length),0);
      await clickPlot(); await page.waitForFunction(() => window.pons.you.plots[0].watered);
      assert(await page.evaluate(before => window.pons.you.plots[0].growMs<before,planted.growMs));
      await page.locator('#modal-ok').waitFor({timeout:35000}); await page.locator('#modal-ok').click();
      await page.waitForFunction(() => Number(document.getElementById('sps').textContent)>0);
      await page.reload(); await page.waitForFunction(uid => window.pons?.you?.plots[0]?.uid===uid && window.pons.you.plots[0].revealed,planted.uid);
      await page.screenshot({path:path.join(directory,'perspective-garden.png')});
      assert.deepEqual(errors,[]); console.log(JSON.stringify({directory,result:'PASS starter seed purchase, bag selection, perspective ground click, planting, watering, real growth/reveal, income and reconnect',errors}));
      return;
    }
    if (process.argv.includes('--perspective')) {
      await page.waitForFunction(() => window.pons?.ready && window.pons3d?.camera.isPerspectiveCamera);
      const yaw = await page.evaluate(() => window.pons.inputYaw);
      await page.keyboard.down('q'); await page.waitForTimeout(400); await page.keyboard.up('q');
      assert(await page.evaluate(start => window.pons.inputYaw > start+0.1,yaw));
      const before = await page.evaluate(() => ({ yaw:window.pons.inputYaw, path:JSON.stringify(window.pons.path) }));
      await page.mouse.move(900,400); await page.mouse.down({button:'right'});
      await page.mouse.move(1040,440,{steps:8}); await page.mouse.up({button:'right'});
      const after = await page.evaluate(() => ({ yaw:window.pons.inputYaw, path:JSON.stringify(window.pons.path), lost:window.pons3d.renderer.getContext().isContextLost() }));
      assert(after.yaw < before.yaw-0.1); assert.equal(after.path,before.path); assert.equal(after.lost,false);
      await page.locator('#btn-shop').click(); await page.locator('[data-hat="2"]').evaluate(e => e.scrollIntoView({block:'center'}));
      await page.locator('[data-hat="2"]').click(); await page.locator('#sap').filter({hasText:/^200$/}).waitFor();
      await page.locator('#panel-close').click();
      if (process.argv.includes('--wander')) {
        await page.waitForFunction(() => window.pons3d.localAvatar?.root.visible && window.pons3d.localAvatar.hatStyle === 'top');
        const avatarCheck = await page.evaluate(() => {
          const r = window.pons3d, a = r.localAvatar;
          return { x:a.root.position.x, z:a.root.position.z, px:window.pons.player.x/32, pz:window.pons.player.y/32,
            sprite:r.actors.has('player'+window.pons.you.id), storage:Object.keys(localStorage).filter(k => /wander|equipment|appearance/i.test(k)) };
        });
        assert.equal(avatarCheck.x,avatarCheck.px); assert.equal(avatarCheck.z,avatarCheck.pz);
        assert.equal(avatarCheck.sprite,false); assert.deepEqual(avatarCheck.storage,[]);
      }
      await page.screenshot({path:path.join(directory,'perspective-desktop.png')});
      await page.setViewportSize({width:390,height:844});
      await page.evaluate(() => { window.qaGroundTaps = 0; window.pons.onTap = () => window.qaGroundTaps++; });
      const touchSession = await context.newCDPSession(page);
      const touchYaw = await page.evaluate(() => window.pons.inputYaw);
      await touchSession.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:250,y:300,id:1}]});
      await touchSession.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:310,y:340,id:1}]});
      await touchSession.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      assert(await page.evaluate(start => window.pons.inputYaw < start-0.1,touchYaw));
      assert.equal(await page.evaluate(() => window.qaGroundTaps),0,'Touch orbit sent a destination');
      await page.touchscreen.tap(250,300);
      assert.equal(await page.evaluate(() => window.qaGroundTaps),1,'Touch tap did not select ground');
      await touchSession.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:250,y:300,id:2}]});
      await touchSession.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      assert.equal(await page.evaluate(() => window.qaGroundTaps),1,'Cancelled touch selected ground');
      await page.touchscreen.tap(250,300);
      assert.equal(await page.evaluate(() => window.qaGroundTaps),2,'Cancelled touch retained pointer ownership');
      await page.screenshot({path:path.join(directory,'perspective-mobile.png')});
      assert.deepEqual(errors,[]);
      console.log(JSON.stringify({directory,result:'PASS perspective projection, keyboard orbit, right-drag without path intent, wardrobe purchase',errors}));
      return;
    }
    if (process.argv.includes('--oracle')) {
      await page.waitForFunction(() => window.pons?.ready);
      if (process.argv.includes('--wander')) {
        await page.waitForFunction(() => window.pons3d.modeledBuildings.size===5);
        assert(await page.evaluate(() => {
          const s=window.pons,r=window.pons3d;
          const kinds=['lamp','fountain','bench','board','stall','sign','pot','track'];
          const plaza=s.village.props.filter(p=>kinds.includes(p.kind));
          const solids=s.village.props.filter(p=>p.kind.startsWith('bld_') || (kinds.includes(p.kind)&&p.solid));
          return s.village.props.every((p,i)=>!(p.kind.startsWith('bld_')||kinds.includes(p.kind)) || !r.actors.has('prop'+i))
            && r.buildings.children.every(o=>o.name.startsWith('building-')) && r.cameraSolids.length===solids.length
            && r.plazaModels.size===plaza.length && plaza.length>0
            && [...r.plazaModels.values()].every(o=>o.parent===r.scene);
        }));
        await page.waitForFunction(() => window.pons3d.npcAvatars.size === 6);
        assert(await page.evaluate(() => {
          const s=window.pons,r=window.pons3d;
          return s.village.props.filter(p=>p.kind.startsWith('tree')).length>0
            && s.village.props.every((p,i)=>!p.kind.startsWith('tree') ||
              (!r.actors.has('prop'+i) && r.treeModels.get('prop'+i)?.root.parent===r.scene));
        }));
        assert(await page.evaluate(() => {
          const r = window.pons3d;
          return [...r.npcAvatars].every(([id,a]) => !r.actors.has(id) && a.root.parent === r.scene)
            && [...r.npcAvatars.values()].find(a => a.root.name === 'pons-npc-seedwife').asset.state.bodyColor === '#469640';
        }));
      }
      await page.evaluate(() => {
        const s = window.pons, ada = s.village.npcs.find(n => n.id === 'seedwife');
        s.onTap(ada.tx * 32 + 16, ada.ty * 32 + 16);
      });
      const input = page.locator('#npc-ask'); await input.waitFor({ timeout: 90000 });
      await input.focus(); await input.pressSequentially('How do I plant a seed?', { delay: 100 });
      assert.equal(await input.inputValue(), 'How do I plant a seed?', 'State refresh interrupts NPC question typing');
      await page.locator('#npc-ask-go').click();
      await page.locator('#npc-say').filter({ hasText: 'opening Bag' }).waitFor({ timeout: 25000 });
      await page.waitForTimeout(1200);
      assert((await page.locator('#npc-say').innerText()).includes('empty plot'), 'Periodic refresh erased NPC answer');
      await page.evaluate(() => window.pons.hud.say('Warden Pell', 'Unrelated late answer', 'warden'));
      assert(!(await page.locator('#npc-say').innerText()).includes('Unrelated'), 'A different NPC overwrote the active dialogue');
      await input.fill('My next question'); await page.locator('#panel-title').click();
      await page.waitForTimeout(1200);
      assert.equal(await input.inputValue(), 'My next question', 'Blurred question draft was lost on refresh');
      // Hold transport to exercise missing and out-of-order replies deterministically.
      await page.evaluate(() => { window.qaAsk = window.pons.ask; window.qaRequests = []; window.pons.ask = (...args) => window.qaRequests.push(args); });
      await page.locator('#npc-ask-go').click();
      await input.fill('A newer question'); await page.locator('#npc-ask-go').click();
      await page.evaluate(() => { const h = window.pons.hud, r = window.qaRequests; h.say('Seedwife Ada', 'Old response', 'seedwife', r[0][2]); });
      assert.equal(await page.locator('#npc-say').innerText(), '...');
      await page.evaluate(() => { const r = window.qaRequests; window.pons.hud.say('Seedwife Ada', 'Current response', 'seedwife', r[1][2]); });
      assert((await page.locator('#npc-say').innerText()).includes('Current response'));
      await input.fill('An unanswered question'); await page.locator('#npc-ask-go').click();
      await page.locator('#npc-say').filter({ hasText:'No reply arrived' }).waitFor({ timeout:28000 });
      await page.evaluate(() => { const r = window.qaRequests; window.pons.hud.say('Seedwife Ada', 'Too late', 'seedwife', r[2][2]); window.pons.ask = window.qaAsk; });
      assert((await page.locator('#npc-say').innerText()).includes('No reply arrived'));
      if(process.argv.includes('--wander'))assert(await page.evaluate(()=>{
        const rects=[...window.pons3d.labels.values()].filter(l=>!l.el.hidden).map(l=>l.el.getBoundingClientRect());
        return rects.length>1 && rects.every((a,i)=>rects.slice(i+1).every(b=>a.right<=b.left || b.right<=a.left || a.bottom<=b.top || b.bottom<=a.top));
      }),'visible world labels must not overlap');
      await page.screenshot({ path: path.join(directory, 'oracle-planting.png') });
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ directory, result: 'PASS HD-2D path to Ada, question typing, real Oracle planting reply and reply persistence across updates', errors }));
      return;
    }
    if (raidMode) {
      await page.waitForFunction(() => window.pons?.ready);
      const otherContext = await browser.newContext({ viewport: { width: 960, height: 720 } });
      await otherContext.addInitScript(identity => localStorage.setItem('pons.identity.v1', JSON.stringify(identity)), raiderIdentity);
      const other = await otherContext.newPage(); other.on('pageerror', e => errors.push(e.message));
      await other.goto(page.url()); await other.waitForFunction(() => window.pons?.ready);
      if(process.argv.includes('--gate-raid')){
        await page.locator('#btn-shop').click();await page.locator('[data-shop="fence"]').click();
        await page.waitForFunction(()=>window.pons.you.defenses.gateHp===3 && window.pons.you.sap===700);
        await page.locator('#panel-close').click();
        await page.evaluate(()=>{const s=window.pons;s.onTap(s.village.spawn.x,s.village.spawn.y);});
        await page.waitForFunction(()=>window.pons.path.length===0 && !window.pons.moving,null,{timeout:60000});
        await other.waitForFunction(id=>[...window.pons.lots.values()].some(v=>v.lot.ownerId===id && !v.lot.shielded),identity.id);
        for(const hp of [2,1,0]){
          await other.evaluate(id=>{
            const s=window.pons,e=[...s.lots.values()].find(v=>v.lot.ownerId===id);
            s.onTap(e.geo.gate.tx*32+16,e.geo.gate.ty*32+16);
          },identity.id);
          await page.waitForFunction(hp=>window.pons.you.defenses.gateHp===hp,hp,{timeout:60000});
          for(const client of [page,other])await client.waitForFunction(({id,hp})=>window.pons3d.decorModels.get('gate'+id)?.kind===(hp===0?'gate:broken':'gate:damaged'),{id:identity.id,hp});
        }
        await other.screenshot({path:path.join(directory,'gate-raid-broken.png')});
        await page.locator('#btn-shop').click();await page.locator('[data-shop="repair"]').click();
        await page.waitForFunction(()=>window.pons.you.defenses.gateHp===3 && window.pons.you.sap===600);
        for(const client of [page,other])await client.waitForFunction(id=>window.pons3d.decorModels.get('gate'+id)?.kind==='gate:intact',identity.id);
        await other.screenshot({path:path.join(directory,'gate-raid-repaired.png')});
        await page.reload();await page.waitForFunction(()=>window.pons?.ready && window.pons.you.defenses.gateHp===3 && window.pons.you.sap===600);
        assert.deepEqual(errors,[]);console.log(JSON.stringify({directory,result:'PASS real two-client three-hit gate break, owner repair, both-client model updates and reload',errors}));return;
      }
      if (perspectiveRaid) {
        assert(await page.evaluate(() => window.pons3d.camera.isPerspectiveCamera));
        assert(await other.evaluate(() => window.pons3d.camera.isPerspectiveCamera));
      }
      if (process.argv.includes('--wander')) {
        for (const [client, remoteId] of [[page,raiderIdentity.id],[other,identity.id]]) {
          await client.waitForFunction(id => window.pons3d.remoteAvatars.get(id)?.root.visible,remoteId);
          assert(await client.evaluate(id => {
            const r = window.pons3d, a = r.remoteAvatars.get(id), p = r.remotePositions.get(id);
            return !r.actors.has('player'+id) && Math.abs(a.root.position.x-p.x/32)<0.001 && Math.abs(a.root.position.z-p.y/32)<0.001;
          },remoteId));
        }
        await page.locator('#btn-shop').click();
        await page.locator('[data-hat="1"]').click();
        await page.waitForFunction(() => window.pons.you.hat === 1);
        await page.locator('[data-shirt="4"]').click();
        await page.waitForFunction(() => window.pons.you.color === 4);
        await page.locator('#panel-close').click();
        await other.waitForFunction(id => {
          const a = window.pons3d.remoteAvatars.get(id);
          return a?.hatStyle === 'cap' && a.asset.state.bodyColor === '#e88228';
        },identity.id);
      }
      // Read rendered state, then use the actual client's pathfinding/movement.
      if(process.argv.includes('--appearance')) {
        if(process.argv.includes('--skin')){
          await page.locator('#btn-shop').click();
          assert.equal(await page.locator('[data-skin]').count(),6);
          await page.locator('[data-skin="5"]').click();
          await page.waitForFunction(()=>window.pons.you.skin===5 && window.pons3d.localAvatar.asset.state.skinColor==='#54392f');
          await other.waitForFunction(id=>window.pons3d.remoteAvatars.get(id)?.asset.state.skinColor==='#54392f',identity.id);
          const hasSkin=await other.evaluate(id=>{
            let found=false;window.pons3d.remoteAvatars.get(id).root.traverse(o=>{
              for(const m of o.material?Array.isArray(o.material)?o.material:[o.material]:[])if(m.color?.getHexString()==='54392f')found=true;
            });return found;
          },identity.id);
          assert(hasSkin,'Selected tone must reach actual remote mesh materials');
          const previewsReady=()=>page.waitForFunction(()=>{
            const images=[...document.querySelectorAll('[data-outfit] img')];
            return images.length===15 && images.every(img=>img.dataset.previewSkin==='5' && img.complete && img.naturalWidth===128)
              && new Set(images.map(img=>img.src)).size>=8;
          });
          await previewsReady();
          // Distinctness is checked in the same DOM snapshot as readiness;
          // a shop refresh may replace the elements between separate reads.
          const contextsBefore=await page.evaluate(()=>window.qaGraphicsContexts.size);
          for(let i=0;i<3;i++){
            await page.locator('#panel-close').click();await page.locator('#btn-shop').click();await previewsReady();
          }
          assert.equal(await page.evaluate(()=>window.qaGraphicsContexts.size),contextsBefore,'Cached outfits must not allocate new contexts');
          await page.waitForFunction(()=>[...window.qaGraphicsContexts].filter(gl=>!gl.isContextLost()).length===1);
          await page.locator('[data-skin="5"]').evaluate(el=>el.scrollIntoView({block:'nearest'}));
          await page.screenshot({path:path.join(directory,'skin-wardrobe.png')});
          await page.reload();
          await page.waitForFunction(()=>window.pons?.ready && window.pons.you.skin===5 && window.pons3d.localAvatar?.asset.state.skinColor==='#54392f');
          await page.waitForFunction(id=>window.pons3d.remoteAvatars.has(id),raiderIdentity.id);
          await other.waitForFunction(id=>window.pons3d.remoteAvatars.get(id)?.asset.state.skinColor==='#54392f',identity.id);
        }
        if(process.argv.includes('--hair')){
          await page.locator('#btn-shop').click();
          assert.equal(await page.locator('[data-hair]').count(),5);
          const sap=await page.evaluate(()=>window.pons.you.sap);
          const hairGeometry=new Set();
          for(const [hair,style] of ['short','long','bun','ponytail','shaved'].entries()){
            if(hair!==await page.evaluate(()=>window.pons.you.hair))await page.locator(`[data-hair="${hair}"]`).click();
            await page.waitForFunction(({hair,style})=>window.pons.you.hair===hair && window.pons3d.localAvatar.asset.state.hairStyle===style,{hair,style});
            await other.waitForFunction(({id,style})=>window.pons3d.remoteAvatars.get(id)?.asset.state.hairStyle===style,{id:identity.id,style});
            const geometryOf=({id})=>{
              const avatar=id?window.pons3d.remoteAvatars.get(id):window.pons3d.localAvatar,parts=[];
              avatar.root.traverse(o=>{if(o.geometry)parts.push([o.geometry.type,o.geometry.parameters]);});
              return JSON.stringify(parts);
            };
            const geometry=await page.evaluate(geometryOf,{id:null});
            assert.equal(await other.evaluate(geometryOf,{id:identity.id}),geometry,'Remote mesh geometry matches selected local hair');
            hairGeometry.add(geometry);
            await page.waitForFunction(hair=>{
              const images=[...document.querySelectorAll('[data-shirt] img,[data-hat] img')];
              return images.length===10 && images.every(img=>img.dataset.previewHair===String(hair) && img.complete && img.naturalWidth===128);
            },hair);
            assert.equal(await page.evaluate(()=>window.pons.you.sap),sap);
          }
          assert.equal(hairGeometry.size,5,'Every hairstyle changes actual mesh geometry');
          await page.waitForFunction(()=>{
            const images=[...document.querySelectorAll('[data-hair] img')];
            return images.length===5 && images.every(img=>img.complete && img.naturalWidth===128) && new Set(images.map(img=>img.src)).size===5;
          });
          await page.locator('[data-hair="4"]').evaluate(el=>el.scrollIntoView({block:'nearest'}));
          await page.screenshot({path:path.join(directory,'hair-wardrobe.png')});
          await page.reload();
          await page.waitForFunction(()=>window.pons?.ready && window.pons.you.hair===4 && window.pons3d.localAvatar?.asset.state.hairStyle==='shaved');
          await other.waitForFunction(id=>window.pons3d.remoteAvatars.get(id)?.asset.state.hairStyle==='shaved',identity.id);
          await page.waitForFunction(id=>window.pons3d.remoteAvatars.has(id),raiderIdentity.id);
        }
        if(process.argv.includes('--preview-failure')){
          // After reload, the thumbnail module/cache is cold. Deny only secondary
          // contexts; keep the running world context untouched.
          await page.evaluate(()=>{
            window.qaPreviewDenied=0;const original=HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext=function(...args){
              if(this!==window.pons3d.renderer.domElement && /webgl/.test(args[0])){window.qaPreviewDenied++;return null;}
              return original.apply(this,args);
            };
          });
          await page.locator('#btn-shop').click();
          await page.waitForFunction(()=>window.qaPreviewDenied>0);
          const attempts=await page.evaluate(()=>window.qaPreviewDenied);
          assert.equal(await page.locator('[data-outfit] img').count(),0);
          assert.equal(await page.locator('[data-outfit]').count(),15);
          await page.locator('[data-skin="4"]').click();
          await page.waitForFunction(()=>window.pons.you.skin===4 && window.pons3d.localAvatar.asset.state.skinColor==='#8b593e');
          await other.waitForFunction(id=>window.pons3d.remoteAvatars.get(id)?.asset.state.skinColor==='#8b593e',identity.id);
          for(let i=0;i<3;i++){await page.locator('#panel-close').click();await page.locator('#btn-shop').click();}
          await page.waitForTimeout(1200);
          assert.equal(await page.evaluate(()=>window.qaPreviewDenied),attempts,'Failed preview must not retry every refresh');
          await page.locator('#panel-close').click();
          const yaw=await page.evaluate(()=>window.pons.inputYaw);
          await page.keyboard.down('q');await page.waitForTimeout(300);await page.keyboard.up('q');
          assert(await page.evaluate(yaw=>window.pons.inputYaw>yaw && !window.pons3d.renderer.getContext().isContextLost(),yaw));
        }
        const samples=[];
        for(const client of [page,other])samples.push(await client.evaluate(() => {
          const r=window.pons3d, s=window.pons, models=[r.localAvatar,...r.remoteAvatars.values(),...r.npcAvatars.values()];
          const owners=new Map();let shared=false;
          const inspect=a=>{
            const colors=new Set();
            a.root.traverse(o=>{for(const m of o.material ? Array.isArray(o.material)?o.material:[o.material] : []) {
              if(owners.has(m) && owners.get(m)!==a)shared=true;owners.set(m,a);
              if(m.color)colors.add('#'+m.color.getHexString());
            }});
            return {body:a.asset.state.bodyColor,colors:[...colors]};
          };
          const all=models.map(inspect);
          return {id:s.you.id,color:s.you.color,local:all[0],all,shared};
        }));
        for(const sample of samples) {
          assert.equal(sample.shared,false,'Avatar material shared between instances');
          for(const model of sample.all)assert(model.colors.includes(model.body),'Rendered body color differs from appearance');
        }
        assert.equal(samples[0].local.body,'#e88228');assert.equal(samples[1].local.body,'#3c78dc');
        console.log(JSON.stringify({directory,result:'PASS independent avatar materials and rendered wardrobe colors',samples,errors}));
        assert.deepEqual(errors,[]);return;
      }
      // No client/server position assignments or fabricated movement packets.
      await page.evaluate(() => { const s = window.pons; s.onTap(s.village.spawn.x, s.village.spawn.y); });
      await page.waitForFunction(() => window.pons.path.length === 0 && !window.pons.moving, null, { timeout: 60000 });
      await other.waitForFunction(id => [...window.pons.lots.values()].some(v => v.lot.ownerId === id && !v.lot.shielded), identity.id);
      await other.evaluate(id => {
        const s = window.pons, lot = [...s.lots.values()].find(v => v.lot.ownerId === id);
        if (lot.lot.plots[0].nick !== 'Captain Sprout') throw new Error('Remote nickname missing');
        s.onTap(lot.geo.plots[0].tx * 32 + 16, lot.geo.plots[0].ty * 32 + 16);
      }, identity.id);
      await other.waitForFunction(() => !!window.pons.carrying, null, { timeout: 90000 });
      await page.waitForFunction(() => window.pons.you.plots[0] === null);
      if(process.argv.includes('--wander')) {
        await other.waitForFunction(() => window.pons3d.plantModels.has('carry'+window.pons.you.id));
        await page.waitForFunction(id => !window.pons3d.plantModels.has(id+':0'),identity.id);
        assert(await other.evaluate(() => !window.pons3d.actors.has('carry'+window.pons.you.id)));
        for(const client of [page,other]) {
          await client.waitForFunction(id => {
            const p=window.pons3d.plantModels.get('carry'+id);
            const r=window.pons3d, avatar=id===window.pons.you.id?r.localAvatar:r.remoteAvatars.get(id);
            if(!avatar || !p)return false;
            const hands=p.root.position.clone();
            return avatar.carryPosition(hands) && hands.distanceTo(p.root.position)<.001
              && avatar.root.userData.characterRig.arms.every(a=>a.rotation.x===-1.2)
              && p.root.scale.x===1.3 && p.root.userData.materials[0].color.getHex()===0xffdf78;
          },raiderIdentity.id);
        }
        assert.deepEqual(await other.evaluate(() => window.pons.carryingAppearance),{mutation:'golden',size:1.3});
      }
      await other.screenshot({ path: path.join(directory, 'raid-carry.png') });
      if(process.argv.includes('--gnome-raid')){
        await page.locator('#btn-shop').click();await page.locator('[data-shop="gnome"]').click();
        await page.waitForFunction(()=>window.pons.you.defenses.gnome);
        await page.locator('#panel-close').click();
        await other.evaluate(id=>{
          const s=window.pons,e=[...s.lots.values()].find(v=>v.lot.ownerId===id);
          s.goTo({x:e.geo.center.x+52,y:e.geo.center.y});
        },identity.id);
        await other.waitForFunction(()=>!window.pons.carrying,null,{timeout:30000});
        await page.waitForFunction(()=>window.pons.you.plots.some(p=>p?.uid==='qa-plant') && window.pons.you.stats.tags===1);
        for(const client of [page,other]){
          await client.waitForFunction(id=>!window.pons3d.plantModels.has('carry'+id),raiderIdentity.id);
          await client.waitForFunction(id=>window.pons3d.plantModels.get(id+':0')?.key==='gorbulon_sprig:4',identity.id);
        }
        assert(await page.evaluate(()=>{
          const plants=window.pons.you.plots.filter(p=>p?.uid==='qa-plant');
          return plants.length===1 && plants[0].mutation==='golden' && plants[0].size===1.3 && plants[0].nick==='Captain Sprout';
        }));
        assert(await other.evaluate(()=>window.pons.carryingAppearance===null && !window.pons.you.plots.some(p=>p?.uid==='qa-plant')));
        await other.screenshot({path:path.join(directory,'gnome-recovery.png')});
        await page.reload();await page.waitForFunction(()=>window.pons?.you?.plots.some(p=>p?.uid==='qa-plant'));
        assert(await page.evaluate(()=>window.pons.you.plots.filter(p=>p?.uid==='qa-plant').length===1 && window.pons.you.stats.tags===1));
        assert.deepEqual(errors,[]);console.log(JSON.stringify({directory,result:'PASS real theft, purchased gnome patrol tag, exact plant recovery, both-client carry cleanup and reload',errors}));return;
      }
      await other.evaluate(() => {
        const s = window.pons, own = [...s.lots.values()].find(v => v.lot.ownerId === s.you.id);
        s.goTo({ x: own.geo.plots[0].tx * 32 + 16, y: own.geo.plots[0].ty * 32 + 16 });
      });
      await other.waitForFunction(() => window.pons.you.plots.some(p => p?.uid === 'qa-plant'), null, { timeout: 90000 });
      assert.equal(await other.evaluate(() => window.pons.you.plots.find(p => p?.uid === 'qa-plant').nick), 'Captain Sprout');
      await page.waitForFunction(id => [...window.pons.lots.values()].some(v => v.lot.ownerId === id && v.lot.plots.some(p => p.nick === 'Captain Sprout')), raiderIdentity.id);
      if(process.argv.includes('--wander')) for(const client of [page,other]) {
        await client.waitForFunction(id=>{
          const r=window.pons3d, a=id===window.pons.you.id?r.localAvatar:r.remoteAvatars.get(id);
          return a && !r.plantModels.has('carry'+id) && a.root.userData.characterRig.arms.every(arm=>
            Math.abs(arm.rotation.z-Math.sign(arm.position.x)*.16)<.001);
        },raiderIdentity.id);
      }
      await other.reload(); await other.waitForFunction(() => window.pons?.you?.plots.some(p => p?.uid === 'qa-plant'));
      if(process.argv.includes('--wander')) {
        await other.waitForFunction(() => {
          const s=window.pons,r=window.pons3d,i=s.you.plots.findIndex(p=>p?.uid==='qa-plant');
          return r.plantModels.get(s.you.id+':'+i)?.key==='gorbulon_sprig:4' && !r.plantModels.has('carry'+s.you.id);
        });
        assert(await other.evaluate(() => {
          const s=window.pons,r=window.pons3d,i=s.you.plots.findIndex(p=>p?.uid==='qa-plant');
          return r.plantModels.get(s.you.id+':'+i).root.scale.x===1.3 && s.carryingAppearance===null;
        }));
      }
      await other.screenshot({ path: path.join(directory, 'raid-banked.png') });
      if (process.argv.includes('--wander')) {
        await page.waitForFunction(id => window.pons3d.remoteAvatars.has(id),raiderIdentity.id);
        await page.evaluate(id => { window.qaDepartingAvatar = window.pons3d.remoteAvatars.get(id).root; },raiderIdentity.id);
        if(databaseConnection)await rememberDatabaseState(other);
        await otherContext.close();
        await page.waitForFunction(id => !window.pons3d.remoteAvatars.has(id),raiderIdentity.id);
        assert(await page.evaluate(() => window.qaDepartingAvatar.parent === null && window.qaDepartingAvatar.children.length === 0));
      }
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ directory, view:perspectiveRaid ? 'perspective' : 'HD-2D', result: 'PASS two clients: remote nickname, pathfinding, timed uproot, owner removal, banked named plant, remote update and reconnect', errors }));
      return;
    }
    await page.locator('#sap').filter({ hasText: '1000' }).waitFor();
    // Exercise actual GPU-context loss, not a synthetic DOM event.
    await page.evaluate(() => {
      const view = window.pons3d;
      window.qaContextExtension = view.renderer.getContext().getExtension('WEBGL_lose_context');
      if (!window.qaContextExtension) throw new Error('Context-loss extension unavailable');
      window.qaContextExtension.loseContext();
    });
    await page.locator('#graphics-recovery').waitFor();
    assert.equal(await page.evaluate(() => window.pons3d.renderer.getContext().isContextLost()), true);
    await page.evaluate(() => window.qaContextExtension.restoreContext());
    await page.locator('#graphics-recovery').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => window.pons3d.renderer.getContext().isContextLost()), false);
    await page.locator('#btn-land').click();
    const nickname = page.locator('[data-nick="0"]');
    await nickname.focus();
    await nickname.pressSequentially('Captain Sprout', { delay: 120 });
    assert.equal(await nickname.inputValue(), 'Captain Sprout', 'Server updates must not erase active nickname typing');
    await nickname.press('Enter');
    await page.waitForFunction(() => window.pons.you?.plots[0]?.nick === 'Captain Sprout');
    await page.reload();
    await page.locator('#sap').filter({ hasText: '1000' }).waitFor();
    await page.locator('#btn-land').click();
    assert.equal(await page.locator('[data-nick="0"]').inputValue(), 'Captain Sprout', 'Plant name survives reconnect');
    await page.locator('#panel-close').click();
    await page.locator('#btn-shop').click();
    if (process.argv.includes('--diagnose')) {
    console.log('OVERLAY_DIAGNOSTIC', JSON.stringify(await page.evaluate(() => document.elementsFromPoint(500, 150).map(e => {
      const b = e.getBoundingClientRect(), s = getComputedStyle(e);
      return { tag: e.tagName, id: e.id, className: e.className, x: b.x, y: b.y, width: b.width, height: b.height, background: s.backgroundColor, position: s.position };
    }))));
    console.log('SCENE_DIAGNOSTIC', JSON.stringify(await page.evaluate(() => {
      const r = window.pons3d;
      r.raycaster.setFromCamera({ x: 500 / 1280 * 2 - 1, y: 1 - 150 / 900 * 2 }, r.camera);
      return r.raycaster.intersectObjects(r.scene.children, true).slice(0, 8).map(h => ({
        actor: [...r.actors].find(([id, a]) => a.mesh === h.object)?.[0],
        frame: [...r.actors.values()].find(a => a.mesh === h.object)?.frame,
        distance: h.distance, type: h.object.type, color: h.object.material?.color?.getHexString(),
        map: h.object.material?.map?.image?.src,
      }));
    })));
    await page.locator('#game canvas').screenshot({ path: path.join(directory, 'canvas-only.png') });
    const bitmap = await page.evaluate(() => {
      const r = window.pons3d; r.renderer.render(r.scene, r.camera);
      return r.renderer.domElement.toDataURL('image/png').split(',')[1];
    });
    fs.writeFileSync(path.join(directory, 'webgl-bitmap.png'), Buffer.from(bitmap, 'base64'));
    await page.locator('#panel-close').click();
    await page.screenshot({ path: path.join(directory, 'panel-closed.png') });
    await page.locator('#btn-shop').click();
    await page.addStyleTag({ content: '#panel{left:0;right:0;margin-left:auto;margin-right:auto;transform:none;}' });
    await page.screenshot({ path: path.join(directory, 'panel-centered-css.png') });
    for (const [name, css] of [
      ['canvas-alpha', '#game canvas{opacity:0.999}'],
      ['panel-alpha', '#panel{opacity:0.999}'],
      ['canvas-layer', '#game canvas{transform:translateZ(0)}'],
      ['panel-layer', '#panel{will-change:transform}'],
    ]) {
      const style = await page.addStyleTag({ content: css });
      const buffer = await page.screenshot({ path: path.join(directory, name + '.png') });
      const { PNG } = require('pngjs'), png = PNG.sync.read(buffer);
      const offset = (150 * png.width + 500) * 4;
      console.log('COMPOSITOR_TRIAL', name, [...png.data.subarray(offset, offset + 4)]);
      await style.evaluate(e => e.remove());
    }
    }
    await page.locator('#panel').evaluate(e => { e.scrollTop = e.scrollHeight; });
    const scrollBefore = await page.locator('#panel').evaluate(e => e.scrollTop);
    assert(scrollBefore > 100, 'Scroll regression must begin away from the top');
    await page.waitForTimeout(1200); // cross a periodic server state refresh
    assert(Math.abs(await page.locator('#panel').evaluate(e => e.scrollTop) - scrollBefore) < 2, 'Shop scroll jumps on refresh');
    assert.equal(await page.locator('[data-hat]').count(), 4);
    assert.equal(await page.locator('[data-shirt]').count(), 6);
    const desktop = await page.screenshot({ path: path.join(directory, 'wardrobe-desktop.png') });
    const { PNG } = require('pngjs'), shot = PNG.sync.read(desktop);
    let dark = 0;
    for (let y = 140; y < 180; y++) for (let x = 450; x < 550; x++) {
      const offset = (y * shot.width + x) * 4;
      if (shot.data[offset] === 24 && shot.data[offset + 1] === 18 && shot.data[offset + 2] === 32) dark++;
    }
    assert(dark < 200, 'Opaque panel leaves a dark compositing rectangle over the ground');
    await page.locator('[data-hat="2"]').click();
    await page.locator('#sap').filter({ hasText: /^200$/ }).waitFor();
    assert.equal(await page.locator('[data-hat="2"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-hat="1"]').click();
    await page.locator('[data-hat="1"][aria-pressed="true"]').waitFor();
    assert.equal(await page.locator('#sap').textContent(), '200');
    await page.reload();
    await page.locator('#sap').filter({ hasText: /^200$/ }).waitFor();
    await page.locator('#btn-shop').click();
    await page.locator('[data-hat="2"]').evaluate(e => e.scrollIntoView({ block: 'center' }));
    assert.equal(await page.locator('[data-hat="2"]').isEnabled(), true);
    await page.locator('[data-hat="2"]').click();
    await page.locator('[data-hat="2"][aria-pressed="true"]').waitFor();
    assert.equal(await page.locator('#sap').textContent(), '200');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-hat="0"]').evaluate(e => e.scrollIntoView({ block: 'center' }));
    await page.locator('[data-hat="0"]').tap();
    await page.locator('[data-hat="0"][aria-pressed="true"]').waitFor();
    assert(await page.locator('#panel').evaluate(e => e.scrollWidth <= e.clientWidth + 1), 'Panel overflows horizontally');
    for (const width of [320, 390, 600]) {
      await page.setViewportSize({ width, height: 844 });
      // Force long notices independent of the server's current seasonal event.
      await page.evaluate(() => {
        window.pons.hud.banner = () => {}; // Keep live ticks from hiding this synthetic fixture.
        const banner = document.getElementById('banner'); banner.hidden = false;
        banner.textContent = 'Golden Hour. Reveals shine brighter. ends in 1:30';
        const toast = document.getElementById('toast'); toast.classList.add('on');
        toast.textContent = 'Village: Ash Yard #1. Move: arrows / WASD / tap. Interact: tap a plot or press E.';
      });
      const bounds = await page.evaluate(() => Object.fromEntries(['hud', 'feed', 'banner', 'toast'].map(id => {
        const r = document.getElementById(id).getBoundingClientRect();
        return [id, { top:r.top, bottom:r.bottom, left:r.left, right:r.right }];
      })));
      assert(bounds.banner.top >= Math.max(bounds.hud.bottom, bounds.feed.bottom), `Status overlaps event at ${width}px`);
      assert(bounds.toast.top >= bounds.banner.bottom, `Event overlaps notice at ${width}px`);
      for (const r of Object.values(bounds)) assert(r.left >= 0 && r.right <= width, `Status exceeds viewport at ${width}px`);
      const controls = await page.evaluate(() => {
        const rect = id => { const r = document.getElementById(id).getBoundingClientRect(); return { top:r.top, bottom:r.bottom }; };
        return { panel:rect('panel'), chat:rect('chat'), bar:rect('bar'), buttons:[...document.querySelectorAll('#bar button')].map(b => {
          const r = b.getBoundingClientRect();
          return { id:b.id, width:r.width, height:r.height, reachable:b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)), fits:b.scrollWidth <= b.clientWidth };
        }) };
      });
      assert(controls.panel.bottom < controls.chat.top && controls.chat.bottom < controls.bar.top, `Bottom controls overlap at ${width}px`);
      assert.equal(controls.buttons.length,9);
      for (const b of controls.buttons) assert(b.reachable && b.fits && b.width >=44 && b.height >=44, `Unreachable or undersized ${b.id} at ${width}px`);
    }
    await page.setViewportSize({ width:390, height:844 });
    await page.screenshot({ path: path.join(directory, 'wardrobe-mobile.png') });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ directory, result: 'PASS real WebGL context loss/recovery, plant-name typing across updates and reconnect, actual HD-2D wardrobe purchase, free re-equip, reload ownership, mobile tap and panel width', errors }));
  } catch (error) {
    testFailed=true;
    if (browser) for (const [i, context] of browser.contexts().entries()) for (const page of context.pages()) {
      console.error('BROWSER_FAILURE_STATE', JSON.stringify(await page.evaluate(() => {
        const s = window.pons;
        return { ready: s?.ready, player: s?.player, path: s?.path, carrying: s?.carrying,
          toast: document.getElementById('toast')?.textContent, feed: s?.feed?.slice(0, 4) };
      }).catch(() => null)));
      await page.screenshot({ path: path.join(directory, `failure-${i}.png`) }).catch(() => {});
    }
    throw error;
  } finally {
    const expected=expectedDatabase;let captureFailure;
    if(databaseConnection && !testFailed && browser)try{
      for(const context of browser.contexts())for(const page of context.pages()){
        await rememberDatabaseState(page);
      }
      assert(expected.size>0,'No completed browser state available for database readback');
    }catch(error){captureFailure=error;}
    await browser?.close(); web.closeAllConnections(); await new Promise(r => web.close(r));
    child.kill('SIGTERM'); const deadline = setTimeout(() => child.kill('SIGKILL'), 22000);
    try { assert.equal(await exited, 0, log); } finally { clearTimeout(deadline); }
    fs.writeFileSync(path.join(directory, 'server.log'), log);
    if(captureFailure)throw captureFailure;
    if(databaseConnection && !testFailed){
      const {PostgresPersistence}=require('../server/dist/server/src/persistence.js');
      const reopened=new PostgresPersistence(databaseConnection,runtimeDatabase?'runtime':'bootstrap');
      try{
        const saved=await reopened.load();const allPlants=Object.values(saved.players).flatMap(p=>p.plots.filter(Boolean).map(plant=>plant.uid));
        assert.equal(new Set(allPlants).size,allPlants.length,'A plant UID is duplicated across database gardens');
        for(const [id,before]of expected){
          const after=saved.players[id];assert(after);assert(after.sap>=before.sap,'Acknowledged Sap was lost');
          assert.equal(after.skin??0,before.skin);assert.equal(after.hair??0,before.hair);assert.equal(after.hat??0,before.hat);
          assert.deepEqual(after.seeds.map(seed=>seed.uid),before.seeds);
          assert.deepEqual(after.plots.map(plant=>plant?{uid:plant.uid,nick:plant.nick??null,size:plant.size,mutation:plant.mutation}:null),before.plots);
        }
        const result={result:'PASS PostgreSQL post-shutdown browser-state readback',players:expected.size,uniquePlants:allPlants.length};
        fs.writeFileSync(path.join(directory,'database-readback.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({directory,...result}));
      }finally{await reopened.close();}
    }
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
