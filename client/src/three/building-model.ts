import * as T from 'three';

const PALETTE:Record<string,[number,number]>={
  hall:[0x3c78dc,0xf0e8d2],seedshop:[0x469640,0xe8c8a0],
  tavern:[0xd03434,0xbc8c5a],shrine:[0x5a2882,0xf0e8d2],tower:[0x444050,0x8c8896],
};
/** Original town sprite palette, modeled inside the existing 3x2-tile footprint. */
export function buildingModel(kind:string,width:number,depth:number):T.Group|null {
  if(!Object.prototype.hasOwnProperty.call(PALETTE,kind))return null;
  const root=new T.Group();root.name='building-'+kind;
  const [roofColor,wallColor]=PALETTE[kind],tower=kind==='tower';
  const w=width*(tower?.48:.86),d=depth*(tower?.70:.80),h=tower?2.1:1.25;
  const add=(geometry:T.BufferGeometry,color:number,x:number,y:number,z:number)=>{
    const mesh=new T.Mesh(geometry,new T.MeshLambertMaterial({color,flatShading:true}));
    mesh.position.set(x,y,z);root.add(mesh);return mesh;
  };
  const box=(x:number,y:number,z:number,sx:number,sy:number,sz:number,color:number)=>add(new T.BoxGeometry(sx,sy,sz),color,x,y,z);
  box(0,h/2,0,w,h,d,wallColor);
  if(tower) {
    box(0,h+.04,0,w+.10,.10,d+.10,roofColor);
    for(const sign of [-1,1])for(let i=0;i<3;i++) {
      box((i-1)*w*.4,h+.18,sign*d/2,.20,.22,.18,roofColor);
      if(i!==1)box(sign*w/2,h+.18,(i-1)*d*.35,.18,.22,.20,roofColor);
    }
    for(const x of [-.25,.25])box(x,1.45,d/2+.012,.16,.30,.025,0x18121e);
  } else {
    const shape=new T.Shape();shape.moveTo(-w/2-.09,0);shape.lineTo(0,.72);shape.lineTo(w/2+.09,0);shape.closePath();
    add(new T.ExtrudeGeometry(shape,{depth:d+.14,bevelEnabled:false}),roofColor,0,h,-d/2-.07);
    for(const sign of [-1,1]) {
      const x=sign*w*.31,z=d/2+.025;
      box(x,.80,z,.35,.34,.045,0x78c8f0);
      box(x,.80,z+.03,.035,.35,.025,0x482c1c);box(x,.80,z+.03,.36,.025,.025,0x482c1c);
      // Side windows keep the building readable while orbiting behind its front.
      box(sign*(w/2+.015),.78,0,.03,.32,.35,0x78c8f0);
    }
    box(0,h+.20,d/2+.09,.56,.24,.045,0xbc8c5a);
    box(0,h+.20,d/2+.12,.46,.16,.025,0xf0e8d2);
    const mark=kind==='seedshop'?0x469640:kind==='shrine'?0x78c8f0:0xf0c434;
    if(kind==='seedshop')add(new T.SphereGeometry(.065,6,4),mark,0,h+.20,d/2+.12);
    else if(kind==='shrine')add(new T.OctahedronGeometry(.075),mark,0,h+.20,d/2+.12);
    else box(0,h+.20,d/2+.15,.14,.08,.02,mark);
  }
  box(0,.30,d/2+.025,.38,.60,.045,0x482c1c);
  box(.12,.29,d/2+.06,.035,.035,.035,0xf0c434);
  return root;
}
