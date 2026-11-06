/**
 * Sound engine — every effect is synthesised with the Web Audio API, so there
 * are no audio files to download and everything works offline.
 * The AudioContext is created lazily on the first user gesture to respect
 * browser autoplay rules.
 */
import type { SoundKey, SoundSettings } from '../types/settings';

type Ctx = AudioContext;

class SoundEngine {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private settings: SoundSettings | null = null;
  private muted = false;
  private spinSrc: AudioBufferSourceNode | null = null;
  private spinGain: GainNode | null = null;
  private spinFilter: BiquadFilterNode | null = null;
  private lastTick = 0;

  configure(settings: SoundSettings, muted: boolean): void {
    this.settings = settings;
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.masterLevel(), this.ctx.currentTime, 0.02);
    if (muted) this.stopSpin();
  }

  private masterLevel(): number {
    return this.muted || !this.settings ? 0 : this.settings.master / 100;
  }

  /** Must be called from a user gesture handler. Safe to call repeatedly. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC: typeof AudioContext | undefined =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC({ latencyHint: 'interactive' });
        this.master = this.ctx.createGain();
        this.master.gain.value = this.masterLevel();
        const comp = this.ctx.createDynamicsCompressor();
        this.master.connect(comp).connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private vol(key: SoundKey): number {
    if (!this.ctx || !this.master || !this.settings || this.muted) return 0;
    const ch = this.settings.channels[key];
    if (!ch?.enabled) return 0;
    return ch.volume / 100;
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number, endFreq?: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + Math.min(0.012, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(this.master!);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  tick(): void {
    const v = this.vol('tick');
    if (!v) return;
    const now = this.ctx!.currentTime;
    if (now - this.lastTick < 0.03) return; // throttle at very high speeds
    this.lastTick = now;
    this.tone(2400, now, 0.035, 'triangle', 0.35 * v, 1300);
  }

  click(): void {
    const v = this.vol('click');
    if (!v) return;
    const now = this.ctx!.currentTime;
    this.tone(520, now, 0.08, 'sine', 0.4 * v, 880);
  }

  slowdown(): void {
    const v = this.vol('slowdown');
    if (!v) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 1.4);
    f.type = 'lowpass';
    f.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.12 * v, now + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
    osc.connect(f).connect(g).connect(this.master!);
    osc.start(now);
    osc.stop(now + 1.5);
  }

  win(): void {
    const v = this.vol('win');
    if (!v) return;
    const now = this.ctx!.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => this.tone(n, now + i * 0.11, 0.28, 'triangle', 0.32 * v));
    [523.25, 659.25, 783.99, 1046.5].forEach((n) => this.tone(n, now + 0.46, 0.9, 'sine', 0.14 * v));
  }

  celebrate(): void {
    const v = this.vol('celebration');
    if (!v) return;
    const now = this.ctx!.currentTime;
    const scale = [1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093];
    for (let i = 0; i < 14; i++) {
      const n = scale[Math.floor(Math.random() * scale.length)];
      this.tone(n, now + 0.35 + i * 0.075 + Math.random() * 0.03, 0.22, 'sine', 0.12 * v);
    }
    // soft "pop"
    this.noiseBurst(now + 0.3, 0.18, 0.25 * v, 1800);
  }

  private noiseBurst(start: number, dur: number, gain: number, freq: number): void {
    if (!this.noise) return;
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(start);
    src.stop(start + dur + 0.02);
  }

  startSpin(): void {
    this.stopSpin();
    const v = this.vol('spin');
    if (!v || !this.noise) return;
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.9;
    f.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    src.connect(f).connect(g).connect(this.master!);
    src.start();
    this.spinSrc = src;
    this.spinGain = g;
    this.spinFilter = f;
  }

  /** 0..1 normalised wheel speed. Called per animation frame; very cheap. */
  setSpinSpeed(n: number): void {
    if (!this.spinGain || !this.spinFilter || !this.ctx) return;
    const v = this.vol('spin');
    const t = this.ctx.currentTime;
    const k = Math.min(1, Math.max(0, n));
    this.spinGain.gain.setTargetAtTime(0.0001 + 0.22 * v * k, t, 0.05);
    this.spinFilter.frequency.setTargetAtTime(300 + 1500 * k, t, 0.05);
  }

  stopSpin(): void {
    if (this.spinSrc && this.ctx) {
      const t = this.ctx.currentTime;
      this.spinGain?.gain.setTargetAtTime(0.0001, t, 0.06);
      const src = this.spinSrc;
      setTimeout(() => {
        try {
          src.stop();
          src.disconnect();
        } catch {
          /* already stopped */
        }
      }, 300);
    }
    this.spinSrc = null;
    this.spinGain = null;
    this.spinFilter = null;
  }

  /** Preview a sound from the settings page. */
  test(key: SoundKey): void {
    this.unlock();
    switch (key) {
      case 'tick': {
        const now = this.ctx?.currentTime ?? 0;
        for (let i = 0; i < 6; i++) setTimeout(() => this.tick(), i * (60 + i * 25));
        void now;
        break;
      }
      case 'click':
        this.click();
        break;
      case 'slowdown':
        this.slowdown();
        break;
      case 'win':
        this.win();
        break;
      case 'celebration':
        this.celebrate();
        break;
      case 'spin': {
        this.startSpin();
        let k = 1;
        const iv = setInterval(() => {
          k -= 0.05;
          this.setSpinSpeed(k);
          if (k <= 0) {
            clearInterval(iv);
            this.stopSpin();
          }
        }, 60);
        break;
      }
    }
  }
}

export const sound = new SoundEngine();

