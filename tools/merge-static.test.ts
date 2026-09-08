import assert from 'node:assert/strict';
import * as T from 'three';
import {mergeStatic} from '../client/src/three/merge-static';
import {plantModel,disposePlant,stylePlant} from '../client/src/three/plant-model';
const root=new T.Group(),material=new T.MeshLambertMaterial();
let disposed=0;
for(let i=0;i<3;i++){
  const g=new T.BoxGeometry(1,1,1);g.addEventListener('dispose',()=>disposed++);
  const mesh=new T.Mesh(g,material);mesh.position.set(i,2*i,-i);mesh.scale.set(1,.4,2);mesh.rotation.y=i*.3;root.add(mesh);
}
const before=new T.Box3().setFromObject(root);mergeStatic(root);
const after=new T.Box3().setFromObject(root);
assert(before.min.distanceTo(after.min)<1e-6 && before.max.distanceTo(after.max)<1e-6);
assert.equal(root.children.length,1);assert.equal(disposed,3);
assert.equal((root.children[0] as T.Mesh).material,material);
assert.equal((root.children[0] as T.Mesh).geometry.getAttribute('position').count,108);
for(const species of ['corn_that_knows','pineapple_enforcer']){
  const plant=plantModel(species,4)!;assert(plant.children.length<15);
  stylePlant(plant,'golden',0);assert.equal(plant.userData.materials[0].color.getHex(),0xffdf78);
  stylePlant(plant,'none',0);assert.equal(plant.userData.materials[0].color.getHex(),0x469640);
  disposePlant(plant);
}
console.log('PASS static merge preserves transformed bounds, triangle count, material identity and mutation control');
