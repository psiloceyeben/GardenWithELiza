/** Distance credit replenished by server time, never by packet count. */
export class MovementBudget {
  private credit = 6; // shared rounding/jitter allowance, not per packet
  constructor(private at: number) {}
  take(distance: number, speed: number, now: number): boolean {
    if (!Number.isFinite(distance) || distance < 0 || !Number.isFinite(speed) || speed < 0 || !Number.isFinite(now)) return false;
    const elapsed = Math.max(0, Math.min(500, now - this.at)) / 1000;
    this.at = Math.max(this.at, now);
    // Integer client coordinates slightly lengthen oblique paths. Allow 1%,
    // not the old 35% plus an independently renewable per-packet allowance.
    const rate = speed * 1.01;
    this.credit = Math.min(rate * 0.5 + 6, this.credit + rate * elapsed);
    if (distance > this.credit + 1e-7) return false;
    this.credit = Math.max(0, this.credit - distance);
    return true;
  }
}
