// Tiny WebAudio chiptune cues. No assets; unlocked on first pointer.
class Sfx {
  private ctx: AudioContext | null = null;

  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.06, glideTo?: number, delay = 0): void {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  buy(): void { this.tone(660, 0.08); this.tone(880, 0.1, 'square', 0.06, undefined, 0.08); }
  plant(): void { this.tone(180, 0.12, 'triangle', 0.08, 120); }
  tend(): void { this.tone(520, 0.06, 'sine', 0.05); this.tone(640, 0.06, 'sine', 0.05, undefined, 0.06); }
  reveal(tierIdx: number): void {
    const base = [330, 392, 440, 523, 587, 659];
    for (let i = 0; i <= Math.min(tierIdx + 1, 5); i++) this.tone(base[i], 0.12, 'square', 0.05, undefined, i * 0.09);
  }
  scream(): void { this.tone(240, 0.4, 'sawtooth', 0.1, 140); }
  deny(): void { this.tone(160, 0.12, 'square', 0.05, 110); }
}

export const sfx = new Sfx();
