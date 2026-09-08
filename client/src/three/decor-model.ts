import * as T from 'three';
/** Original scenery and plot-condition visuals: no colliders, lights or gameplay state. */
export function decorModel(kind:string):T.Group|null {
  if(!['stump','decor0','decor1','decor2','weeds'].includes(kind))return null;
  const root=new T.Group();root.name=kind;
  const add=(g:T.BufferGeometry,color:number,x:number,y:number,z:number)=>{
    const mesh=new T.Mesh(g,new T.MeshLambertMaterial({color,flatShading:true}));mesh.position.set(x,y,z);root.add(mesh);return mesh;
  };
  if(kind==='weeds'){
    // Low perimeter clumps keep the plant's face visible from every camera angle.
    // Static geometry deliberately avoids adding motion to the garden floor.
    for(let i=0;i<5;i++){
      const angle=i*Math.PI*2/5,x=Math.cos(angle)*.29,z=Math.sin(angle)*.29;
      for(const side of [-1,1]){
        const leaf=add(new T.ConeGeometry(.045,.16,4),side<0?0x245c30:0x4c8040,x,.11,z);
        leaf.rotation.z=Math.cos(angle+side*.6)*.4;
        leaf.rotation.x=Math.sin(angle+side*.6)*.4;
      }
    }
  }else if(kind==='stump'){
    add(new T.CylinderGeometry(.18,.23,.36,8),0x8c8896,0,.18,0);
    add(new T.CylinderGeometry(.175,.175,.012,8),0x444050,0,.366,0);
    const ring=add(new T.TorusGeometry(.09,.014,4,8),0x8c8896,0,.377,0);ring.rotation.x=Math.PI/2;
  }else if(kind==='decor0'){
    add(new T.CylinderGeometry(.16,.16,.06,8),0x1e6e6e,0,.03,0);
    for(const [i,h] of [.44,.63,.56,.38].entries()){
      const angle=i*Math.PI/2;
      const spike=add(new T.ConeGeometry(.07,h,4),0x78c8f0,Math.cos(angle)*.12,h/2+.04,Math.sin(angle)*.12);
      spike.rotation.z=Math.cos(angle)*-.22;spike.rotation.x=Math.sin(angle)*.22;
    }
  }else if(kind==='decor1'){
    add(new T.CylinderGeometry(.065,.075,.44,6),0xf0e8d2,0,.22,0);
    add(new T.SphereGeometry(.29,8,4,0,Math.PI*2,0,Math.PI/2),0xdc78e6,0,.44,0).scale.y=.55;
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3;add(new T.BoxGeometry(.065,.025,.065),0xfae66e,Math.cos(a)*.14,.58,Math.sin(a)*.14);}
  }else{
    add(new T.CylinderGeometry(.16,.16,.06,8),0x245c30,0,.03,0);
    for(let i=0;i<15;i++)add(new T.BoxGeometry(.06,.08,.06),i%2?0x1e6e6e:0x3caaa0,Math.sin(i*.65)*.125,.06+i*.058,Math.cos(i*.65)*.06);
    add(new T.SphereGeometry(.095,6,4),0xf096b4,Math.sin(14*.65)*.125,.94,Math.cos(14*.65)*.06);
  }
  return root;
}
