/** Process-wide backstop for persistent garden creation, not a bot detector. */
export class SignupBudget {
  private tokens: number;
  constructor(private capacity = 200, private refillMs = 30000, private at = Date.now()) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000 || !Number.isInteger(refillMs) || refillMs < 1000 || refillMs > 3600000) throw new Error('Invalid signup budget configuration');
    this.tokens = capacity;
  }
  take(now: number): boolean {
    if (!Number.isFinite(now)) return false;
    this.tokens = Math.min(this.capacity, this.tokens + Math.max(0, now - this.at) / this.refillMs);
    this.at = Math.max(this.at, now);
    if (this.tokens < 1) return false;
    this.tokens -= 1; return true;
  }
}
