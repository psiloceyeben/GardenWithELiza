import type { AvatarAppearance, AvatarAsset, AvatarPreset } from '../visual-avatar';
import type { Group, Object3D } from 'three';
export class PlayerAvatar implements AvatarAsset {
  constructor(appearance?:Partial<AvatarAppearance>,options?:{loadSaved?:boolean});
  root:Group;
  slots:Record<string,Object3D>;
  state:AvatarAppearance;
  rebuild():void;
  animate(seconds:number,moving:boolean,speed?:number):void;
}
export const DEFAULT_CUSTOM:AvatarAppearance;
export const PLAYER_MODEL_PRESETS:Record<AvatarPreset,{label:string;meme:boolean;blurb:string;state:AvatarAppearance}>;
