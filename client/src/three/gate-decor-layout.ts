export function gateDecorLayout(gate:{x:number;y:number},side:'top'|'bottom'|'left'|'right') {
  const normal=side==='top'?{x:0,y:-1}:side==='left'?{x:-1,y:0}:side==='right'?{x:1,y:0}:{x:0,y:1};
  const point=(along:number,outward:number)=>({x:gate.x+normal.y*along+normal.x*outward,y:gate.y-normal.x*along+normal.y*outward});
  return {lamps:[point(-40,10),point(40,10)],sign:point(66,18),rotation:Math.atan2(normal.x,normal.y)};
}
