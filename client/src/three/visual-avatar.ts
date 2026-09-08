import type { Group, Mesh, Material, BufferGeometry, Object3D, Vector3 } from 'three';
import { CarryPose } from './carry-pose';
import { gardenWardrobe, gardenHat, GARDEN_HATS } from './garden-wardrobe';
import { HAIR_STYLES, SKIN_TONES } from '@shared/protocol';

export type AvatarPreset = 'wanderer'|'warden'|'scholar'|'forager'|'nomad'|'capybara'|'goblin'|'golem'|'doge'|'chad';
export interface AvatarAppearance {
  skinColor:string; bodyColor:string; pantsColor:string; hairColor:string; eyeColor:string;
  hairStyle:'short'|'long'|'bun'|'ponytail'|'shaved'; height:number;
  build:'slim'|'medium'|'stocky'; preset?:AvatarPreset;
}
export interface AvatarAsset {
  root:Group;
  slots:Record<string,Object3D>;
  state:AvatarAppearance;
  rebuild():void;
  animate(timeSeconds:number,moving:boolean,speed?:number):void;
}
export type AvatarFactory = (state:AvatarAppearance,options:{loadSaved:false})=>AvatarAsset;

/** Rendering-only bridge. Appearance comes from authoritative game state;
 * this class grants no ownership and never calls asset update/save/equip APIs. */
export class VisualAvatar {
  readonly root:Group;
  private asset:AvatarAsset;
  private disposed=false;
  private carryPose = new CarryPose();
  private appearanceKey:string;
  private hat:Group|null=null;
  private hatStyle:typeof GARDEN_HATS[number]|null=null;
  private hatTint:number|undefined;
  constructor(create:AvatarFactory,appearance:AvatarAppearance) {
    this.appearanceKey=JSON.stringify(appearance);
    this.asset=create({...appearance},{loadSaved:false}); this.root=this.asset.root;
  }
  setAppearance(appearance:AvatarAppearance):void {
    if(this.disposed) return;
    const key=JSON.stringify(appearance); if(key===this.appearanceKey)return;
    this.asset.state={...appearance};
    this.removeHat();
    this.asset.rebuild(); this.appearanceKey=key; this.attachHat();
  }
  setWardrobe(color:number,hat:number,skin=0,hair=0):void {
    if(this.disposed)return;
    const mapped=gardenWardrobe(color,hat);
    this.setAppearance({...this.asset.state,bodyColor:mapped.bodyColor,hairStyle:HAIR_STYLES[hair] ?? HAIR_STYLES[0],skinColor:SKIN_TONES[skin] ?? SKIN_TONES[0]});
    this.setHeadwear(mapped.hat);
  }
  /** Visual styling for authored NPCs, not a player entitlement API. */
  setHeadwear(style:typeof GARDEN_HATS[number],tint?:number):void {
    if(this.disposed || (this.hatStyle===style && this.hatTint===tint))return;
    this.hatStyle=style;this.hatTint=tint;this.removeHat();this.attachHat();
  }
  private attachHat():void {
    if(!this.hatStyle)return;
    const slot=this.asset.slots.head;
    if(!slot)throw new Error('Avatar has no head attachment slot');
    this.hat=gardenHat(this.hatStyle,this.hatTint);slot.add(this.hat);
  }
  private removeHat():void {
    if(!this.hat)return;
    disposeMeshes(this.hat);this.hat.removeFromParent();this.hat=null;
  }
  animate(seconds:number,moving:boolean,speed=1,carrying=false):void {
    if(!this.disposed && Number.isFinite(seconds) && Number.isFinite(speed)) {
      this.asset.animate(seconds,moving,Math.max(0,speed));
      this.carryPose.apply(this.root,carrying);
    }
  }
  carryPosition(target:Vector3):boolean {
    return !this.disposed && this.carryPose.position(this.root,target);
  }
  dispose():void {
    if(this.disposed)return; this.disposed=true; this.root.removeFromParent();
    disposeMeshes(this.root); this.hat=null;
    this.root.clear();
  }
}
function disposeMeshes(root:Object3D):void {
    const geometries=new Set<BufferGeometry>(),materials=new Set<Material>();
    for(const material of root.userData.ponsOwnedMaterials ?? [])materials.add(material);
    root.traverse(object=>{
      const mesh=object as Mesh;
      if(mesh.geometry)geometries.add(mesh.geometry);
      if(mesh.material)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(material);
    });
    for(const geometry of geometries)geometry.dispose();
    for(const material of materials)material.dispose();
    if(root.userData.ponsOwnedMaterials)root.userData.ponsOwnedMaterials=[];
    // Shared material-library textures remain owned by that library.
}
