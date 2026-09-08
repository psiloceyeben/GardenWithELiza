import assert from 'node:assert/strict';
import {Box3} from 'three';
import {plazaModel,updatePlazaModel} from '../client/src/three/plaza-model';
import {disposeGroup} from '../client/src/three/Ground';
assert.equal(plazaModel('unknown'),null);
for(const kind of ['lamp','fountain','bench','board','stall','sign','pot','track']) {
  const root=plazaModel(kind)!,bounds=new Box3().setFromObject(root),half=['lamp','sign','pot'].includes(kind)?.5:1,depth=kind==='fountain'?1:.5;
  assert(bounds.min.x>=-half && bounds.max.x<=half && bounds.min.z>=-depth && bounds.max.z<=depth,kind+' footprint');
  assert(bounds.min.y>=-1e-6 && bounds.max.y>(kind==='track'?.01:.3),kind+' height');
  updatePlazaModel(root,1);
  if(kind==='lamp')assert.equal(root.userData.glass.material.color.getHex(),0xfae66e);
  updatePlazaModel(root,0);
  if(kind==='lamp')assert.equal(root.userData.glass.material.color.getHex(),0x444050);
  disposeGroup(root);assert.equal(root.parent,null);
}
console.log('PASS eight plaza prop volumes, footprints and reversible day/night colors');
