import assert from 'node:assert/strict';
import { Box3 } from 'three';
import { MODEL_SPECIES,plantModel,stylePlant,animatePlant,disposePlant } from '../client/src/three/plant-model';
import roster from '../content/roster.json';
assert.deepEqual([...MODEL_SPECIES].sort(),roster.species.map(s=>s.id).sort(),'Every roster species must have a model');
assert.equal(plantModel('unknown',4),null);
for(const species of MODEL_SPECIES) {
let height=0;
for(let stage=0;stage<=4;stage++) {
  const root=plantModel(species,stage)!;
  const box=new Box3().setFromObject(root),h=box.max.y-box.min.y;
  assert(h>height);height=h;assert(box.max.z>box.min.z,'Must be volumetric');
  for(const mutation of ['none','golden','holographic','colossal','feral','backwards','screaming'] as const) {
    stylePlant(root,mutation,5000);assert.equal(root.scale.x,mutation==='colossal'?1.5:1);
    assert.equal(root.rotation.y,mutation==='backwards'?Math.PI:0);
  }
  const count=root.userData.materials.length;
  stylePlant(root,'none',0);assert.deepEqual(root.userData.materials.map(m=>m.color.getHex()),root.userData.colors);
  let disposed=0;for(const material of root.userData.materials)material.addEventListener('dispose',()=>disposed++);
  disposePlant(root);disposePlant(root);assert.equal(disposed,count);assert.equal(root.children.length,0);
}
}
console.log('PASS '+MODEL_SPECIES.length+' species, '+MODEL_SPECIES.length*5+' growth models, volume, mutation transforms/color restoration and disposal');
const tulip=plantModel('low_ambition_tulip',4)!,body=tulip.userData.idleBody;
assert(body && body.children.length>0);
const soil=tulip.children.find(c=>c!==body)!;
const soilBefore=new Box3().setFromObject(soil);
animatePlant(tulip,9500);assert.equal(body.rotation.x,.18);
const nodded=new Box3().setFromObject(body);
animatePlant(tulip,12000);assert.equal(body.rotation.x,0);
assert(!nodded.equals(new Box3().setFromObject(body)));
assert(soilBefore.equals(new Box3().setFromObject(soil)));
animatePlant(tulip,9500,true);assert.equal(body.rotation.x,0);
animatePlant(tulip,NaN);assert.equal(body.rotation.x,0);
for(let t=0;t<24000;t+=83){animatePlant(tulip,t);assert(body.rotation.x>=0 && body.rotation.x<=.18);}
disposePlant(tulip);
console.log('PASS tulip sleep nod, stable soil, bounded looping motion and reduced-motion reset');
for(const [species,field,peak,period] of [
  ['gorbulon_sprig','idleBrow',11000,12000], ['plain_gerald','idleEyes',8600,9000],
] as const) {
  const root=plantModel(species,4)!,part=root.userData[field];assert(part && part.children.length>0);
  const staticBounds=root.children.filter(c=>c!==part).map(c=>new Box3().setFromObject(c));
  animatePlant(root,peak);
  if(field==='idleBrow')assert.equal(part.position.y,.055);
  else assert(Math.abs(part.scale.y-.08)<1e-9);
  root.children.filter(c=>c!==part).forEach((c,i)=>assert(staticBounds[i].equals(new Box3().setFromObject(c))));
  for(const [t,reduced] of [[peak,true],[NaN,false],[period,false]] as const){
    animatePlant(root,t,reduced);assert.equal(part.position.y,field==='idleBrow'?0:part.position.y);
    assert.equal(part.rotation.z,0);assert.equal(part.scale.y,1);
  }
  const growing=plantModel(species,3)!;assert.equal(growing.userData[field],undefined);disposePlant(growing);
  let disposed=0;part.traverse(o=>{if('geometry' in o)(o.geometry as any).addEventListener('dispose',()=>disposed++);});
  disposePlant(root);assert(disposed>0);
}
console.log('PASS mature brow lift and slow blink, stationary body/soil, reduced-motion reset and nested geometry disposal');
