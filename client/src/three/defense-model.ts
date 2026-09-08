import * as T from 'three';
export function defenseModel(kind:string):T.Group|null {
  if(kind!=='sprinkler' && !/^gnome:(-1|0|1|2)$/.test(kind))return null;
  const root=new T.Group();root.name=kind;
  const add=(g:T.BufferGeometry,c:number,x:number,y:number,z:number)=>{const m=new T.Mesh(g,new T.MeshLambertMaterial({color:c,flatShading:true}));m.position.set(x,y,z);root.add(m);return m;};
  if(kind==='sprinkler'){
    add(new T.CylinderGeometry(.13,.16,.06,8),0x444050,0,.03,0);
    add(new T.CylinderGeometry(.055,.055,.30,6),0x8c8896,0,.20,0);
    add(new T.CylinderGeometry(.13,.13,.08,8),0x444050,0,.39,0);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;add(new T.BoxGeometry(.045,.035,.045),0x78c8f0,Math.cos(a)*.29,.51,Math.sin(a)*.29);}
    return root;
  }
  for(const x of [-.09,.09])add(new T.BoxGeometry(.11,.12,.18),0x482c1c,x,.06,.02);
  add(new T.BoxGeometry(.28,.28,.22),0x3c78dc,0,.25,0);
  add(new T.BoxGeometry(.25,.20,.22),0xe8c8a0,0,.48,0);
  add(new T.SphereGeometry(.16,6,4),0xffffff,0,.36,.12).scale.set(1,.75,.5);
  for(const x of [-.065,.065])add(new T.BoxGeometry(.035,.035,.025),0x18121e,x,.50,.122);
  add(new T.BoxGeometry(.06,.055,.06),0xe8c8a0,0,.445,.14);
  const hat=Number(kind.split(':')[1]);
  if(hat<=0){
    add(new T.ConeGeometry(.22,.37,6),hat===0?0x9646b4:0xd03434,0,.765,0);
    add(new T.CylinderGeometry(.23,.23,.045,8),hat===0?0x5a2882:0x8c1c28,0,.60,0);
    if(hat===0)add(new T.BoxGeometry(.045,.045,.025),0xfae66e,0,.72,.16);
  }else if(hat===1){
    add(new T.CylinderGeometry(.18,.18,.13,8),0xf0c434,0,.645,0);
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;add(new T.BoxGeometry(.05,.10,.05),0xf0c434,Math.cos(a)*.15,.75,Math.sin(a)*.15);}
    add(new T.BoxGeometry(.05,.05,.025),0xd03434,0,.65,.18);
  }else{
    add(new T.SphereGeometry(.19,8,4,0,Math.PI*2,0,Math.PI/2),0xd03434,0,.58,0).scale.y=.6;
    add(new T.BoxGeometry(.035,.12,.035),0x444050,0,.75,0);
    add(new T.BoxGeometry(.40,.025,.06),0xffffff,0,.82,0);
  }
  return root;
}
