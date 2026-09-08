// Box C only. Isolated generated visual QA page; no gameplay/save mutations.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('/opt/pons-browser-qa/node_modules/playwright');
(async()=>{
 const directory=fs.mkdtempSync('/opt/pons/plant-reference-');
 fs.writeFileSync(path.join(directory,'entry.ts'),`import * as T from 'three';
 import {MODEL_SPECIES,plantModel,disposePlant} from '/opt/pons/client/src/three/plant-model.ts';
 const r=new T.WebGLRenderer({antialias:false});r.setSize(MODEL_SPECIES.length*250,900);r.setScissorTest(true);document.body.append(r.domElement);
 MODEL_SPECIES.forEach((id,col)=>{for(let stage=0;stage<5;stage++){
 r.setViewport(col*250,(4-stage)*180,250,180);r.setScissor(col*250,(4-stage)*180,250,180);
 const s=new T.Scene();s.background=new T.Color(0x34483b);s.add(new T.HemisphereLight(0xffffff,0x444433,2));
 const light=new T.DirectionalLight(0xffedd0,2);light.position.set(3,6,4);s.add(light);
 const p=plantModel(id,stage);s.add(p);const c=new T.PerspectiveCamera(35,250/180,.1,20);c.position.set(.6,1.1,2.5);c.lookAt(0,.5,0);r.render(s,c);disposePlant(p);
 }});window.columns=MODEL_SPECIES;window.done=true;`);
 await require('esbuild').build({entryPoints:[path.join(directory,'entry.ts')],bundle:true,platform:'browser',outfile:path.join(directory,'entry.js'),alias:{three:require.resolve('three')},nodePaths:['/opt/pons/node_modules']});
 fs.writeFileSync(path.join(directory,'index.html'),'<!doctype html><style>body{margin:0;background:#34483b}</style><body><script src="entry.js"></script>');
 const web=http.createServer((req,res)=>{const name=req.url==='/entry.js'?'entry.js':'index.html';res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':'text/html');res.end(fs.readFileSync(path.join(directory,name)));});
 await new Promise(r=>web.listen(0,'127.0.0.1',r));let browser;
 try {
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1500,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+web.address().port);await page.waitForFunction(()=>window.done).catch(e=>{throw Error(JSON.stringify({errors,message:e.message}));});if(errors.length)throw Error(JSON.stringify(errors));
 const columns=await page.evaluate(()=>window.columns);await page.setViewportSize({width:columns.length*250,height:900});
 await page.screenshot({path:path.join(directory,'plants.png')});
 await page.screenshot({path:path.join(directory,'recent-plants.png'),clip:{x:Math.max(0,columns.length-3)*250,y:0,width:Math.min(3,columns.length)*250,height:900}});
 console.log(JSON.stringify({directory,columns,rows:'growth 0 through 4',errors}));
 }finally{await browser?.close();await new Promise(r=>web.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
