import assert from 'node:assert/strict';
import { cameraInput } from '../client/src/game/camera-input';
const near = (a:number,b:number) => assert(Math.abs(a-b)<1e-10, `${a} != ${b}`);
for (const yaw of [0, Math.PI/2, Math.PI, -Math.PI/2, Math.atan2(38,58), 17*Math.PI]) {
  const right = cameraInput(1,0,yaw), forward = cameraInput(0,-1,yaw);
  near(Math.hypot(right.x,right.y),1); near(Math.hypot(forward.x,forward.y),1);
  near(right.x*forward.x+right.y*forward.y,0);
  for (const [x,y] of [[1,1],[-1,1],[0.25,-0.75],[0,0]]) {
    const rotated = cameraInput(x,y,yaw), restored = cameraInput(rotated.x,rotated.y,-yaw);
    near(restored.x,x); near(restored.y,y); near(Math.hypot(rotated.x,rotated.y),Math.hypot(x,y));
  }
}
near(cameraInput(0,-1,Math.PI/2).x,-1);
near(cameraInput(0,-1,0).y,-1);
for (const invalid of [NaN,Infinity,-Infinity]) {
  assert.deepEqual(cameraInput(invalid,1,0),{x:0,y:0});
  assert.deepEqual(cameraInput(1,invalid,0),{x:0,y:0});
  assert.deepEqual(cameraInput(1,1,invalid),{x:0,y:0});
}
console.log('PASS camera heading basis, inverse rotation, magnitude preservation and invalid-input guard');
