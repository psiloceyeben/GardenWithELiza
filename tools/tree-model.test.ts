import assert from 'node:assert/strict';
import {Box3,Mesh} from 'three';
import {treeModel} from '../client/src/three/tree-model';
import {disposeGroup} from '../client/src/three/Ground';
let previous=0;
for(let stage=0;stage<5;stage++){
  const root=treeModel(stage),bounds=new Box3().setFromObject(root);
  assert(bounds.max.y>previous);previous=bounds.max.y;
  assert(bounds.min.y>=-1e-6 && bounds.min.x>=-.55 && bounds.max.x<=.55);
  let geometries=0,disposed=0;
  root.traverse(o=>{if(o instanceof Mesh){geometries++;o.geometry.addEventListener('dispose',()=>disposed++);}});
  disposeGroup(root);assert.equal(disposed,geometries);assert.equal(root.parent,null);
}
for(const stage of [NaN,Infinity,-1])assert.equal(treeModel(stage).name,'tree-stage-0');
assert.equal(treeModel(99).name,'tree-stage-4');
console.log('PASS five tree stages, increasing volume height, footprint and geometry disposal');
