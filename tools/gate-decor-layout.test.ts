import assert from 'node:assert/strict';
import {Box3} from 'three';
import {gateDecorLayout} from '../client/src/three/gate-decor-layout';
import {plazaModel} from '../client/src/three/plaza-model';
import {disposeGroup} from '../client/src/three/Ground';
for(const side of ['top','bottom','left','right'] as const){
  const layout=gateDecorLayout({x:0,y:0},side),roots=layout.lamps.map(p=>{
    const root=plazaModel('lamp')!;root.scale.setScalar(.75);root.position.set(p.x/32,0,p.y/32);return root;
  });
  const sign=plazaModel('sign')!;sign.position.set(layout.sign.x/32,0,layout.sign.y/32);sign.rotation.y=layout.rotation;roots.push(sign);
  const boxes=roots.map(root=>new Box3().setFromObject(root));
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert(!boxes[i].intersectsBox(boxes[j]),side+' decoration collision');
  for(const box of boxes){
    if(side==='bottom')assert(box.min.z>.06);
    if(side==='top')assert(box.max.z<-.06);
    if(side==='right')assert(box.min.x>.06);
    if(side==='left')assert(box.max.x<-.06);
  }
  for(const root of roots)disposeGroup(root);
}
console.log('PASS four gate orientations keep decorations outside fence and mutually separated');
