/** Fixed freshness deadline, LRU eviction, and a hard compressed-byte budget. */
export class ImageCache {
  private entries = new Map<string, { at: number; buffer: Buffer }>();
  private bytes = 0;
  constructor(private ttl = 300_000, private maxBytes = 32 * 1024 * 1024, private maxEntries = 128, private now = Date.now) {}
  get(key: string): Buffer | undefined {
    const entry = this.entries.get(key); if (!entry) return;
    if (this.now() - entry.at >= this.ttl) { this.remove(key); return; }
    this.entries.delete(key); this.entries.set(key, entry); // move LRU order, never extend freshness
    return entry.buffer;
  }
  set(key: string, buffer: Buffer): void {
    this.remove(key);
    if (buffer.length > this.maxBytes) return;
    this.entries.set(key, { at: this.now(), buffer }); this.bytes += buffer.length;
    while (this.bytes > this.maxBytes || this.entries.size > this.maxEntries) this.remove(this.entries.keys().next().value!);
  }
  private remove(key: string): void {
    const old = this.entries.get(key); if (old) { this.bytes -= old.buffer.length; this.entries.delete(key); }
  }
}
