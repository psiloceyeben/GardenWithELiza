import * as T from 'three';
export function gateKind(hp:number,max:number):string|null {
  if(max<=0)return null;
  return hp<=0?'gate:broken':hp<max?'gate:damaged':'gate:intact';
}
export function gateModel(kind:string):T.Group|null {
  if(!['gate:broken','gate:damaged','gate:intact'].includes(kind))return null;
  const root=new T.Group();root.name=kind;
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,color=0xbc8c5a)=>{
    const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshLambertMaterial({color,flatShading:true}));mesh.position.set(x,y,z);root.add(mesh);return mesh;
  };
  for(const x of [-.43,.43])box(.10,.70,.13,x,.35,0,0x784e2c);
  if(kind==='gate:broken'){
    box(.28,.055,.12,-.25,.028,.17).rotation.y=.3;
    box(.18,.055,.12,.26,.028,-.12).rotation.y=-.4;
  }else{
    box(.82,.09,.08,0,.25,0);
    if(kind==='gate:intact')box(.82,.09,.08,0,.50,0);
    else{
      box(.28,.09,.08,-.27,.50,0);
      box(.28,.09,.08,.27,.47,0).rotation.z=.14;
    }
    for(const x of [-.41,.41])box(.03,.035,.025,x,.50,.06,0x8c8896);
  }
  return root;
}
