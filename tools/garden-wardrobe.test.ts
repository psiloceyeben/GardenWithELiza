import assert from 'node:assert/strict';
import { Box3 } from 'three';
import { gardenWardrobe,gardenHat,GARDEN_HATS,GARDEN_SHIRTS } from '../client/src/three/garden-wardrobe';
for(let color=0;color<6;color++)for(let hat=0;hat<4;hat++) {
  const mapped=gardenWardrobe(color,hat);assert.equal(mapped.bodyColor,GARDEN_SHIRTS[color]);assert.equal(mapped.hat,GARDEN_HATS[hat]);
}
for(const bad of [-1,99,NaN,Infinity,1.5]) assert.deepEqual(gardenWardrobe(bad,bad),gardenWardrobe(0,0));
for(const style of GARDEN_HATS) {
  const model=gardenHat(style),bounds=new Box3().setFromObject(model);
  assert(!bounds.isEmpty());assert(bounds.max.x-bounds.min.x>0);assert(bounds.max.z-bounds.min.z>0);
  assert(model.children.length>=2);assert.equal(model.name,'pons-hat-'+style);
}
console.log('PASS 24 saved wardrobe combinations, invalid-index fallback and four volumetric hat meshes');
