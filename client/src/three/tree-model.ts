import * as T from 'three';

/** Five conviction-tree stages, using the original sprite palette. No sway. */
export function treeModel(stage:number):T.Group {
  stage=Number.isFinite(stage)?Math.max(0,Math.min(4,Math.floor(stage))):0;
  const root=new T.Group();root.name='tree-stage-'+stage;
  const box=(w:number,h:number,d:number,color:number,x:number,y:number,z:number)=>{
    const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshLambertMaterial({color,flatShading:true}));
    mesh.position.set(x,y,z);root.add(mesh);return mesh;
  };
  if(stage===0){
    box(.0625,.25,.0625,0x469640,0,.125,0);
    box(.22,.06,.13,0x8cd25a,-.10,.18,0);
    box(.22,.06,.13,0x8cd25a,.10,.22,0);
    return root;
  }
  const trunk=[0,14,22,24,24][stage]/32,radius=[0,7,12,15,16][stage]/32;
  box([0,3,5,6,6][stage]/32,trunk,.14,0x784e2c,0,trunk/2,0);
  const cy=trunk+radius-.125;
  const crown=new T.Mesh(new T.SphereGeometry(radius,8,5),new T.MeshLambertMaterial({color:0x469640,flatShading:true}));
  crown.scale.y=.8;crown.position.y=cy;root.add(crown);
  if(stage>=3)for(let i=0;i<7;i++){
    const angle=i*Math.PI*2/7,y=cy+((i%3)-1)*radius*.30;
    box(.065,.065,.065,0xf096b4,Math.cos(angle)*radius*.88,y,Math.sin(angle)*radius*.88);
  }
  if(stage===4)for(let i=0;i<6;i++){
    const angle=(i+.4)*Math.PI/3;
    box(.08,.09,.08,0xf0c434,Math.cos(angle)*radius*.80,cy-radius*.35,Math.sin(angle)*radius*.80);
  }
  return root;
}
