export interface LabelBox {id:string;x:number;y:number;width:number;height:number}
/** Stable screen-space stacking; y is the bottom edge of a label. */
export function layoutLabels(labels:LabelBox[],viewportWidth:number):Map<string,{x:number;y:number;hidden:boolean}> {
  const placed:LabelBox[]=[],result=new Map<string,{x:number;y:number;hidden:boolean}>();
  for(const original of [...labels].sort((a,b)=>a.y-b.y || a.id.localeCompare(b.id))){
    const box={...original,x:Math.max(original.width/2+3,Math.min(viewportWidth-original.width/2-3,original.x))};
    for(let pass=0;pass<=placed.length;pass++){
      const hits=placed.filter(p=>Math.abs(box.x-p.x)<(box.width+p.width)/2+3 && box.y>p.y-p.height-3 && box.y-box.height<p.y+3);
      if(!hits.length)break;
      box.y=Math.min(...hits.map(p=>p.y-p.height-3));
    }
    const hidden=box.y-box.height<3 || original.y-box.y>96;
    result.set(box.id,{x:box.x,y:box.y,hidden});
    if(!hidden)placed.push(box);
  }
  return result;
}
