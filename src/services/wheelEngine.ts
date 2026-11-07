/**
 * Wheel engine — pure geometry, easing and spin-planning maths.
 * No DOM access: fully unit-testable.
 *
 * Conventions
 *  - Angles are in degrees, measured clockwise from 12 o'clock.
 *  - `rotation` is the wheel's CSS rotation (clockwise positive).
 *  - A wheel-local angle `a` appears on screen at `a + rotation`.
 *  - The pointer at screen angle P therefore points at local angle `mod(P - rotation, 360)`.
 */
import type { AnimationSettings, EasingPreset, SpinDirection, StopBehaviour } from '../types/animation';
import type { Segment } from '../types/segment';
import type { PointerPosition } from '../types/wheel';

export interface SegmentArc {
  /** Index within the visible arcs list. */
  index: number;
  segment: Segment;
  /** Local start angle (deg, inclusive). */
  start: number;
  /** Local end angle (deg, exclusive). */
  end: number;
}

export const mod = (a: number, n: number): number => ((a % n) + n) % n;

export function pointerAngle(pos: PointerPosition): number {
  switch (pos) {
    case 'right':
      return 90;
    case 'bottom':
      return 180;
    case 'left':
      return 270;
    default:
      return 0;
  }
}

/** Visible segments laid out around the wheel. */
export function computeArcs(
  segments: readonly Segment[],
  sizeByWeight: boolean,
  hiddenIds?: ReadonlySet<string>,
): SegmentArc[] {
  const visible = segments.filter(
    (s) => s.visible && (!hiddenIds || !hiddenIds.has(s.id)),
  );
  if (visible.length === 0) return [];
  const sizeOf = (s: Segment) => (sizeByWeight ? (s.weight > 0 ? s.weight : 0.2) : 1);
  const total = visible.reduce((acc, s) => acc + sizeOf(s), 0);
  const arcs: SegmentArc[] = [];
  let a = 0;
  visible.forEach((segment, index) => {
    const span = (sizeOf(segment) / total) * 360;
    arcs.push({ index, segment, start: a, end: index === visible.length - 1 ? 360 : a + span });
    a += span;
  });
  return arcs;
}

/** Index of the arc containing local angle `a` (binary search, O(log n)). */
export function arcIndexAt(arcs: readonly SegmentArc[], a: number): number {
  const x = mod(a, 360);
  let lo = 0;
  let hi = arcs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (arcs[mid].start <= x) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function localAngleUnderPointer(rotation: number, pointerDeg: number): number {
  return mod(pointerDeg - rotation, 360);
}

export function arcIndexUnderPointer(arcs: readonly SegmentArc[], rotation: number, pointerDeg: number): number {
  return arcIndexAt(arcs, localAngleUnderPointer(rotation, pointerDeg));
}

/**
 * Random landing angle inside an arc, kept away from the separators
 * (middle 70%) so the result is never visually ambiguous.
 */
export function landingAngle(arc: SegmentArc, rand: number): number {
  const span = arc.end - arc.start;
  return arc.start + span * (0.15 + 0.7 * rand);
}

/**
 * Distance (always positive, in degrees) to rotate in `dir` so that the pointer
 * ends exactly on `targetLocal`, after at least `revolutions` full turns.
 */
export function spinDistance(from: number, targetLocal: number, pointerDeg: number, revolutions: number, dir: SpinDirection): number {
  const s = dir === 'cw' ? 1 : -1;
  const extra = mod(s * (pointerDeg - targetLocal - from), 360);
  return Math.max(0, Math.round(revolutions)) * 360 + extra;
}

/* ------------------------------------------------------------------ */
/* Easing                                                              */
/* ------------------------------------------------------------------ */

export interface CurveParams {
  /** Fraction of the time spent accelerating (0–0.4). */
  accel: number;
  /** Deceleration power (1 = constant speed, 2 = constant deceleration, higher = longer tail). */
  power: number;
}

export function easingParams(preset: EasingPreset, custom: { acceleration: number; deceleration: number }): CurveParams {
  switch (preset) {
    case 'smooth':
      return { accel: 0.06, power: 3 };
    case 'dramatic':
      return { accel: 0.05, power: 5.5 };
    case 'physics':
      return { accel: 0.1, power: 2 };
    case 'fastStart':
      return { accel: 0, power: 4 };
    case 'linear':
      return { accel: 0, power: 1 };
    case 'custom':
    default:
      return {
        accel: Math.min(0.4, Math.max(0, custom.acceleration)),
        power: Math.min(8, Math.max(1, custom.deceleration)),
      };
  }
}

/**
 * Velocity profile: linear ramp-up over [0, accel], then decays as
 * ((1-t)/(1-accel))^(power-1). Position is the exact integral, normalised to [0,1].
 * Velocity is continuous at the joint, so there is no visible jerk.
 */
export function makeCurve({ accel, power }: CurveParams): (t: number) => number {
  const a = Math.min(0.95, Math.max(0, accel));
  const p = Math.max(1, power);
  const total = a / 2 + (1 - a) / p;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let pos: number;
    if (t < a) pos = (t * t) / (2 * a);
    else pos = a / 2 + ((1 - a) / p) * (1 - Math.pow((1 - t) / (1 - a), p));
    return pos / total;
  };
}

/** Initial (t=0+) or peak normalised velocity of a curve: d(pos)/dt at the end of acceleration. */
export function curvePeakVelocity({ accel, power }: CurveParams): number {
  const a = Math.min(0.95, Math.max(0, accel));
  const p = Math.max(1, power);
  return 1 / (a / 2 + (1 - a) / p);
}

const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

export interface SpinPlan {
  from: number;
  /** Signed total travel in degrees. */
  delta: number;
  /** Final rotation (from + delta). */
  to: number;
  durationMs: number;
  /** Maps elapsed fraction [0,1] → rotation. */
  angleAt: (t: number) => number;
}

/**
 * Builds a plan that always ends exactly at `to`.
 * The optional bounce overshoots slightly (never leaving the target segment)
 * and settles back.
 */
export function buildPlan(opts: {
  from: number;
  distance: number;
  dir: SpinDirection;
  durationMs: number;
  curve: CurveParams;
  stop: StopBehaviour;
  /** Max overshoot allowed (deg) without leaving the target segment. */
  overshootRoom?: number;
}): SpinPlan {
  const s = opts.dir === 'cw' ? 1 : -1;
  const delta = s * opts.distance;
  const to = opts.from + delta;
  const curveParams: CurveParams = opts.stop === 'abrupt' ? { accel: opts.curve.accel, power: 1 } : opts.curve;
  const f = makeCurve(curveParams);

  let angleAt: (t: number) => number;
  const room = Math.max(0, opts.overshootRoom ?? 0);
  if (opts.stop === 'bounce' && room > 0.5) {
    const ov = Math.min(8, room);
    const split = 0.86;
    const main = opts.distance + ov;
    angleAt = (t) => {
      if (t >= 1) return to;
      if (t < split) return opts.from + s * main * f(t / split);
      const u = (t - split) / (1 - split);
      return opts.from + s * (main - ov * easeInOutSine(u));
    };
  } else {
    angleAt = (t) => (t >= 1 ? to : opts.from + delta * f(t));
  }
  return { from: opts.from, delta, to, durationMs: opts.durationMs, angleAt };
}

/** Room available to overshoot past the landing point while staying inside the arc. */
export function overshootRoom(arc: SegmentArc, targetLocal: number, dir: SpinDirection): number {
  // Rotating clockwise makes the local angle under the pointer decrease.
  return dir === 'cw' ? (targetLocal - arc.start) * 0.75 : (arc.end - targetLocal) * 0.75;
}

/** Full plan for an automatic spin to a pre-selected arc. */
export function planAutoSpin(opts: {
  arcs: readonly SegmentArc[];
  targetIndex: number;
  from: number;
  pointerDeg: number;
  anim: Pick<AnimationSettings, 'duration' | 'revolutions' | 'direction' | 'easing' | 'acceleration' | 'deceleration' | 'stopBehaviour'>;
  rand: number;
}): SpinPlan & { targetLocal: number } {
  const arc = opts.arcs[opts.targetIndex];
  const targetLocal = landingAngle(arc, opts.rand);
  const distance = spinDistance(opts.from, targetLocal, opts.pointerDeg, Math.max(1, opts.anim.revolutions), opts.anim.direction);
  const plan = buildPlan({
    from: opts.from,
    distance,
    dir: opts.anim.direction,
    durationMs: Math.max(1, opts.anim.duration) * 1000,
    curve: easingParams(opts.anim.easing, opts.anim),
    stop: opts.anim.stopBehaviour,
    overshootRoom: overshootRoom(arc, targetLocal, opts.anim.direction),
  });
  return { ...plan, targetLocal };
}

/**
 * Plan for stopping a free-spinning wheel (manual mode) at `speed` deg/s,
 * matching the current velocity so the transition is seamless.
 */
export function planManualStop(opts: {
  arcs: readonly SegmentArc[];
  targetIndex: number;
  from: number;
  speed: number;
  pointerDeg: number;
  dir: SpinDirection;
  power: number;
  stopSeconds: number;
  rand: number;
}): SpinPlan & { targetLocal: number } {
  const arc = opts.arcs[opts.targetIndex];
  const targetLocal = landingAngle(arc, opts.rand);
  const p = Math.max(1.5, opts.power);
  const speed = Math.max(60, Math.abs(opts.speed));
  const minDistance = (speed * opts.stopSeconds) / p;
  const fullTurns = Math.floor(minDistance / 360);
  let distance = spinDistance(opts.from, targetLocal, opts.pointerDeg, fullTurns, opts.dir);
  if (distance < minDistance) distance += 360;
  // Choose duration so the initial velocity equals the current speed: v0 = distance * p / T.
  const durationMs = ((distance * p) / speed) * 1000;
  const plan = buildPlan({
    from: opts.from,
    distance,
    dir: opts.dir,
    durationMs,
    curve: { accel: 0, power: p },
    stop: 'smooth',
  });
  return { ...plan, targetLocal };
}

/** Segments that may be selected. */
export function eligibleArcs(arcs: readonly SegmentArc[], excluded: ReadonlySet<string>): SegmentArc[] {
  return arcs.filter((a) => a.segment.enabled && a.segment.weight > 0 && !excluded.has(a.segment.id));
}

