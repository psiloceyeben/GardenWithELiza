import assert from 'node:assert/strict';
import {Box3,Mesh} from 'three';
import {decorModel} from '../client/src/three/decor-model';
import {disposeGroup} from '../client/src/three/Ground';
assert.equal(decorModel('unknown'),null);
for(const kind of ['stump','decor0','decor1','decor2','weeds']){
  const root=decorModel(kind)!,box=new Box3().setFromObject(root);
  assert(box.min.y>=-1e-6 && box.max.y>(kind==='weeds'?.1:.3) && box.max.y<(kind==='weeds'?.22:1.1),`${kind}: vertical bounds ${box.min.y}..${box.max.y}`);
  assert(box.min.x>=-.5 && box.max.x<=.5 && box.min.z>=-.5 && box.max.z<=.5);
  let meshes=0,disposed=0;
  root.traverse(o=>{if(o instanceof Mesh){meshes++;o.material.addEventListener('dispose',()=>disposed++);}});
  disposeGroup(root);assert.equal(disposed,meshes);
}
console.log('PASS five scenery/condition volumes, bounded footprints and material disposal');
