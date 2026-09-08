/** One finger owns movement; secondary touches must not steal or release it. */
export class Joystick {
  pointer: number | null = null;
  private origin = { x: 0, y: 0 };
  value = { x: 0, y: 0 };
  knob = { x: 0, y: 0 };
  start(id: number, x: number, y: number): boolean {
    if (this.pointer !== null) return false;
    this.pointer = id; this.origin = { x, y }; this.value = { x: 0, y: 0 }; this.knob = { x: 0, y: 0 };
    return true;
  }
  move(id: number, x: number, y: number): void {
    if (id !== this.pointer) return;
    const dx = x - this.origin.x, dy = y - this.origin.y, length = Math.hypot(dx, dy);
    const fraction = Math.min(1, length / 34), nx = length ? dx / length : 0, ny = length ? dy / length : 0;
    this.value = { x: fraction > 0.25 ? nx : 0, y: fraction > 0.25 ? ny : 0 };
    this.knob = { x: nx * fraction * 34, y: ny * fraction * 34 };
  }
  end(id: number): void { if (id === this.pointer) this.reset(); }
  reset(): void { this.pointer = null; this.value = { x: 0, y: 0 }; this.knob = { x: 0, y: 0 }; }
}
