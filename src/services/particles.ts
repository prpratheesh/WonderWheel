/**
 * Lightweight particle engine for celebrations (confetti, fireworks, stars,
 * sparkles). Runs on its own canvas, only while particles are alive, and
 * never touches React state.
 */
import type { Intensity } from '../types/animation';

export interface CelebrateOptions {
  confetti: boolean;
  fireworks: boolean;
  stars: boolean;
  sparkles: boolean;
  intensity: Intensity;
  colors: string[];
  /** Viewport point (CSS px) where sparkles/bursts originate. */
  origin: { x: number; y: number };
  /** Reduce counts for low-powered devices. */
  lite: boolean;
}

const enum Kind {
  Confetti,
  Rocket,
  Spark,
  Star,
  Twinkle,
}

interface P {
  k: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  /** delay before appearing (s) */
  delay: number;
  wob: number;
  /** rocket target height */
  ty: number;
}

const MAX_PARTICLES = 1200;
const INTENSITY: Record<Intensity, number> = { low: 0.45, medium: 1, high: 1.8 };

export class ParticleSystem {
  private ctx: CanvasRenderingContext2D | null;
  private parts: P[] = [];
  private raf = 0;
  private last = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private starPath: Path2D;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
    this.starPath = new Path2D();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.45 : 1;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) this.starPath.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else this.starPath.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    this.starPath.closePath();
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
  }

  private add(p: Partial<P> & Pick<P, 'k' | 'x' | 'y'>): void {
    if (this.parts.length >= MAX_PARTICLES) return;
    this.parts.push({ vx: 0, vy: 0, rot: 0, vr: 0, size: 6, color: '#fff', life: 0, maxLife: 3, delay: 0, wob: Math.random() * 6, ty: 0, ...p });
  }

  celebrate(o: CelebrateOptions): void {
    if (!this.ctx || !this.w) return;
    const k = INTENSITY[o.intensity] * (o.lite ? 0.45 : 1);
    const scale = Math.max(0.6, Math.min(this.w, this.h) / 800);
    const colors = o.colors.length ? o.colors : ['#FF4D6D', '#FFD23F', '#06D6A0', '#3A86FF', '#8338EC'];
    const pick = () => colors[(Math.random() * colors.length) | 0];
    const R = Math.random;

    if (o.confetti) {
      const n = Math.round(160 * k);
      for (let i = 0; i < n; i++) {
        this.add({
          k: Kind.Confetti,
          x: R() * this.w,
          y: -20 - R() * this.h * 0.5,
          vx: (R() - 0.5) * 120 * scale,
          vy: (140 + R() * 220) * scale,
          rot: R() * 6.28,
          vr: (R() - 0.5) * 12,
          size: (7 + R() * 7) * scale,
          color: pick(),
          maxLife: 6,
        });
      }
      // Burst from the origin
      const b = Math.round(70 * k);
      for (let i = 0; i < b; i++) {
        const a = -Math.PI / 2 + (R() - 0.5) * 2.4;
        const sp = (400 + R() * 600) * scale;
        this.add({
          k: Kind.Confetti,
          x: o.origin.x,
          y: o.origin.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          rot: R() * 6.28,
          vr: (R() - 0.5) * 14,
          size: (7 + R() * 6) * scale,
          color: pick(),
          maxLife: 5,
        });
      }
    }
    if (o.fireworks) {
      const n = Math.max(2, Math.round(6 * k));
      for (let i = 0; i < n; i++) {
        this.add({
          k: Kind.Rocket,
          x: this.w * (0.12 + R() * 0.76),
          y: this.h + 10,
          vy: -(this.h * 0.9 + R() * this.h * 0.3),
          ty: this.h * (0.12 + R() * 0.35),
          color: pick(),
          size: 3 * scale,
          delay: i * 0.28 + R() * 0.2,
          maxLife: 4,
        });
      }
    }
    if (o.stars) {
      const n = Math.round(28 * k);
      for (let i = 0; i < n; i++) {
        this.add({
          k: Kind.Star,
          x: R() * this.w,
          y: this.h + 30,
          vx: (R() - 0.5) * 30,
          vy: -(60 + R() * 120) * scale,
          rot: R() * 6.28,
          vr: (R() - 0.5) * 2,
          size: (10 + R() * 16) * scale,
          color: R() > 0.4 ? '#FFE066' : pick(),
          delay: R() * 1.2,
          maxLife: 4 + R() * 2,
        });
      }
    }
    if (o.sparkles) {
      const n = Math.round(46 * k);
      const rad = Math.min(this.w, this.h) * 0.42;
      for (let i = 0; i < n; i++) {
        const a = R() * 6.28;
        const d = rad * (0.2 + R() * 0.8);
        this.add({
          k: Kind.Twinkle,
          x: o.origin.x + Math.cos(a) * d,
          y: o.origin.y + Math.sin(a) * d,
          size: (6 + R() * 12) * scale,
          color: R() > 0.5 ? '#FFFFFF' : '#FFF3B0',
          delay: R() * 1.4,
          maxLife: 0.9 + R() * 0.9,
          rot: R() * 6.28,
        });
      }
    }
    this.start();
  }

  private explode(x: number, y: number, color: string, scale: number): void {
    const n = 60;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.1;
      const sp = (160 + Math.random() * 200) * scale;
      this.add({
        k: Kind.Spark,
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        size: (2 + Math.random() * 2) * scale,
        color: Math.random() > 0.25 ? color : '#FFFFFF',
        maxLife: 1.2 + Math.random() * 0.7,
      });
    }
  }

  private start(): void {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      this.step(dt);
      this.draw();
      if (this.parts.length) this.raf = requestAnimationFrame(loop);
      else {
        this.raf = 0;
        this.clear();
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  private step(dt: number): void {
    const g = 520 * Math.max(0.6, Math.min(this.w, this.h) / 800);
    const out: P[] = [];
    for (const p of this.parts) {
      if (p.delay > 0) {
        p.delay -= dt;
        out.push(p);
        continue;
      }
      p.life += dt;
      switch (p.k) {
        case Kind.Confetti:
          p.vy += g * 0.55 * dt;
          p.vx *= 1 - 1.6 * dt;
          p.vy *= 1 - 0.9 * dt;
          p.wob += dt * 5;
          p.x += (p.vx + Math.sin(p.wob) * 40) * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          break;
        case Kind.Rocket:
          p.y += p.vy * dt;
          p.vy *= 1 - 1.2 * dt;
          if (p.y <= p.ty || p.vy > -60) {
            this.explode(p.x, p.y, p.color, Math.max(0.6, Math.min(this.w, this.h) / 800));
            p.life = p.maxLife;
          }
          break;
        case Kind.Spark:
          p.vy += g * 0.35 * dt;
          p.vx *= 1 - 1.8 * dt;
          p.vy *= 1 - 1.8 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          break;
        case Kind.Star:
          p.wob += dt * 2;
          p.x += (p.vx + Math.sin(p.wob) * 25) * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          break;
        case Kind.Twinkle:
          break;
      }
      if (p.life < p.maxLife && p.y < this.h + 60) out.push(p);
    }
    this.parts = out;
  }

  private clear(): void {
    if (!this.ctx) return;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.clear();
    const d = this.dpr;
    for (const p of this.parts) {
      if (p.delay > 0) continue;
      const fade = Math.min(1, (p.maxLife - p.life) / 0.6);
      ctx.globalAlpha = Math.max(0, fade);
      ctx.fillStyle = p.color;
      switch (p.k) {
        case Kind.Confetti: {
          const c = Math.cos(p.rot);
          const s = Math.sin(p.rot);
          const flip = Math.abs(Math.sin(p.wob * 1.3)) * 0.8 + 0.2;
          ctx.setTransform(c * d, s * d, -s * d * flip, c * d * flip, p.x * d, p.y * d);
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          break;
        }
        case Kind.Rocket:
        case Kind.Spark:
          ctx.setTransform(d, 0, 0, d, p.x * d, p.y * d);
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, 6.2832);
          ctx.fill();
          break;
        case Kind.Star: {
          const c = Math.cos(p.rot) * p.size;
          const s = Math.sin(p.rot) * p.size;
          ctx.setTransform(c * d, s * d, -s * d, c * d, p.x * d, p.y * d);
          ctx.fill(this.starPath);
          break;
        }
        case Kind.Twinkle: {
          const tw = Math.sin((p.life / p.maxLife) * Math.PI);
          ctx.globalAlpha = tw;
          const sz = p.size * (0.5 + tw * 0.5);
          ctx.setTransform(sz * d, 0, 0, sz * d, p.x * d, p.y * d);
          ctx.beginPath();
          ctx.moveTo(0, -1);
          ctx.quadraticCurveTo(0.12, -0.12, 1, 0);
          ctx.quadraticCurveTo(0.12, 0.12, 0, 1);
          ctx.quadraticCurveTo(-0.12, 0.12, -1, 0);
          ctx.quadraticCurveTo(-0.12, -0.12, 0, -1);
          ctx.fill();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.parts = [];
    this.clear();
  }
}

