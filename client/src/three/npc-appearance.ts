import type { AvatarAppearance } from './visual-avatar';

// Existing NPC sprite palette from tools/sprites/gen_world.py NPC remaps.
// These are authored town roles, never selectable/unlocked player cosmetics.
const PALETTE:Record<string,{body:string;hat:number}> = {
  mayor:{body:'#9646b4',hat:0x18121e},
  seedwife:{body:'#469640',hat:0xdebe3c},
  barkeep:{body:'#784e2c',hat:0xf0e8d2},
  oracle:{body:'#5a2882',hat:0x78c8f0},
  warden:{body:'#444050',hat:0x8c8896},
  seller:{body:'#d03434',hat:0xf0e8d2},
};
export function npcAppearance(id:string):{appearance:Partial<AvatarAppearance>;hatTint:number}|null {
  if(!Object.prototype.hasOwnProperty.call(PALETTE,id))return null;
  const palette=PALETTE[id];
  return {appearance:{preset:'wanderer',bodyColor:palette.body,skinColor:'#e8c8a0',
    pantsColor:'#482c1c',hairColor:'#482c1c',eyeColor:'#18121e'},hatTint:palette.hat};
}
