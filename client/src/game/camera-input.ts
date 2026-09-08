/** Rotate screen input onto the server's flat x/y plane. Camera yaw is the
 * bearing from its focus toward its position; screen up has negative y.
 * Pitch never participates, so looking upward cannot slow movement. */
export function cameraInput(x: number, y: number, yaw: number): { x:number; y:number } {
  if (![x,y,yaw].every(Number.isFinite)) return { x:0, y:0 };
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { x:x*c+y*s, y:-x*s+y*c };
}
