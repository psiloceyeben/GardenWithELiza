import * as T from 'three';
export function plazaModel(kind:string):T.Group|null {
  if(!['lamp','fountain','bench','board','stall','sign','pot','track'].includes(kind))return null;
  const root=new T.Group();root.name='plaza-'+kind;
  const add=(geometry:T.BufferGeometry,color:number,x:number,y:number,z:number)=>{
    const mesh=new T.Mesh(geometry,new T.MeshLambertMaterial({color,flatShading:true}));mesh.position.set(x,y,z);root.add(mesh);return mesh;
  };
  if(kind==='lamp') {
    add(new T.BoxGeometry(.30,.10,.30),0x444050,0,.05,0);
    add(new T.BoxGeometry(.09,1.15,.09),0x444050,0,.65,0);
    add(new T.BoxGeometry(.36,.08,.30),0x482c1c,0,1.20,0);
    add(new T.BoxGeometry(.36,.08,.30),0x482c1c,0,1.53,0);
    for(const x of [-.14,.14])for(const z of [-.11,.11])add(new T.BoxGeometry(.04,.30,.04),0x482c1c,x,1.365,z);
    const glass=new T.Mesh(new T.BoxGeometry(.24,.24,.19),new T.MeshBasicMaterial({color:0x444050}));glass.position.y=1.365;root.add(glass);root.userData.glass=glass;
    add(new T.ConeGeometry(.23,.16,4),0x482c1c,0,1.65,0).rotation.y=Math.PI/4;
  } else if(kind==='fountain') {
    add(new T.CylinderGeometry(.90,.90,.14,16),0x8c8896,0,.07,0);
    const rim=add(new T.TorusGeometry(.80,.085,5,16),0x8c8896,0,.19,0);rim.rotation.x=Math.PI/2;
    add(new T.CylinderGeometry(.75,.75,.035,16),0x3c78dc,0,.17,0);
    add(new T.CylinderGeometry(.08,.11,.68,8),0x8c8896,0,.49,0);
    add(new T.CylinderGeometry(.29,.15,.12,12),0x8c8896,0,.87,0);
    add(new T.CylinderGeometry(.23,.23,.025,12),0x3c78dc,0,.94,0);
    add(new T.CylinderGeometry(.022,.035,.40,6),0x78c8f0,0,1.13,0);
    for(const sign of [-1,1])add(new T.BoxGeometry(.04,.07,.04),0x78c8f0,sign*.12,1.17,0);
  } else if(kind==='bench') {
    for(const x of [-.65,.65])for(const z of [-.18,.18])add(new T.BoxGeometry(.10,.42,.10),0x784e2c,x,.21,z);
    add(new T.BoxGeometry(1.55,.10,.55),0xbc8c5a,0,.45,0);
    for(const x of [-.65,.65])add(new T.BoxGeometry(.10,.60,.10),0x784e2c,x,.67,-.20);
    for(const y of [.68,.88])add(new T.BoxGeometry(1.55,.13,.08),0xbc8c5a,0,y,-.23);
  } else if(kind==='board' || kind==='sign') {
    const board=kind==='board',width=board?1.4:.75,height=board?1.2:.72;
    for(const x of board?[-.50,.50]:[0])add(new T.BoxGeometry(.10,height,.10),0x482c1c,x,height/2,0);
    add(new T.BoxGeometry(width,board?.75:.38,.12),0x784e2c,0,height,0);
    add(new T.BoxGeometry(width-.12,board?.63:.26,.015),board?0xf0e8d2:0xbc8c5a,0,height,.07);
    for(let i=0;i<(board?4:2);i++)add(new T.BoxGeometry(width*.60,.025,.012),board?0x444050:0xf0e8d2,-.04,height+.15-i*.10,.085);
  } else if(kind==='stall') {
    add(new T.BoxGeometry(1.5,.65,.72),0xbc8c5a,0,.325,0);
    for(const x of [-.70,.70])for(const z of [-.30,.30])add(new T.BoxGeometry(.08,1.5,.08),0x784e2c,x,.75,z);
    for(let i=0;i<8;i++)add(new T.BoxGeometry(.20,.12,.88),i%2?0xd03434:0xf0e8d2,-.70+i*.20,1.52,0);
    for(const [i,color] of [0x469640,0xe88228,0xfae66e,0xf096b4,0xd03434].entries())add(new T.SphereGeometry(.09,6,4),color,-.5+i*.25,.74,.10);
  } else if(kind==='pot') {
    add(new T.CylinderGeometry(.20,.15,.30,8),0xb45418,0,.15,0);
    add(new T.CylinderGeometry(.23,.23,.08,8),0xe88228,0,.31,0);
    add(new T.SphereGeometry(.20,8,5),0x469640,0,.48,0);
    for(const x of [-.09,.09])add(new T.BoxGeometry(.06,.06,.06),x<0?0xd03434:0xfae66e,x,.62,.07);
  } else {
    add(new T.BoxGeometry(1.98,.012,.98),0xc8a078,0,.009,0);
    for(const z of [-.38,.38])add(new T.BoxGeometry(1.98,.004,.06),0xf0e8d2,0,.018,z);
    for(let i=0;i<5;i++)add(new T.BoxGeometry(.16,.004,.06),0xf0e8d2,-.80+i*.4,.018,0);
  }
  return root;
}
/** Fixed night-state switch; no flicker, moving ground texture or extra lights. */
export function updatePlazaModel(root:T.Group,night:number):void {
  const glass=root.userData.glass as T.Mesh<T.BoxGeometry,T.MeshBasicMaterial>|undefined;
  if(glass)glass.material.color.setHex(night>.3?0xfae66e:0x444050);
}
