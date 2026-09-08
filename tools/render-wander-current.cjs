// Box C only: render newer source presets without launching Wander or its APIs.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('/opt/pons-browser-qa/node_modules/playwright');
(async()=>{
  const root=fs.mkdtempSync('/opt/pons/wander-current-reference-');
  const served=fs.readFileSync('/var/www/wander-static/multiplayer/assets/index-VJLoN3RN.js','utf8');
  const presets=['wanderer','warden','scholar','forager','nomad','capybara','goblin','golem','doge','chad'];
  console.log(JSON.stringify({servedBundle:'index-VJLoN3RN.js',presetNamesPresent:presets.filter(p=>served.includes(p))}));
  const source=`import * as THREE from 'three';
import {PlayerAvatar,PLAYER_MODEL_PRESETS} from '/opt/pons/client/src/three/vendor/WanderAvatar.js';
import {VisualAvatar} from '/opt/pons/client/src/three/visual-avatar.ts';
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(1200,600);renderer.setPixelRatio(1);renderer.setScissorTest(true);document.getElementById('models').append(renderer.domElement);
const names=${JSON.stringify(presets)};
const initialPatched=window._wanderClayRim.patchedCount();
names.forEach((preset,i)=>{
 const x=(i%5)*240,y=i<5?300:0;
 renderer.setViewport(x,y,240,300);renderer.setScissor(x,y,240,300);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x34483b);
 scene.add(new THREE.HemisphereLight(0xffffff,0x4b553c,2));const sun=new THREE.DirectionalLight(0xffedd0,2);sun.position.set(3,6,4);scene.add(sun);
 const appearance={...PLAYER_MODEL_PRESETS[preset].state,preset};
 const model=new VisualAvatar((state,options)=>{const asset=new PlayerAvatar(state,options);asset.save=()=>{throw Error('Unexpected Wander save');};asset.update=()=>{throw Error('Unexpected Wander update');};return asset;},appearance);scene.add(model.root);
 model.setAppearance({...appearance,bodyColor:'#63864c'});model.setAppearance(appearance);
 for(let hat=0;hat<4;hat++) {
   model.setWardrobe(i%6,hat); model.setWardrobe(i%6,hat);
   let hats=0;model.root.traverse(o=>{if(o.name.startsWith('pons-hat-'))hats++;});
   if(hats!==1)throw Error('Wardrobe duplicates/misses hat for '+preset);
 }
 model.setWardrobe(i%6,i%4);
 for(let frame=0;frame<20;frame++)model.animate(frame/60,true);
 const camera=new THREE.PerspectiveCamera(35,240/300,0.1,100);camera.position.set(2.6,2.1,4.5);camera.lookAt(0,0.9,0);
 renderer.render(scene,camera);
 model.dispose();model.dispose();if(model.root.parent || model.root.children.length)throw Error('Avatar disposal failed');
 if(window._wanderClayRim.patchedCount()!==initialPatched)throw Error('Disposed avatar materials retained in shader registry: '+window._wanderClayRim.patchedCount());
});window.referenceReady=true;`;
  fs.writeFileSync(path.join(root,'reference.ts'),source);
  const build=await require('esbuild').build({entryPoints:[path.join(root,'reference.ts')],bundle:true,platform:'browser',metafile:true,outfile:path.join(root,'reference.js'),alias:{three:require.resolve('three')},nodePaths:['/opt/pons/node_modules']});
  fs.writeFileSync(path.join(root,'dependencies.json'),JSON.stringify(build.metafile,null,2));
  console.log(JSON.stringify({sourceInputs:Object.keys(build.metafile.inputs).filter(p=>!p.includes('node_modules'))}));
  const labels=presets.map((p,i)=>`<span style="left:${i%5*240}px;top:${i<5?340:640}px">${p}</span>`).join('');
  fs.writeFileSync(path.join(root,'index.html'),`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#18251c;color:#eee;font:18px sans-serif}h1{margin:20px;font-size:26px}p{margin:18px;font-size:16px}span{position:absolute;width:240px;text-align:center;pointer-events:none}canvas{display:block}</style><h1>Wander models with Pons shirts and hats — fit check</h1><div id="models"></div>${labels}<p>Integration reference, neutral studio lighting. Not a live-game screenshot or final Pons art.</p><script src="reference.js"></script>`);
  const web=http.createServer((req,res)=>{const file=req.url==='/reference.js'?'reference.js':'index.html';res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/html');res.end(fs.readFileSync(path.join(root,file)));});
  await new Promise(r=>web.listen(0,'127.0.0.1',r));let browser;
  try{browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1200,height:730}});const errors=[],blocked=[];page.on('pageerror',e=>errors.push(e.message));
    const origin='http://127.0.0.1:'+web.address().port;
    await page.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)return route.continue();blocked.push(route.request().url());return route.abort();});
    await page.goto(origin);await page.waitForFunction(()=>window.referenceReady).catch(e=>{throw Error(JSON.stringify({errors,wait:e.message}));});
    const storageKeys=await page.evaluate(()=>Object.keys(localStorage));
    if(errors.length || blocked.length || storageKeys.length)throw Error(JSON.stringify({errors,blocked,storageKeys}));
    await page.screenshot({path:path.join(root,'presets.png')});console.log(JSON.stringify({artifact:path.join(root,'presets.png'),externalRequests:blocked.length,localStorageKeys:storageKeys.length}));}
  finally{await browser?.close();await new Promise(r=>web.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
