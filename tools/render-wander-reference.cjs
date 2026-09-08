// Box C only. Isolated character-reference render, no game servers or accounts.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const esbuild=require('esbuild');
const {chromium}=require('/opt/pons-browser-qa/node_modules/playwright');
const root='/opt/pons/wander-reference.NPaFm2';
(async()=>{
  const map=JSON.parse(fs.readFileSync(path.join(root,'packaged.js.map'),'utf8'));
  for(const name of ['meshes/index.ts','world/textures.ts','world/buildingSpecs.ts']) {
    const i=map.sources.indexOf('../../src/'+name); if(i<0)throw Error('Missing packaged source '+name);
    const file=path.join(root,name); fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,map.sourcesContent[i]);
  }
  const entry=`import * as THREE from 'three';
import {PlayerAvatar} from './playerAvatar';
import {buildPlayer,buildWizard,buildGuard,buildMerchant,buildScholar} from './meshes/index';
const renderer=new THREE.WebGLRenderer({antialias:false}); renderer.setSize(1200,650); renderer.setPixelRatio(1);
renderer.outputColorSpace=THREE.SRGBColorSpace; document.getElementById('scene').append(renderer.domElement);
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x283b32);
scene.add(new THREE.HemisphereLight(0xffffff,0x526345,2)); const light=new THREE.DirectionalLight(0xffeed3,2);light.position.set(3,8,6);scene.add(light);
const camera=new THREE.PerspectiveCamera(35,1200/650,0.1,100);camera.position.set(0,6,15);camera.lookAt(0,0.7,0);
const a=new PlayerAvatar(); a.root.position.set(-4,0,0);scene.add(a.root);
const builders=[buildPlayer,buildWizard,buildGuard,buildMerchant,buildScholar];
builders.forEach((build,i)=>{const model=build();model.position.set(-0.6+i*1.35,0,0);scene.add(model);});
const ground=new THREE.Mesh(new THREE.PlaneGeometry(30,20),new THREE.MeshLambertMaterial({color:0x63864c}));ground.rotation.x=-Math.PI/2;ground.position.y=-0.02;scene.add(ground);
renderer.render(scene,camera);window.referenceReady=true;`;
  fs.writeFileSync(path.join(root,'reference.ts'),entry);
  await esbuild.build({entryPoints:[path.join(root,'reference.ts')],bundle:true,platform:'browser',outfile:path.join(root,'reference.js'),nodePaths:['/opt/pons/node_modules']});
  fs.writeFileSync(path.join(root,'index.html'),`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#181e1b;color:#eee;font:20px sans-serif}h1{margin:24px}header{display:flex;justify-content:space-around}p{margin:12px 24px;font-size:16px}canvas{display:block;image-rendering:pixelated}</style><h1>Wander character sources — geometry comparison</h1><header><b>A · Older customizable humanoid</b><b>B · Packaged FINAL013 characters</b></header><div id="scene"></div><p>Same neutral lighting for comparison. Not a screenshot of either game or the final Pons art.</p><script src="reference.js"></script>`);
  const web=http.createServer((req,res)=>{const file=req.url==='/reference.js'?'reference.js':'index.html';res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/html');res.end(fs.readFileSync(path.join(root,file)));});
  await new Promise(r=>web.listen(0,'127.0.0.1',r));let browser;
  try {browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1200,height:820}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+web.address().port);await page.waitForFunction(()=>window.referenceReady);if(errors.length)throw Error(errors.join('\n'));await page.screenshot({path:path.join(root,'comparison.png')});console.log(path.join(root,'comparison.png'));}
  finally {await browser?.close();await new Promise(r=>web.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
