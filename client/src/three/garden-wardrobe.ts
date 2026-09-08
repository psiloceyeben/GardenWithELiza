import { Group, Mesh, MeshLambertMaterial, CylinderGeometry, SphereGeometry, BoxGeometry } from 'three';

// Same C/r/G/P/o/t palette order as tools/sprites/gen_world.py and gen.py.
export const GARDEN_SHIRTS=['#3c78dc','#d03434','#469640','#9646b4','#e88228','#3caaa0'] as const;
export const GARDEN_HATS=['straw','cap','top','bandana'] as const;
/** Presentation mapping only. Supplied indices must originate in server state;
 * invalid indices display the starter style, never authorize an item. */
export function gardenWardrobe(color:number,hat:number) {
  return {bodyColor:GARDEN_SHIRTS[Number.isInteger(color)&&color>=0&&color<6?color:0],hat:GARDEN_HATS[Number.isInteger(hat)&&hat>=0&&hat<4?hat:0]};
}
/** Original Pons hat meshes sized for Wander's named head attachment slot. */
export function gardenHat(style:typeof GARDEN_HATS[number], tint?:number):Group {
  const root=new Group();root.name='pons-hat-'+style;
  const color=tint ?? (style==='straw'?0xe9c65a:style==='cap'?0x3c78dc:style==='top'?0x211b2b:0xd03434);
  const material=new MeshLambertMaterial({color,flatShading:true});
  const add=(geometry:CylinderGeometry|SphereGeometry|BoxGeometry,y:number)=>{const mesh=new Mesh(geometry,material);mesh.position.y=y;root.add(mesh);return mesh;};
  if(style==='straw') {add(new CylinderGeometry(.31,.31,.025,12),0);add(new CylinderGeometry(.17,.19,.13,12),.065);}
  else if(style==='top') {add(new CylinderGeometry(.27,.27,.025,12),0);add(new CylinderGeometry(.18,.18,.28,12),.14);}
  else if(style==='cap') {add(new SphereGeometry(.20,12,6,0,Math.PI*2,0,Math.PI/2),0);const brim=add(new BoxGeometry(.28,.025,.20),0);brim.position.z=.18;}
  else {add(new CylinderGeometry(.19,.19,.07,12),0);const knot=add(new SphereGeometry(.06,8,6),-.01);knot.position.set(-.18,-.01,-.08);}
  return root;
}
