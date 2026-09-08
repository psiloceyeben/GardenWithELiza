import { moveActor, lotAtPx, type Village, type Lot } from "@shared/world";
import * as P from "@shared/protocol";
import { speedMult } from "@shared/economy";

/** Both renderers predict in server pixel coordinates, using the shared collision map. */
export function predictMovement(
  village: Village,
  position: { x: number; y: number },
  input: { x: number; y: number },
  dt: number,
  level: number,
  carrying: string | null,
  ownerId: string,
  lots: { geo: Lot; lot: P.PublicLot }[],
  gateClosed: (x: number, y: number) => boolean,
): { x: number; y: number } {
  const len = Math.hypot(input.x, input.y);
  if (!len) return position;
  let speed = P.BASE_SPEED * speedMult(level);
  const geo = lotAtPx(village, position.x, position.y);
  const lot = geo ? lots.find((v) => v.geo.id === geo.id)?.lot : undefined;
  if (carrying) {
    speed *= P.CARRY_SPEED;
    if (lot && lot.ownerId !== ownerId && lot.defenses.sprinkler)
      speed *= P.SPRINKLER_SPEED;
  }
  if (lot && lot.ownerId !== ownerId && lot.defenses.mud) speed *= P.MUD_SPEED;
  return moveActor(
    village,
    position.x,
    position.y,
    (input.x / len) * speed * Math.min(dt, 0.05),
    (input.y / len) * speed * Math.min(dt, 0.05),
    gateClosed,
  );
}
