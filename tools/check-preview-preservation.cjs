// Box C only. Never print identities, credentials, wallets or complete records.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
assert(process.platform==='linux' && path.resolve(__dirname,'..')==='/opt/pons','Box C only');
const arg=name=>process.argv.find(s=>s.startsWith('--'+name+'='))?.slice(name.length+3);
function checked(directory){
  assert(directory,'Missing explicit retained preview directory');
  const resolved=fs.realpathSync(directory);
  assert(/^\/opt\/pons\/hd2d-refresh\.[a-zA-Z0-9]+\/(before-stop|after-restart)$/.test(resolved),'Only retained preview copies are permitted');
  return resolved;
}
function snapshot(directory){
  const value=JSON.parse(fs.readFileSync(path.join(directory,'snapshot.json'),'utf8'));
  assert.equal(value.version,1);assert(value.players && value.villages && Array.isArray(value.ledger));return value;
}
function compare(before,after,exact){
  let plants=0;
  for(const [id,old] of Object.entries(before.players)){
    const saved=after.players[id];assert(saved,'Existing player missing');
    for(const field of ['secret','address','name','villageId','lotId','color','hat','skin','hair'])assert.deepEqual(saved[field]??null,old[field]??null,'Existing identity, location or appearance changed');
    assert(saved.plotCount>=old.plotCount,'Plot capacity lost');
    if(exact)for(const field of ['sap','plots','seeds','stats','defenses','cosmetics','hats','missions'])assert.deepEqual(saved[field],old[field],'Candidate changed saved progression');
    const uids=new Set(saved.plots.filter(Boolean).map(p=>p.uid));
    for(const plant of old.plots.filter(Boolean)){assert(uids.has(plant.uid),'Existing planted identity missing');plants++;}
  }
  console.log(JSON.stringify({result:'PASS preview save preservation',mode:exact?'isolated candidate':'restart comparison',players:Object.keys(before.players).length,plants}));
}
(async()=>{
  if(arg('candidate')){
    for(const key of Object.keys(process.env))if(key.startsWith('PONS_'))delete process.env[key];
    const source=checked(arg('candidate')),before=snapshot(source);
    const directory=fs.mkdtempSync('/tmp/pons-preview-candidate-');fs.cpSync(source,directory,{recursive:true});
    const {Game}=require('../server/dist/server/src/game.js');
    const game=new Game(directory);await game.initialize();
    try{
      compare(before,{players:Object.fromEntries(game.players)},true);
      for(const rec of game.players.values()){
        assert.equal(game.privateState(rec).hair,rec.hair??0);
        assert.equal(game.privateState(rec).skin,rec.skin??0);
      }
      await game.commit();
    }finally{await game.store.close();}
    compare(before,snapshot(directory),true);console.log(JSON.stringify({directory}));
  }else compare(snapshot(checked(arg('before'))),snapshot(checked(arg('after'))),false);
})().catch(()=>{console.error('Preview preservation check failed; inspect retained copies. No credentials or records logged.');process.exitCode=1;});
