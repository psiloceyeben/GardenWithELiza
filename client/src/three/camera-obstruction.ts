import { Box3, Ray, Vector3 } from 'three';

/** Camera-only line-of-sight clipping against cached world-space solid bounds.
 * Padding covers the near plane; never changes the authoritative player. */
export function unobstructedCamera(focus:Vector3, desired:Vector3, solids:readonly Box3[], padding=0.25):Vector3 {
  const direction = desired.clone().sub(focus), distance = direction.length();
  if (distance < 1e-6) return focus.clone();
  direction.divideScalar(distance);
  const ray = new Ray(focus,direction), point = new Vector3();
  let allowed = distance;
  for (const bounds of solids) {
    const padded = bounds.clone().expandByScalar(padding);
    // No safe line of sight when the focus itself starts inside a solid.
    if (padded.containsPoint(focus)) return focus.clone();
    if (ray.intersectBox(padded,point)) allowed = Math.min(allowed,Math.max(0,point.distanceTo(focus)-0.01));
  }
  return focus.clone().addScaledVector(direction,allowed);
}
