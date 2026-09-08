/** Server and renderers share the same pixel-space patrol phase. */
export function gnomePatrol(center:{x:number;y:number},serverMs:number):{x:number;y:number;angle:number} {
  const angle=serverMs/1500;
  return {x:center.x+Math.cos(angle)*52,y:center.y+Math.sin(angle)*40,angle};
}
