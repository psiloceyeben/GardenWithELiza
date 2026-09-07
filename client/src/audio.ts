// Tiny WebAudio chiptune: cues + a procedural ambient loop per biome. No assets; unlocked on first pointer.
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: { timer: number; step: number; biome: number } | null = null;
  private fountainNode: AudioBufferSourceNode | null = null;
  private fountainGain: GainNode | null = null;
  muted = false;
  get ready(): boolean { return !!this.ctx; }

  constructor() { try { this.muted = localStorage.getItem('pons.mute') === '1'; } catch { /* ignore */ } }

  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 1; this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean): void { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 1; try { localStorage.setItem('pons.mute', m ? '1' : '0'); } catch { /* ignore */ } }

  tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.06, glideTo?: number, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  }

  buy(): void { this.tone(660, 0.08); this.tone(880, 0.1, 'square', 0.06, undefined, 0.08); }
  plant(): void { this.tone(180, 0.12, 'triangle', 0.08, 120); }
  tend(): void { this.tone(520, 0.06, 'sine', 0.05); this.tone(640, 0.06, 'sine', 0.05, undefined, 0.06); }
  forage(): void { this.tone(440, 0.05, 'triangle', 0.06); this.tone(660, 0.05, 'triangle', 0.06, undefined, 0.05); this.tone(990, 0.1, 'triangle', 0.06, undefined, 0.1); }
  reveal(tierIdx: number): void { const base = [330, 392, 440, 523, 587, 659]; for (let i = 0; i <= Math.min(tierIdx + 1, 5); i++) this.tone(base[i], 0.12, 'square', 0.05, undefined, i * 0.09); }
  scream(): void { this.tone(240, 0.4, 'sawtooth', 0.1, 140); }
  deny(): void { this.tone(160, 0.12, 'square', 0.05, 110); }
  step(): void { this.tone(90 + Math.random() * 30, 0.03, 'triangle', 0.02, 60); }
  fanfare(): void { for (let i = 0; i < 4; i++) this.tone([523, 659, 784, 1046][i], 0.15, 'square', 0.05, undefined, i * 0.1); }

  /** Ambient: a slow arpeggio in a biome-specific scale plus a soft pad. Restarts when the biome changes. */
  ambientStart(biome: number): void {
    if (!this.ctx || (this.ambient && this.ambient.biome === biome)) return;
    this.ambientStop();
    const scales = [[0, 2, 4, 7, 9], [0, 3, 5, 7, 10], [0, 2, 3, 7, 8], [0, 4, 5, 7, 11], [0, 2, 5, 7, 9], [0, 3, 7, 10, 12], [0, 1, 5, 7, 8], [0, 4, 7, 9, 11]];
    const roots = [220, 196, 174, 233, 207, 246, 185, 261];
    const scale = scales[biome % 8]; const root = roots[biome % 8];
    const st = { timer: 0, step: 0, biome };
    const tick = () => {
      if (this.ambient !== st) return;
      const deg = scale[(st.step * 3 + Math.floor(st.step / 5)) % scale.length]; const oct = st.step % 8 < 4 ? 1 : 2;
      this.tone(root * Math.pow(2, deg / 12) * oct, 0.9, 'triangle', 0.018);
      if (st.step % 8 === 0) this.tone(root / 2, 3.2, 'sine', 0.02);
      st.step += 1; st.timer = window.setTimeout(tick, 420);
    };
    this.ambient = st; tick();
  }
  ambientStop(): void { if (this.ambient) { window.clearTimeout(this.ambient.timer); this.ambient = null; } }

  /** Fountain: filtered noise whose volume follows distance (0..1). */
  fountain(level: number): void {
    if (!this.ctx || !this.master) return;
    if (!this.fountainNode) {
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate); const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
      const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.6;
      const g = this.ctx.createGain(); g.gain.value = 0; src.connect(f).connect(g).connect(this.master); src.start();
      this.fountainNode = src; this.fountainGain = g;
    }
    this.fountainGain!.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.05, this.ctx.currentTime, 0.2);
  }
}

export const sfx = new Sfx();
