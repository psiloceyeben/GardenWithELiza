import assert from 'node:assert/strict';
import {Box3} from 'three';
import {gateKind,gateModel} from '../client/src/three/gate-model';
import {disposeGroup} from '../client/src/three/Ground';
assert.equal(gateKind(0,0),null);
assert.equal(gateKind(3,3),'gate:intact');assert.equal(gateKind(2,3),'gate:damaged');assert.equal(gateKind(0,3),'gate:broken');
for(const kind of ['gate:intact','gate:damaged','gate:broken'])for(const angle of [0,Math.PI/2]){
  const root=gateModel(kind)!;root.rotation.y=angle;
  const b=new Box3().setFromObject(root);
  assert(b.min.y>=-1e-6 && b.max.y<.8);
  assert(b.min.x>=-.5 && b.max.x<=.5 && b.min.z>=-.5 && b.max.z<=.5);
  disposeGroup(root);
}
console.log('PASS health-state mapping and gate footprints in both orientations');
