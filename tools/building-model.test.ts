import assert from 'node:assert/strict';
import {Box3,Vector3} from 'three';
import {buildingModel} from '../client/src/three/building-model';
import {unobstructedCamera} from '../client/src/three/camera-obstruction';
import {disposeGroup} from '../client/src/three/Ground';
assert.equal(buildingModel('unknown',3,2),null);
for(const kind of ['hall','seedshop','tavern','shrine','tower']) {
  const root=buildingModel(kind,3,2)!,bounds=new Box3().setFromObject(root);
  assert(bounds.min.x>=-1.5 && bounds.max.x<=1.5);
  assert(bounds.min.z>=-1 && bounds.max.z<=1);
  assert(bounds.min.y>=-1e-6 && bounds.max.y>1.5,kind+' vertical bounds '+bounds.min.y+'..'+bounds.max.y);
  const start=new Vector3(0,1,4),desired=new Vector3(0,1,-4),clipped=unobstructedCamera(start,desired,[bounds]);
  assert(clipped.z>bounds.max.z,'Camera must stay in front of building');
  disposeGroup(root);assert.equal(root.parent,null);
}
console.log('PASS five building volumes, footprints and camera obstruction');
