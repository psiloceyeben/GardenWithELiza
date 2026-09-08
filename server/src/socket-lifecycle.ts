interface Socket {
  readyState: number;
  bufferedAmount: number;
  ping(): void;
  terminate(): void;
}

/** One shared server timer checks these; no timer is allocated per connection. */
export class SocketLifecycle {
  private authenticated = false;
  private awaitingPong = false;
  private lastPing: number;
  constructor(private socket: Socket, private openedAt: number) { this.lastPing = openedAt; }
  authenticate(): void { this.authenticated = true; }
  pong(): void { this.awaitingPong = false; }
  check(now: number): void {
    if (this.socket.readyState !== 1) return;
    if ((!this.authenticated && now - this.openedAt >= 15000) || this.socket.bufferedAmount > 1024 * 1024) {
      this.socket.terminate(); return;
    }
    if (now - this.lastPing < 30000) return;
    if (this.awaitingPong) { this.socket.terminate(); return; }
    this.awaitingPong = true; this.lastPing = now;
    try { this.socket.ping(); } catch { this.socket.terminate(); }
  }
}
