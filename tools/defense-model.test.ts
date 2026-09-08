import assert from 'node:assert/strict';
import {Box3} from 'three';
import {defenseModel} from '../client/src/three/defense-model';
import {disposeGroup} from '../client/src/three/Ground';
for(const kind of ['sprinkler','gnome:-1','gnome:0','gnome:1','gnome:2']){
  const root=defenseModel(kind)!,b=new Box3().setFromObject(root);
  assert(b.min.y>=-1e-6 && b.max.y>.4 && b.max.y<1);
  assert(b.min.x>=-.4 && b.max.x<=.4 && b.min.z>=-.4 && b.max.z<=.4);
  disposeGroup(root);assert.equal(root.parent,null);
}
assert.equal(defenseModel('gnome:99'),null);
console.log('PASS sprinkler and four gnome hat variants within bounded volumes');
