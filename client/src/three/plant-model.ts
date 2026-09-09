import * as THREE from 'three';
import type { MutationId } from '@shared/types';
import { mergeStatic } from './merge-static';

export const MODEL_SPECIES=['gorbulon_sprig','plain_gerald','concerned_radish','unlicensed_carrot','clammy_pete','cactusberry_vicar','sir_blombus','weeping_wumbus','melonhound','pumpkin_esquire','corn_that_knows','bamboo_inspector','duchess_turnip','lord_eggplant','yelling_tuber','low_ambition_tulip','sunflower_who_lied','bogwort','bartholomew_bean','pineapple_enforcer','grabby_bertrand','fraudulent_orchid'] as const;
const MODEL_ALIAS:Record<string,string>={husk_holdings:'corn_that_knows',rugg_capital:'gorbulon_sprig',moonwort:'plain_gerald',bagholly:'bartholomew_bean',pennysprout:'gorbulon_sprig',fernance_brothers:'bamboo_inspector',panopticus_palm:'bamboo_inspector',voltvine:'grabby_bertrand',ticker_tulip:'low_ambition_tulip',sprout_and_sons:'bartholomew_bean',divvy_fig:'bartholomew_bean',bullrush:'bamboo_inspector',everbloom:'sunflower_who_lied',middling_mills:'corn_that_knows',orchard_prime:'cactusberry_vicar',beargonia:'fraudulent_orchid',aunt_hazels:'bartholomew_bean',mahogany_board:'bamboo_inspector',cornerstone_cactus:'clammy_pete',custodian_cypress:'bamboo_inspector',circuit_sequoia:'bamboo_inspector',blue_chip_oak:'pumpkin_esquire',trillion_thistle:'pineapple_enforcer',orchard_giant:'melonhound',softwood:'sir_blombus',the_index:'bartholomew_bean',steady_eddy:'bamboo_inspector',short_squeeze:'grabby_bertrand',hedgeaway:'bartholomew_bean',reserve_bloom:'sunflower_who_lied'};
/** Listed species reuse authored models until the dedicated art pass lands (release plan 1.5). Ids are stable, so swapping a model later touches only this map. */
const modelId=(s:string):string=>MODEL_ALIAS[s]??s;
export const hasPlantModel=(species:string)=>MODEL_SPECIES.some(id=>id===modelId(species));
/** Authored species conversions; unsupported species retain their sprites. */
export function plantModel(species:string,stage:number):THREE.Group|null {
  const root=authoredPlantModel(modelId(species),stage);
  if(root){
    mergeStatic(root);
    if(modelId(species)==='low_ambition_tulip' && stage>=4){
      const body=new THREE.Group();body.name='sleepy-tulip-body';
      // Soil owns a distinct material, so batching leaves it separate.
      for(const child of [...root.children])if(child instanceof THREE.Mesh && child.material!==root.userData.materials[2])body.add(child);
      root.add(body);root.userData.idleBody=body;
    }
  }
  return root;
}

/** Sparse authored gags. Absolute phase avoids drift; soil remains unanimated. */
export function animatePlant(root:THREE.Group,time:number,reducedMotion=false):void {
  const pulse=(period:number,start:number)=>{
    const phase=Number.isFinite(time)?((time%period)+period)%period:0;
    return !reducedMotion && phase>start ? Math.sin((phase-start)/(period-start)*Math.PI)**2 : 0;
  };
  const brow=root.userData.idleBrow as THREE.Group|undefined;
  if(brow)brow.position.y=pulse(12000,10000)*.055;
  const eyes=root.userData.idleEyes as THREE.Group|undefined;
  if(eyes)eyes.scale.y=1-pulse(9000,8200)*.92;
  const body=root.userData.idleBody as THREE.Group|undefined;
  if(!body)return;
  body.rotation.x=pulse(12000,7000)*.18;
}
function authoredPlantModel(species:string,stage:number):THREE.Group|null {
  if(!hasPlantModel(species))return null;
  const root=new THREE.Group();root.name='plant-'+species;
  const green=new THREE.MeshLambertMaterial({color:0x469640,flatShading:true});
  const leaf=new THREE.MeshLambertMaterial({color:0x8cd25a,flatShading:true});
  const soil=new THREE.MeshLambertMaterial({color:0x60402c,flatShading:true});
  const ink=new THREE.MeshLambertMaterial({color:0x18121e,flatShading:true});
  // Dispose even unused stage-specific materials through a single owned list.
  root.userData.materials=[green,leaf,soil,ink];
  root.userData.colors=[0x469640,0x8cd25a,0x60402c,0x18121e];
  root.userData.tintIndices=[0,1];
  const add=(geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number)=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);root.add(mesh);return mesh;
  };
  const mound=add(new THREE.SphereGeometry(1,8,4),soil,0,.035,0);mound.scale.set(.27,.055,.23);
  stage=Math.max(0,Math.min(4,Math.floor(stage)));
  if(stage===0){add(new THREE.BoxGeometry(.06,.07,.06),green,0,.08,0);return root;}
  const f=stage===1?.35:stage===2?.5:stage===3?.75:1, h=.625*f;
  if(stage>=2 && species!=='gorbulon_sprig') {
    const material=(color:number,tint=false)=>{
      const m=new THREE.MeshLambertMaterial({color,flatShading:true});
      if(tint)root.userData.tintIndices.push(root.userData.materials.length);
      root.userData.materials.push(m);root.userData.colors.push(color);return m;
    };
    const carrot=species==='unlicensed_carrot',radish=species==='concerned_radish';
    const vicar=species==='cactusberry_vicar',cactus=vicar || species==='clammy_pete';
    const mushroom=species==='sir_blombus';
    const corn=species==='corn_that_knows',bamboo=species==='bamboo_inspector';
    const turnip=species==='duchess_turnip',eggplant=species==='lord_eggplant',tuber=species==='yelling_tuber';
    const tulip=species==='low_ambition_tulip',sunflower=species==='sunflower_who_lied',flower=tulip || sunflower;
    const pod=species==='bogwort',bush=species==='bartholomew_bean',pineapple=species==='pineapple_enforcer';
    const flytrap=species==='grabby_bertrand',orchid=species==='fraudulent_orchid';
    const wumbus=species==='weeping_wumbus',hound=species==='melonhound',pumpkin=species==='pumpkin_esquire',round=wumbus || hound || pumpkin;
    const body=material((flytrap || orchid)?0x469640:pod?0x469640:bush?0x245c30:pineapple?0xdebe3c:tulip?0xf096b4:sunflower?0xfae66e:eggplant?0x9646b4:tuber?0xbc8c5a:corn?0xfae66e:bamboo?0x469640:round?(wumbus?0x469640:0xe88228):mushroom?0xbc8c5a:cactus?(vicar?0x9646b4:0x469640):carrot?0xe88228:radish?0xd03434:0xf0e8d2,true);
    const shade=material((flytrap || orchid)?0x245c30:pod?0x8cd25a:bush?0x469640:pineapple?0xb45418:tulip?0xdc78e6:sunflower?0x784e2c:turnip?0x9646b4:eggplant?0xdc78e6:tuber?0x784e2c:corn?0xdebe3c:bamboo?0x245c30:round?(wumbus?0x245c30:hound?0xd03434:0xb45418):cactus?(vicar?0x5a2882:0x245c30):carrot?0xb45418:radish?0x8c1c28:0xc8a078,true);
    const white=material(0xf0e8d2);
    let faceY:number,faceZ:number,top:number;
    if(flytrap) {
      const jawY=.55*f+.08;faceY=jawY+.16*f;faceZ=.13*f;top=jawY+.22*f;
      add(new THREE.CylinderGeometry(.028*f,.035*f,.48*f,6),shade,0,.24*f+.08,0);
      for(const sign of [-1,1]) {
        const foliage=add(new THREE.SphereGeometry(1,8,4),body,sign*.12*f,.16*f+.08,0);foliage.scale.set(.16*f,.05*f,.07*f);
        const jaw=add(new THREE.SphereGeometry(1,12,6,0,Math.PI*2,sign>0?0:Math.PI/2,Math.PI/2),sign>0?body:shade,0,jawY+sign*.055*f,0);jaw.scale.set(.31*f,.17*f,.20*f);
        const lip=add(new THREE.CylinderGeometry(.31*f,.31*f,.025*f,12),sign>0?body:shade,0,jawY+sign*.055*f,0);lip.scale.z=.20/.31;
        for(let k=0;k<5;k++) {
          const tooth=add(new THREE.ConeGeometry(.018*f,.065*f,4),white,(k-2)*.10*f,jawY+sign*.025*f,.14*f);
          if(sign>0)tooth.rotation.z=Math.PI;
        }
      }
    } else if(orchid) {
      faceY=.70*f+.08;faceZ=.085*f;top=.98*f+.08;
      for(const sign of [-1,1]) {
        add(new THREE.ConeGeometry(.17*f,.65*f,5),body,sign*.18*f,.65*f+.08,0);
        add(new THREE.BoxGeometry(.02*f,.35*f,.02*f),shade,sign*.18*f,.62*f,.09*f);
      }
      const coat=material(0x784e2c),seam=material(0x482c1c);
      add(new THREE.BoxGeometry(.65*f,.43*f,.30*f),coat,0,.23*f+.08,0);
      for(const sign of [-1,1]) {
        const lapel=add(new THREE.BoxGeometry(.29*f,.025*f,.025*f),seam,sign*.14*f,.41*f+.08,.16*f);lapel.rotation.z=sign*.35;
      }
      for(let k=0;k<3;k++)add(new THREE.BoxGeometry(.025*f,.025*f,.025*f),ink,0,.18*f+k*.07*f,.16*f);
    } else if(pod || bush || pineapple) {
      const rx=(pod?.20:bush?.37:.28)*f,ry=(pod?.47:bush?.28:.37)*f,rz=(pod?.16:.27)*f,cy=ry+.10;
      faceY=pod?cy+.23*f:cy+.02*f;faceZ=pod?.20*f:rz*.98;top=cy+ry;
      const volume=add(new THREE.SphereGeometry(1,12,10),body,0,cy,0);volume.scale.set(rx,ry,rz);
      if(pod) {
        for(let i=0;i<3;i++) {const pea=add(new THREE.SphereGeometry(1,8,6),shade,0,cy+(.25-i*.25)*f,.10*f);pea.scale.set(.12*f,.12*f,.11*f);}
      } else if(bush) {
        for(const sign of [-1,1]) {const lobe=add(new THREE.SphereGeometry(1,10,7),shade,sign*.18*f,cy+.02*f,.02*f);lobe.scale.set(.22*f,.25*f,.24*f);}
        const berries=material(0xd03434);
        for(const [x,y,z] of [[-.27,.04,.16],[.27,.07,.15],[-.15,.20,.12],[.10,.19,.18],[.15,-.13,.22],[-.17,-.10,.21]])
          add(new THREE.SphereGeometry(.035*f,6,4),berries,x*f,cy+y*f,z*f);
      } else {
        for(let row=0;row<6;row++)for(let k=0;k<10;k++) {
          const v=(row-2.5)/3,r=.28*f*Math.sqrt(1-v*v),a=(k+row%2*.5)*Math.PI/5;
          const mark=add(new THREE.BoxGeometry(.045*f,.045*f,.025*f),shade,Math.sin(a)*r,cy+v*.35*f,Math.cos(a)*r*.965);mark.rotation.set(0,a,Math.PI/4);
        }
        for(let k=0;k<5;k++) {
          const a=k*Math.PI*2/5,leafTop=add(new THREE.ConeGeometry(.05*f,.28*f,4),green,Math.sin(a)*.10*f,top+.10*f,Math.cos(a)*.10*f);
          leafTop.rotation.set(Math.cos(a)*.3,0,-Math.sin(a)*.3);
        }
        if(stage===4)for(const sign of [-1,1]) {
          const arm=add(new THREE.BoxGeometry(.25,.06,.06),shade,sign*.075,cy-.13,.28);arm.rotation.z=sign*.2;
        }
      }
    } else if(flower) {
      const stemH=(tulip?.48:.64)*f;faceY=stemH+.20*f+.08;faceZ=(tulip?.205:.10)*f;top=faceY+.21*f;
      add(new THREE.CylinderGeometry(.025*f,.035*f,stemH,6),green,0,stemH/2+.08,0);
      const foliage=add(new THREE.SphereGeometry(1,8,4),green,-.12*f,.22*f+.08,0);foliage.scale.set(.16*f,.05*f,.065*f);foliage.rotation.z=-.2;
      if(tulip) {
        add(new THREE.CylinderGeometry(.22*f,.15*f,.30*f,10),body,0,faceY,0);
        for(let k=0;k<6;k++) {
          const angle=k*Math.PI/3;
          add(new THREE.ConeGeometry(.065*f,.12*f,4),body,Math.sin(angle)*.17*f,faceY+.19*f,Math.cos(angle)*.17*f);
        }
        for(const sign of [-1,1])add(new THREE.BoxGeometry(.022*f,.22*f,.025),shade,sign*.13*f,faceY,.16*f);
      } else {
        const disk=add(new THREE.SphereGeometry(1,12,6),shade,0,faceY,0);disk.scale.set(.19*f,.19*f,.10*f);
        for(let k=0;k<8;k++) {
          const a=k*Math.PI/4,petal=add(new THREE.SphereGeometry(1,8,5),body,Math.sin(a)*.26*f,faceY+Math.cos(a)*.26*f,0);
          petal.scale.set(.085*f,.14*f,.06*f);petal.rotation.z=-a;
        }
      }
    } else if(turnip || eggplant || tuber) {
      const rx=(eggplant?.23:tuber?.36:.29)*f,ry=(eggplant?.43:tuber?.27:.29)*f,rz=(eggplant?.23:.28)*f;
      faceY=ry+.10;faceZ=rz*.98;top=faceY+ry;
      const rootBody=add(new THREE.SphereGeometry(1,12,9),body,0,faceY,0);rootBody.scale.set(rx,ry,rz);
      if(turnip) {
        const shoulder=add(new THREE.SphereGeometry(1.005,12,6,0,Math.PI*2,0,Math.PI/2),shade,0,faceY+.02*f,0);shoulder.scale.set(rx,ry,rz);
        const tip=add(new THREE.ConeGeometry(.04*f,.14*f,6),body,0,.07,0);tip.rotation.z=Math.PI;
        if(stage===4) {
          const gold=material(0xf0c434);add(new THREE.CylinderGeometry(.17,.16,.05,8),gold,0,top+.025,0);
          for(let k=0;k<5;k++){const a=k*Math.PI*2/5;add(new THREE.ConeGeometry(.05,.09,4),gold,Math.sin(a)*.12,top+.09,Math.cos(a)*.12);}
        }
      } else if(eggplant) {
        const cap=add(new THREE.ConeGeometry(.16*f,.10*f,5),green,0,top-.01*f,0);cap.rotation.z=Math.PI;
        add(new THREE.CylinderGeometry(.025*f,.03*f,.12*f,5),green,0,top+.05*f,0);
        const shine=add(new THREE.SphereGeometry(1,6,4),shade,-.11*f,faceY+.15*f,.19*f);shine.scale.set(.025*f,.09*f,.02*f);
      } else {
        for(const [x,y] of [[-.17,.10],[.19,.09],[-.23,-.07],[.15,-.13],[0,.20]])
          add(new THREE.BoxGeometry(.05*f,.023*f,.02),shade,x*f,faceY+y*f,rz*Math.sqrt(Math.max(.1,1-x*x/.13-y*y/.08)));
        if(stage===4) {
          add(new THREE.BoxGeometry(.19,.15,.035),ink,0,faceY-.07,faceZ);
          const tongue=material(0xd03434);add(new THREE.BoxGeometry(.09,.04,.015),tongue,0,faceY-.12,faceZ+.025);
          add(new THREE.BoxGeometry(.15,.025,.015),white,0,faceY-.008,faceZ+.025);
        }
      }
    } else if(corn) {
      top=.95*f+.08;faceY=.62*f+.08;faceZ=.205*f;
      const cob=add(new THREE.SphereGeometry(1,12,12),body,0,.48*f+.08,0);cob.scale.set(.21*f,.47*f,.21*f);
      for(let row=0;row<8;row++)for(let col=0;col<10;col++) {
        const v=(row-3.5)/4,r=.205*f*Math.sqrt(1-v*v),a=col*Math.PI/5;
        const kernel=add(new THREE.BoxGeometry(.025*f,.045*f,.025*f),shade,Math.sin(a)*r,.48*f+.08+v*.45*f,Math.cos(a)*r);
        kernel.rotation.y=a;
      }
      for(const sign of [-1,1]) {
        const husk=add(new THREE.ConeGeometry(.10*f,.62*f,5),green,sign*.21*f,.35*f,0);husk.rotation.z=-sign*.20;
      }
    } else if(bamboo) {
      top=.98*f+.08;faceY=top-.18*f;faceZ=.082*f;
      for(const [i,ratio] of [.74,1,.83].entries()) {
        const x=(i-1)*.19*f,stalkH=.98*f*ratio;
        add(new THREE.CylinderGeometry((i===1?.08:.05)*f,(i===1?.08:.05)*f,stalkH,8),body,x,stalkH/2+.08,0);
        for(let y=.22*f;y<stalkH;y+=.18*f)add(new THREE.CylinderGeometry((i===1?.085:.055)*f,(i===1?.085:.055)*f,.025*f,8),shade,x,y+.08,0);
        const foliage=add(new THREE.SphereGeometry(1,6,4),leaf,x+.10*f,stalkH+.02,0);foliage.scale.set(.12*f,.03*f,.05*f);foliage.rotation.z=.2;
      }
      if(stage===4) {
        const board=material(0x784e2c),paper=material(0xf0e8d2);
        add(new THREE.BoxGeometry(.19,.25,.04),board,.20,.36,.13);
        add(new THREE.BoxGeometry(.15,.20,.015),paper,.20,.36,.16);
        for(let i=0;i<3;i++)add(new THREE.BoxGeometry(.09,.015,.01),ink,.20,.40-i*.05,.172);
        add(new THREE.BoxGeometry(.065,.035,.02),shade,.20,.48,.17);
      }
    } else if(round) {
      const rx=(pumpkin?.42:.35)*f,ry=(pumpkin?.26:.30)*f,rz=.30*f;
      faceY=ry+.1;faceZ=rz*.98;top=faceY+ry;
      const fruit=add(new THREE.SphereGeometry(1,16,10),body,0,faceY,0);fruit.scale.set(rx,ry,rz);
      for(let k=0;k<(pumpkin?10:6);k++) {
        const stripe=add(new THREE.SphereGeometry(1.008,2,10,k*Math.PI*2/(pumpkin?10:6),.05),shade,0,faceY,0);
        stripe.scale.set(rx,ry,rz);
      }
      const stem=material(pumpkin?0x245c30:0x784e2c);
      add(new THREE.BoxGeometry(.06*f,.10*f,.06*f),stem,0,top+.03*f,0);
      if(stage===4 && pumpkin) {
        const gold=material(0xf0c434);
        add(new THREE.TorusGeometry(.065,.012,4,12),gold,.085,faceY+.025,faceZ+.025);
        add(new THREE.BoxGeometry(.012,.18,.012),gold,.15,faceY-.08,faceZ+.02);
      }
      if(stage===4 && (wumbus || hound)) {
        const water=material(0x78c8f0),drop=add(new THREE.SphereGeometry(1,6,4),water,wumbus?-.09:.15,faceY-.055,faceZ+.01);
        drop.scale.set(.025,wumbus?.065:.04,.02);
      }
    } else if(mushroom) {
      top=.52*f+.1;faceY=top-.14*f;faceZ=.15*f;
      add(new THREE.CylinderGeometry(.15*f,.17*f,.5*f,8),body,0,.25*f+.08,0);
      const cap=material(0xd03434,true);
      const dome=add(new THREE.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI/2),cap,0,top,0);
      dome.scale.set(.40*f,.25*f,.40*f);
      add(new THREE.CylinderGeometry(.40*f,.40*f,.035*f,12),cap,0,top,0);
      for(const [dx,dz] of [[-.20,.10],[.10,.22],[.22,-.12],[-.08,-.18]]) {
        const dot=add(new THREE.SphereGeometry(.045*f,6,4),white,dx*f,top+.25*f*Math.sqrt(1-(dx*dx+dz*dz)/.16),dz*f);
        dot.scale.y=.35;
      }
      if(stage===4) {
        const steel=material(0x8c8896),gold=material(0xf0c434),grip=material(0x482c1c);
        add(new THREE.BoxGeometry(.04,.33,.03),steel,.29,.30,.05);
        add(new THREE.ConeGeometry(.028,.07,4),steel,.29,.50,.05);
        add(new THREE.BoxGeometry(.14,.035,.05),gold,.29,.13,.05);
        add(new THREE.BoxGeometry(.035,.10,.035),grip,.29,.065,.05);
      }
    } else if(cactus) {
      top=.8*f+.1;faceY=top-.16*f;faceZ=.15*f;
      add(new THREE.BoxGeometry(.29*f,.8*f,.28*f),body,0,.4*f+.1,0);
      add(new THREE.BoxGeometry(.025,.7*f,.02),shade,-.09*f,.43*f,.15*f);
      for(const sign of [-1,1]) {
        const armY=(sign<0?.44:.38)*f+.1;
        add(new THREE.BoxGeometry(.18*f,.09*f,.10*f),body,sign*.22*f,armY,0);
        add(new THREE.BoxGeometry(.09*f,.23*f,.10*f),body,sign*.30*f,armY+.09*f,0);
        for(let k=0;k<5;k++) {
          const spine=add(new THREE.ConeGeometry(.014*f,.07*f,4),white,sign*.17*f,.19*f+k*.12*f,.03);
          spine.rotation.z=-sign*Math.PI/2;
        }
      }
      if(stage===4 && vicar) {
        const gold=material(0xf0c434);
        add(new THREE.CylinderGeometry(.19,.18,.07,8),gold,0,top+.035,0);
        for(let k=0;k<5;k++){const a=k*Math.PI*2/5;add(new THREE.ConeGeometry(.055,.11,4),gold,Math.sin(a)*.14,top+.10,Math.cos(a)*.14);}
      }
      if(stage===4 && !vicar) {
        const sweat=material(0x78c8f0),drop=add(new THREE.SphereGeometry(1,6,4),sweat,.13,faceY-.04,.16);
        drop.scale.set(.025,.045,.02);
      }
    } else if(carrot) {
      top=.78*f+.1;faceY=top-.15*f;faceZ=.20*f;
      add(new THREE.CylinderGeometry(.27*f,.035*f,.75*f,8),body,0,.375*f+.07,0);
      for(let i=0;i<3;i++)add(new THREE.BoxGeometry(.08*f,.018,.02),shade,-.08*f,top-(.3+i*.12)*f,(.16-i*.035)*f);
      if(stage===4) {
        const suit=material(0x444050),tie=material(0xd03434),leather=material(0x482c1c);
        add(new THREE.BoxGeometry(.28,.17,.05),suit,0,.49,.16);
        add(new THREE.BoxGeometry(.035,.14,.02),tie,0,.49,.19);
        add(new THREE.BoxGeometry(.19,.15,.10),leather,.30,.22,.02);
        add(new THREE.TorusGeometry(.035,.012,4,8),leather,.30,.32,.02);
      }
    } else {
      const r=.27*f+.025;faceY=r+.10;faceZ=r*.88;top=faceY+r;
      const bulb=add(new THREE.SphereGeometry(1,10,7),body,0,faceY,0);bulb.scale.set(r,radish?r:r*.88,r*.9);
      if(radish) {
        const tip=add(new THREE.ConeGeometry(.06*f,.14*f,6),white,0,.07,0);tip.rotation.z=Math.PI;
      } else {
        add(new THREE.ConeGeometry(r*.65,.20*f,8),body,0,top+.05*f,0);top+=.15*f;
        for(const sign of [-1,1])add(new THREE.BoxGeometry(.022,.24*f,.02),shade,sign*.17*f,faceY,faceZ*.9);
      }
    }
    for(const sign of [-1,0,1]) {
      if(cactus || mushroom || round || corn || bamboo || eggplant || tuber || flower || pod || bush || pineapple || flytrap || orchid || (turnip && stage===4))continue;
      if(!radish && !carrot && sign!==0)continue;
      const stalk=add(new THREE.CylinderGeometry(.018,.024,.17*f,5),green,sign*.045*f,top+.07*f,0);
      stalk.rotation.z=-sign*.35;
      if(radish) {const foliage=add(new THREE.SphereGeometry(1,6,4),leaf,sign*.09*f,top+.16*f,0);foliage.scale.set(.07*f,.05*f,.035*f);}
    }
    const blinking=species==='plain_gerald' && stage===4 ? new THREE.Group() : null;
    if(blinking){blinking.name='gerald-blinking-eyes';blinking.position.y=faceY+.025*f;root.add(blinking);root.userData.idleEyes=blinking;}
    for(const sign of [-1,1]) {
      const eye=add(new THREE.BoxGeometry((bamboo?.025:.045)*f,((corn || (tulip && stage===4))?.025:.065)*f,.025),ink,sign*(orchid?.18:bamboo?.035:.085)*f,faceY+.025*f,faceZ);
      if(blinking){eye.position.y=0;blinking.add(eye);}
    }
    if(!flytrap && !orchid)add(new THREE.BoxGeometry(.10*f,.02,.025),ink,0,faceY-.065*f,faceZ);
    if((cactus && !vicar) || mushroom || hound || turnip || eggplant || bush)for(const sign of [-1,1])add(new THREE.BoxGeometry(.02,.035*f,.025),ink,sign*.06*f,faceY-.045*f,faceZ);
    if(radish || wumbus || pod) {
      for(const sign of [-1,1])add(new THREE.BoxGeometry(.02,.035*f,.025),ink,sign*.06*f,faceY-.08*f,faceZ);
      if(stage===4 && radish){const tear=material(0x78c8f0);const drop=add(new THREE.SphereGeometry(1,6,4),tear,.16,faceY-.02,faceZ);drop.scale.set(.025,.045,.02);}
    }
    return root;
  }
  add(new THREE.CylinderGeometry(.035,.04,h,6),green,0,h/2+.05,0);
  for(const sign of [-1,1]) {
    const mesh=add(new THREE.SphereGeometry(1,8,4),leaf,sign*.13*f,h*.5,.01);
    mesh.scale.set(.15*f,.055*f,.08*f);mesh.rotation.z=sign*.2;
  }
  if(stage===1)return root;
  const headY=h+.08, head=add(new THREE.SphereGeometry(1,10,6),leaf,0,headY,0);
  head.scale.set(.22*f+.06,.15*f+.06,.17*f+.04);
  for(const sign of [-1,1]) {
    add(new THREE.BoxGeometry(.055*f,.065*f,.025),ink,sign*.095*f,headY+.035*f,.17*f+.04);
  }
  if(stage===4) {
    const brow=new THREE.Group();brow.name='gorbulon-knowing-brow';root.add(brow);root.userData.idleBrow=brow;
    const mesh=add(new THREE.BoxGeometry(.29,.03,.03),ink,0,headY+.11,.19);
    mesh.rotation.z=-.08;brow.add(mesh);
  }
  add(new THREE.BoxGeometry(.09*f,.02,.025),ink,0,headY-.065*f,.17*f+.04);
  for(const sign of [-1,1])add(new THREE.BoxGeometry(.02,.035*f,.025),ink,sign*.055*f,headY-.047*f,.17*f+.04);
  return root;
}
export function stylePlant(root:THREE.Group,mutation:MutationId,time:number):void {
  root.scale.setScalar(mutation==='colossal'?1.5:1);
  // Rotate a real volume rather than mirroring a camera-facing plane.
  root.rotation.y=mutation==='backwards'?Math.PI:0;
  const colors=root.userData.colors as number[];
  (root.userData.materials as THREE.MeshLambertMaterial[]).forEach((mat,i)=>{
    mat.color.setHex(colors[i]);
    if(root.userData.tintIndices.includes(i) && mutation==='golden')mat.color.setHex(0xffdf78);
    if(root.userData.tintIndices.includes(i) && mutation==='holographic')mat.color.setHSL((time/20000)%1,.45,.65);
  });
}
export function disposePlant(root:THREE.Group):void {
  root.removeFromParent();
  root.traverse(object=>{if(object instanceof THREE.Mesh)object.geometry.dispose();});
  for(const material of root.userData.materials ?? [])material.dispose();
  root.userData.materials=[];root.clear();
}
