import assert from 'node:assert/strict';
import { Group, Vector3 } from 'three';
import { CarryPose } from '../client/src/three/carry-pose';
const root=new Group(), arms=[new Group(),new Group()], hands=[new Group(),new Group()];
arms.forEach((arm,i)=>{
  const side=i===0?-1:1; arm.position.set(side*.34,1.4,0);arm.rotation.z=side*.16;
  hands[i].position.y=-.68;arm.add(hands[i]);root.add(arm);
});
root.userData.characterRig={arms,handLeft:hands[0],handRight:hands[1]};
const pose=new CarryPose(), target=new Vector3();
pose.apply(root,true);assert(arms.every(a=>a.rotation.x===-1.2));
assert(pose.position(root,target));assert(Math.abs(target.x)<1e-9 && target.z>.5 && target.y>1);
const local=target.clone();root.position.set(8,0,12);root.rotation.y=Math.PI/2;
assert(pose.position(root,target));
assert(target.distanceTo(local.applyAxisAngle(new Vector3(0,1,0),Math.PI/2).add(root.position))<1e-9);
pose.apply(root,false);assert.equal(arms[0].rotation.z,-.16);assert.equal(arms[1].rotation.z,.16);
assert.equal(pose.position(new Group(),target),false);
console.log('PASS two-hand carry pose, facing/world placement, release and absent-rig fallback');
