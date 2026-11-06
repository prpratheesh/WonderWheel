/**
 * Static wheel renderer.
 *
 * The wheel is painted ONCE into a canvas whenever its configuration or size
 * changes. During a spin the canvas element is only rotated with a GPU-
 * composited CSS transform — no repainting happens per frame, which keeps the
 * animation at a smooth 60 FPS even with 100 segments and images.
 */
import type { FontChoice, WheelDesign } from '../types/wheel';
import type { Segment, TextAlign, ImagePosition } from '../types/segment';
import type { SegmentArc } from './wheelEngine';
import type { CachedImage } from './imageCache';
import { luminance, shade, withAlpha } from '../utils/colors';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const toCanvas = (deg: number) => (deg - 90) * DEG;

export const FONT_STACKS: Record<FontChoice, string> = {
  fredoka: "'Fredoka Variable', 'Fredoka', 'Nunito Variable', system-ui, sans-serif",
  nunito: "'Nunito Variable', 'Nunito', system-ui, sans-serif",
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

export interface WheelMetrics {
  /** Outer radius including border. */
  R: number;
  /** Border width. */
  bw: number;
  /** Segment radius. */
  r: number;
  /** Hub radius. */
  hubR: number;
}

export function wheelMetrics(size: number, design: WheelDesign): WheelMetrics {
  const R = size / 2 - 1;
  const bw = Math.max(0, (design.borderWidth * size) / 1000);
  const r = Math.max(10, R - bw);
  const hubR = design.hubStyle === 'none' ? 0 : (size * design.hubSize) / 200;
  return { R, bw, r, hubR };
}

export interface RenderOptions {
  /** CSS pixel diameter. */
  size: number;
  dpr: number;
  arcs: readonly SegmentArc[];
  design: WheelDesign;
  dimmed: ReadonlySet<string>;
  getImage: (id: string) => CachedImage | undefined;
}

function prepareCanvas(canvas: HTMLCanvasElement, size: number, dpr: number): CanvasRenderingContext2D | null {
  const px = Math.max(1, Math.round(size * dpr));
  if (canvas.width !== px || canvas.height !== px) {
    canvas.width = px;
    canvas.height = px;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, px, px);
  ctx.setTransform(dpr, 0, 0, dpr, px / 2, px / 2);
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

function wedge(ctx: CanvasRenderingContext2D, r: number, arc: SegmentArc) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r, toCanvas(arc.start), toCanvas(arc.end));
  ctx.closePath();
}

function drawSegmentFullBackground(
  ctx: CanvasRenderingContext2D,
  arc: SegmentArc,
  m: WheelMetrics,
  img: CachedImage,
) {
  if (!img.width || !img.height) return;
  ctx.save();
  wedge(ctx, m.r, arc);
  ctx.clip();

  const mid = toCanvas((arc.start + arc.end) / 2);
  ctx.rotate(mid);

  // Position image centered along the main radius span of the segment
  const rCenter = (m.r + m.hubR) / 2;
  ctx.translate(rCenter, 0);
  ctx.rotate(Math.PI / 2); // Orient so image top points towards wheel rim

  const spanRad = (arc.end - arc.start) * DEG;
  const chord = 2 * m.r * Math.sin(spanRad / 2);
  const radialDepth = m.r - m.hubR;
  // Compute minimum bounding box to completely cover the slice portion
  const reqW = Math.max(chord, radialDepth * Math.tan(spanRad / 2) * 2) * 1.08;
  const reqH = radialDepth * 1.15;

  const scale = Math.max(reqW / img.width, reqH / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;

  ctx.drawImage(img.source, -dw / 2, -dh / 2, dw, dh);

  // Semi-transparent overlay to ensure text on top is always readable
  ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
  ctx.fillRect(-dw / 2, -dh / 2, dw, dh);

  ctx.restore();
}

export function renderWheel(canvas: HTMLCanvasElement, o: RenderOptions): void {
  const ctx = prepareCanvas(canvas, o.size, o.dpr);
  if (!ctx) return;
  const { design, arcs } = o;
  const m = wheelMetrics(o.size, design);
  const family = FONT_STACKS[design.fontFamily] ?? FONT_STACKS.fredoka;

  // 1. Border ring with a metallic sheen.
  if (m.bw > 0.5) {
    const g = ctx.createLinearGradient(-m.R, -m.R, m.R, m.R);
    g.addColorStop(0, shade(design.borderColor, 0.45));
    g.addColorStop(0.45, design.borderColor);
    g.addColorStop(1, shade(design.borderColor, -0.32));
    ctx.beginPath();
    ctx.arc(0, 0, m.R, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
  }

  if (arcs.length === 0) {
    ctx.beginPath();
    ctx.arc(0, 0, m.r, 0, TAU);
    ctx.fillStyle = '#cbd5e1';
    ctx.fill();
    return;
  }

  // 2. Segment fills with a soft radial gradient for depth.
  for (const arc of arcs) {
    const bg = arc.segment.bgColor;
    const g = ctx.createRadialGradient(0, 0, m.r * 0.08, 0, 0, m.r);
    g.addColorStop(0, shade(bg, 0.25));
    g.addColorStop(0.7, bg);
    g.addColorStop(1, shade(bg, -0.08));
    wedge(ctx, m.r, arc);
    ctx.fillStyle = g;
    ctx.fill();

    // If segment uses imageFillText, paint full image covering the slice
    if (arc.segment.layout === 'imageFillText' && arc.segment.imageId) {
      const img = o.getImage(arc.segment.imageId);
      if (img) drawSegmentFullBackground(ctx, arc, m, img);
    }
  }

  // 3. Content (text / images), each clipped to its own wedge — never overflows.
  for (const arc of arcs) drawSegmentContent(ctx, arc, m, design, family, o.getImage);

  // 4. Disabled / already-picked segments are dimmed.
  for (const arc of arcs) {
    const off = !arc.segment.enabled || arc.segment.weight <= 0;
    if (off || o.dimmed.has(arc.segment.id)) {
      wedge(ctx, m.r, arc);
      ctx.fillStyle = off ? 'rgba(30,27,58,0.62)' : 'rgba(30,27,58,0.5)';
      ctx.fill();
    }
  }

  // 5. Separators.
  const sw = (design.separatorWidth * o.size) / 1000;
  if (sw > 0.2 && arcs.length > 1) {
    ctx.strokeStyle = design.separatorColor;
    ctx.lineWidth = sw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const arc of arcs) {
      const a = toCanvas(arc.start);
      ctx.moveTo(Math.cos(a) * m.hubR * 0.5, Math.sin(a) * m.hubR * 0.5);
      ctx.lineTo(Math.cos(a) * m.r, Math.sin(a) * m.r);
    }
    ctx.stroke();
  }

  // 6. Inner edge shading (depth).
  if (design.shadow > 0) {
    const g = ctx.createRadialGradient(0, 0, m.r * 0.78, 0, 0, m.r);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${0.28 * (design.shadow / 100)})`);
    ctx.beginPath();
    ctx.arc(0, 0, m.r, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
  }
  if (m.bw > 0.5) {
    ctx.beginPath();
    ctx.arc(0, 0, m.r, 0, TAU);
    ctx.lineWidth = Math.max(1, m.bw * 0.12);
    ctx.strokeStyle = shade(design.borderColor, -0.35);
    ctx.stroke();
  }

  // 7. Rim lights (classic game-show bulbs).
  if (design.rimLights && m.bw >= 7) {
    const rm = m.R - m.bw / 2;
    const n = Math.max(10, Math.min(40, Math.round((TAU * rm) / (m.bw * 2.6))));
    const br = m.bw * 0.24;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const x = Math.cos(a) * rm;
      const y = Math.sin(a) * rm;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, br * 2.2);
      const core = i % 2 ? '#FFE27A' : '#FFFFFF';
      glow.addColorStop(0, core);
      glow.addColorStop(0.45, withAlpha(core, 0.9));
      glow.addColorStop(1, withAlpha(core, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, br * 2.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(x, y, br, 0, TAU);
      ctx.fill();
    }
  }
}

/** Highlight overlay for the winning segment (painted once at stop). */
export function renderHighlight(canvas: HTMLCanvasElement, o: Pick<RenderOptions, 'size' | 'dpr' | 'design'>, arc: SegmentArc | null): void {
  const ctx = prepareCanvas(canvas, o.size, o.dpr);
  if (!ctx || !arc) return;
  const m = wheelMetrics(o.size, o.design);
  wedge(ctx, m.r, arc);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fill();
  ctx.save();
  ctx.shadowColor = '#FFF59D';
  ctx.shadowBlur = o.size * 0.035;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, o.size * 0.009);
  ctx.strokeStyle = '#FFFBEA';
  wedge(ctx, m.r - ctx.lineWidth / 2, arc);
  ctx.stroke();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Segment content layout                                              */
/* ------------------------------------------------------------------ */

interface Ctx2 {
  ctx: CanvasRenderingContext2D;
  family: string;
  seg: Segment;
  tanH: number;
  rOut: number;
  minFs: number;
}

const font = (c: Ctx2, fs: number, weight: number) => `${weight} ${fs.toFixed(2)}px ${c.family}`;

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(text.slice(0, mid).trimEnd() + '…').width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? text.slice(0, lo).trimEnd() + '…' : '';
}

/** Greedy word wrap. `ok` is false if a single word is wider than maxW or lines exceed maxLines. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): { lines: string[]; ok: boolean } {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  let ok = true;
  for (const w of words) {
    if (ctx.measureText(w).width > maxW) ok = false;
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxW || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) ok = false;
  return { lines, ok };
}

function drawImageBox(ctx: CanvasRenderingContext2D, img: CachedImage, cx: number, cy: number, s: number, fit: 'contain' | 'cover', rotate: number) {
  if (s < 2 || !img.width || !img.height) return;
  ctx.save();
  ctx.translate(cx, cy);
  if (rotate) ctx.rotate(rotate);
  if (fit === 'cover') {
    const rr = s * 0.16;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(-s / 2, -s / 2, s, s, rr);
    else ctx.rect(-s / 2, -s / 2, s, s);
    ctx.clip();
    const k = Math.max(s / img.width, s / img.height);
    ctx.drawImage(img.source, (-img.width * k) / 2, (-img.height * k) / 2, img.width * k, img.height * k);
  } else {
    const k = Math.min(s / img.width, s / img.height);
    ctx.drawImage(img.source, (-img.width * k) / 2, (-img.height * k) / 2, img.width * k, img.height * k);
  }
  ctx.restore();
}

function setTextStyle(c: Ctx2) {
  const { ctx, seg } = c;
  ctx.fillStyle = seg.textColor;
  if (luminance(seg.textColor) > 0.6) {
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
}

function drawSegmentContent(
  ctx: CanvasRenderingContext2D,
  arc: SegmentArc,
  m: WheelMetrics,
  design: WheelDesign,
  family: string,
  getImage: (id: string) => CachedImage | undefined,
) {
  const seg = arc.segment;
  const spanDeg = arc.end - arc.start;
  const half = Math.min(spanDeg / 2, 89.9) * DEG;
  const rIn = Math.max(m.hubR * 1.12, m.r * 0.1);
  const rOut = m.r * 0.94;
  if (rOut - rIn < 6) return;

  const img = seg.imageId ? getImage(seg.imageId) : undefined;
  const hasTitle = seg.title.trim().length > 0;
  let layout = seg.layout;
  if (!img) layout = 'text';
  else if (!hasTitle && layout !== 'image') layout = 'image';

  const orient = design.textOrientation === 'auto' ? (spanDeg >= 40 ? 'upright' : 'radial') : design.textOrientation;
  const c: Ctx2 = { ctx, family, seg, tanH: Math.tan(half), rOut, minFs: Math.max(6, m.r * 0.02) };

  ctx.save();
  wedge(ctx, m.r - 0.5, arc);
  ctx.clip();
  const mid = toCanvas((arc.start + arc.end) / 2);
  ctx.textBaseline = 'middle';
  if (orient === 'upright') {
    ctx.rotate(mid + Math.PI / 2);
    drawUpright(c, layout, img, rIn, rOut, m.r * 0.13 * (seg.textSize / 100));
  } else {
    ctx.rotate(mid);
    drawRadial(c, layout, img, rIn, rOut, m.r * 0.085 * (seg.textSize / 100));
  }
  ctx.restore();
}

/* ---------------- Upright: content stands up, rim at the top ---------------- */

/** Usable width of a horizontal box spanning distances [y1, y2] from the centre. */
function uprightWidth(c: Ctx2, y1: number, y2: number): number {
  const wedgeW = c.tanH > 50 ? Infinity : 2 * Math.max(0, y1) * c.tanH;
  const circleW = 2 * Math.sqrt(Math.max(0, c.rOut * c.rOut - y2 * y2));
  return 0.9 * Math.min(wedgeW, circleW);
}

function placeIn(a: number, b: number, h: number, pos: TextAlign | ImagePosition): number {
  const pad = (b - a) * 0.03;
  if (pos === 'inner') return a + h / 2 + pad;
  if (pos === 'outer') return b - h / 2 - pad;
  return (a + b) / 2;
}

interface TextFit {
  fs: number;
  subFs: number;
  lines: string[];
  sub: string;
  yc: number;
  H: number;
}

function fitUprightText(c: Ctx2, a: number, b: number, baseFs: number, align: TextAlign, maxLines: number, widthCap = Infinity): TextFit | null {
  const { ctx, seg } = c;
  const title = seg.title.trim();
  const subtitle = seg.subtitle.trim();
  const band = b - a;
  let fs = Math.min(baseFs, band * 0.5);
  for (let iter = 0; iter < 18; iter++) {
    const last = fs <= c.minFs;
    if (last) fs = c.minFs;
    const subFs = fs * 0.58;
    const wantSub = !!subtitle && subFs >= c.minFs * 0.9;
    ctx.font = font(c, fs, seg.fontWeight);
    for (let n = 1; n <= maxLines; n++) {
      for (const withSub of wantSub ? [true, false] : [false]) {
        const H = n * fs * 1.12 + (withSub ? subFs * 1.35 : 0);
        if (H > band) continue;
        const yc = placeIn(a, b, H, align);
        const W = Math.min(widthCap, uprightWidth(c, yc - H / 2, yc + H / 2));
        if (W < fs) continue;
        const { lines, ok } = wrap(ctx, title, W, n);
        if ((ok && lines.length <= n) || (last && n === maxLines)) {
          const fitted = lines.slice(0, n).map((l, i, arr) => (i === arr.length - 1 && lines.length > n ? ellipsize(ctx, l + '…', W) : ellipsize(ctx, l, W)));
          let sub = '';
          if (withSub) {
            ctx.font = font(c, subFs, Math.max(400, seg.fontWeight - 200));
            sub = ellipsize(ctx, subtitle, W);
          }
          // On a forced last-resort fit, prefer dropping the subtitle over squeezing.
          if (!ok && withSub && wantSub && last) continue;
          return { fs, subFs, lines: fitted, sub, yc, H };
        }
      }
    }
    if (last) break;
    fs *= 0.88;
  }
  return null;
}

function drawUprightText(c: Ctx2, t: TextFit, x: number, align: CanvasTextAlign) {
  const { ctx, seg } = c;
  setTextStyle(c);
  ctx.textAlign = align;
  ctx.font = font(c, t.fs, seg.fontWeight);
  // Lines go from the rim (top) towards the hub; y is negative upwards.
  let y = t.yc + t.H / 2 - t.fs * 0.56;
  for (const line of t.lines) {
    ctx.fillText(line, x, -y);
    y -= t.fs * 1.12;
  }
  if (t.sub) {
    ctx.globalAlpha = 0.88;
    ctx.font = font(c, t.subFs, Math.max(400, seg.fontWeight - 200));
    ctx.fillText(t.sub, x, -(t.yc - t.H / 2 + t.subFs * 0.62));
    ctx.globalAlpha = 1;
  }
}

function fitUprightImage(c: Ctx2, a: number, b: number, pos: ImagePosition, sizePct: number, maxS = Infinity): { s: number; yc: number } {
  let s = Math.min(b - a, maxS);
  let yc = placeIn(a, b, s, pos);
  for (let i = 0; i < 30 && s > 2; i++) {
    yc = placeIn(a, b, s, pos);
    if (s <= uprightWidth(c, yc - s / 2, yc + s / 2)) break;
    s *= 0.93;
  }
  const s2 = s * (sizePct / 100);
  return { s: s2, yc: placeIn(a, b, s2, pos) };
}

function drawUpright(c: Ctx2, layout: Segment['layout'], img: CachedImage | undefined, a: number, b: number, baseFs: number) {
  const { seg, ctx } = c;
  const band = b - a;
  const drawImg = (r: { s: number; yc: number }) => img && drawImageBox(ctx, img, 0, -r.yc, r.s, seg.imageFit, 0);
  const text = (ra: number, rb: number, align: TextAlign, lines = 2) => {
    const t = fitUprightText(c, ra, rb, baseFs, align, lines);
    if (t) drawUprightText(c, t, 0, 'center');
  };
  switch (layout) {
    case 'image':
      drawImg(fitUprightImage(c, a, b, seg.imagePosition, seg.imageSize));
      break;
    case 'imageAbove': {
      const split = a + band * 0.46;
      drawImg(fitUprightImage(c, split, b, 'center', seg.imageSize));
      text(a, split, 'center');
      break;
    }
    case 'imageBelow': {
      const split = a + band * 0.5;
      drawImg(fitUprightImage(c, a, split, 'center', seg.imageSize));
      text(split, b, 'center');
      break;
    }
    case 'icon': {
      const split = b - band * 0.3;
      drawImg(fitUprightImage(c, split, b, 'center', seg.imageSize));
      text(a, split - band * 0.02, seg.textAlign);
      break;
    }
    case 'imageBeside': {
      const h = band * 0.42;
      const yc = a + band * 0.62;
      const W = uprightWidth(c, yc - h / 2, yc + h / 2);
      const s = Math.min(h, W * 0.42) * (seg.imageSize / 100);
      const gap = s * 0.12;
      const t = fitUprightText(c, yc - h / 2, yc + h / 2, baseFs, 'center', 2, W - s - gap);
      ctx.font = t ? font(c, t.fs, seg.fontWeight) : '';
      const tw = t ? Math.max(...t.lines.map((l) => ctx.measureText(l).width)) : 0;
      const total = s + (t ? gap + tw : 0);
      const x0 = -total / 2;
      if (img) drawImageBox(ctx, img, x0 + s / 2, -yc, s, seg.imageFit, 0);
      if (t) drawUprightText(c, t, x0 + s + gap, 'left');
      break;
    }
    case 'text':
    case 'imageFillText':
    default:
      text(a, b, seg.textAlign);
  }
}

/* ---------------- Radial: content runs along the radius ---------------- */

/** Usable height (perpendicular to the radius) of a box spanning radial distance [x1, x2]. */
function radialHeight(c: Ctx2, x1: number, x2: number): number {
  const wedgeH = c.tanH > 50 ? Infinity : 2 * Math.max(0, x1) * c.tanH;
  const circleH = 2 * Math.sqrt(Math.max(0, c.rOut * c.rOut - x2 * x2));
  return 0.88 * Math.min(wedgeH, circleH);
}

function drawRadialText(c: Ctx2, a: number, b: number, baseFs: number, align: TextAlign) {
  const { ctx, seg } = c;
  const title = seg.title.trim();
  const subtitle = seg.subtitle.trim();
  const L = b - a;
  if (L < 6 || !title) return;
  let fs = baseFs;
  for (let iter = 0; iter < 20; iter++) {
    const last = fs <= c.minFs;
    if (last) fs = c.minFs;
    ctx.font = font(c, fs, seg.fontWeight);
    const tw = ctx.measureText(title).width;
    const subFs = fs * 0.62;
    for (const withSub of subtitle ? [true, false] : [false]) {
      if (withSub && subFs < c.minFs * 0.9) continue;
      const H = fs * 1.08 + (withSub ? subFs * 1.25 : 0);
      let sw = 0;
      if (withSub) {
        ctx.font = font(c, subFs, Math.max(400, seg.fontWeight - 200));
        sw = ctx.measureText(subtitle).width;
        ctx.font = font(c, fs, seg.fontWeight);
      }
      const len = Math.min(L, Math.max(tw, sw));
      const x1 = align === 'inner' ? a : align === 'outer' ? b - len : (a + b) / 2 - len / 2;
      const x2 = x1 + len;
      const fitsLen = tw <= L;
      const fitsH = H <= radialHeight(c, x1, x2);
      if ((fitsLen && fitsH) || (last && (fitsH || !withSub))) {
        setTextStyle(c);
        const xa = align === 'inner' ? x1 : align === 'outer' ? x2 : (x1 + x2) / 2;
        ctx.textAlign = align === 'inner' ? 'left' : align === 'outer' ? 'right' : 'center';
        const yTitle = withSub ? -H / 2 + fs * 0.54 : 0;
        ctx.fillText(ellipsize(ctx, title, L), xa, yTitle);
        if (withSub) {
          ctx.globalAlpha = 0.88;
          ctx.font = font(c, subFs, Math.max(400, seg.fontWeight - 200));
          ctx.fillText(ellipsize(ctx, subtitle, L), xa, H / 2 - subFs * 0.62);
          ctx.globalAlpha = 1;
        }
        return;
      }
    }
    if (last) return;
    fs *= 0.9;
  }
}

function fitRadialImage(c: Ctx2, a: number, b: number, pos: ImagePosition, sizePct: number, maxS = Infinity): { s: number; xc: number } {
  let s = Math.min(b - a, maxS);
  let xc = placeIn(a, b, s, pos);
  for (let i = 0; i < 40 && s > 2; i++) {
    xc = placeIn(a, b, s, pos);
    if (s <= radialHeight(c, xc - s / 2, xc + s / 2)) break;
    s *= 0.93;
  }
  const s2 = s * (sizePct / 100);
  return { s: s2, xc: placeIn(a, b, s2, pos) };
}

function drawRadial(c: Ctx2, layout: Segment['layout'], img: CachedImage | undefined, a: number, b: number, baseFs: number) {
  const { seg, ctx } = c;
  const band = b - a;
  // Images are rotated so their top faces the rim.
  const drawImg = (r: { s: number; xc: number }) => img && drawImageBox(ctx, img, r.xc, 0, r.s, seg.imageFit, Math.PI / 2);
  switch (layout) {
    case 'image':
      drawImg(fitRadialImage(c, a, b, seg.imagePosition, seg.imageSize));
      break;
    case 'imageBelow': {
      const r = fitRadialImage(c, a, a + band * 0.5, 'outer', seg.imageSize);
      drawImg(r);
      drawRadialText(c, r.xc + r.s / 2 + band * 0.04, b, baseFs, seg.textAlign);
      break;
    }
    case 'icon':
    case 'imageAbove':
    case 'imageBeside': {
      const maxS = layout === 'icon' ? band * 0.22 : band * 0.45;
      const r = fitRadialImage(c, a + band * 0.3, b, 'outer', seg.imageSize, maxS);
      drawImg(r);
      drawRadialText(c, a, r.xc - r.s / 2 - band * 0.04, baseFs, layout === 'icon' ? seg.textAlign : 'outer');
      break;
    }
    case 'text':
    case 'imageFillText':
    default:
      drawRadialText(c, a, b, baseFs, seg.textAlign);
  }
}
