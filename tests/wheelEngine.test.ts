import { describe, it, expect } from 'vitest';
import {
  computeArcs,
  arcIndexAt,
  localAngleUnderPointer,
  pointerAngle,
  planAutoSpin,
  mod,
  buildPlan,
  makeCurve,
  easingParams,
} from '../src/services/wheelEngine';
import { defaultSegment, defaultAnimation } from '../src/services/defaults';
import type { Segment } from '../src/types/segment';

describe('wheelEngine', () => {
  const makeSeg = (id: string, weight = 1): Segment =>
    defaultSegment({ id, title: `Seg ${id}`, weight, visible: true, enabled: true });

  it('computes even segment arcs for 4 partitions', () => {
    const segs = [makeSeg('1'), makeSeg('2'), makeSeg('3'), makeSeg('4')];
    const arcs = computeArcs(segs, false);
    expect(arcs.length).toBe(4);
    expect(arcs[0].start).toBeCloseTo(0);
    expect(arcs[0].end).toBeCloseTo(90);
    expect(arcs[1].start).toBeCloseTo(90);
    expect(arcs[1].end).toBeCloseTo(180);
    expect(arcs[2].start).toBeCloseTo(180);
    expect(arcs[2].end).toBeCloseTo(270);
    expect(arcs[3].start).toBeCloseTo(270);
    expect(arcs[3].end).toBeCloseTo(360);
  });

  it('computes weighted arcs proportionally', () => {
    const segs = [makeSeg('1', 1), makeSeg('2', 3)];
    const arcs = computeArcs(segs, true);
    expect(arcs[0].end - arcs[0].start).toBeCloseTo(90); // 1 / 4 of 360
    expect(arcs[1].end - arcs[1].start).toBeCloseTo(270); // 3 / 4 of 360
  });

  it('finds the correct arc index using binary search', () => {
    const segs = [makeSeg('0'), makeSeg('1'), makeSeg('2'), makeSeg('3')];
    const arcs = computeArcs(segs, false);

    expect(arcIndexAt(arcs, 0)).toBe(0);
    expect(arcIndexAt(arcs, 45)).toBe(0);
    expect(arcIndexAt(arcs, 90)).toBe(1);
    expect(arcIndexAt(arcs, 179.9)).toBe(1);
    expect(arcIndexAt(arcs, 180)).toBe(2);
    expect(arcIndexAt(arcs, 359)).toBe(3);
    // Wrap around modulo
    expect(arcIndexAt(arcs, 405)).toBe(0);
  });

  it('accurately maps pointer position and rotation to local angle', () => {
    const topDeg = pointerAngle('top'); // 0 deg
    expect(topDeg).toBe(0);

    // If wheel is rotated 45 deg CW, 12 o'clock points at local 315 deg (-45 mod 360)
    expect(localAngleUnderPointer(45, topDeg)).toBeCloseTo(315);
    expect(localAngleUnderPointer(360, topDeg)).toBeCloseTo(0);
    expect(localAngleUnderPointer(90, topDeg)).toBeCloseTo(270);

    const rightDeg = pointerAngle('right'); // 90 deg
    expect(localAngleUnderPointer(0, rightDeg)).toBeCloseTo(90);
  });

  it('guarantees that planAutoSpin stops precisely at the selected arc', () => {
    const segs = Array.from({ length: 12 }, (_, i) => makeSeg(String(i)));
    const arcs = computeArcs(segs, false);
    const targetIndex = 5;
    const targetArc = arcs[targetIndex];
    const pointerDeg = pointerAngle('top');
    const anim = defaultAnimation();

    const plan = planAutoSpin({
      arcs,
      targetIndex,
      from: 120, // arbitrary starting angle
      pointerDeg,
      anim,
      rand: 0.5,
    });

    const finalAngle = plan.to;
    const landingLocal = localAngleUnderPointer(finalAngle, pointerDeg);

    expect(landingLocal).toBeGreaterThanOrEqual(targetArc.start);
    expect(landingLocal).toBeLessThan(targetArc.end);
    expect(arcIndexAt(arcs, landingLocal)).toBe(targetIndex);
  });

  it('supports 100 partitions without numerical error', () => {
    const segs = Array.from({ length: 100 }, (_, i) => makeSeg(String(i)));
    const arcs = computeArcs(segs, false);
    expect(arcs.length).toBe(100);

    for (let i = 0; i < 100; i += 10) {
      const plan = planAutoSpin({
        arcs,
        targetIndex: i,
        from: 0,
        pointerDeg: pointerAngle('top'),
        anim: defaultAnimation(),
        rand: 0.5,
      });
      const landingLocal = localAngleUnderPointer(plan.to, pointerAngle('top'));
      expect(arcIndexAt(arcs, landingLocal)).toBe(i);
    }
  });

  it('produces continuous monotonic easing curve values from 0 to 1', () => {
    const curve = makeCurve(easingParams('smooth', { acceleration: 0.08, deceleration: 3 }));
    expect(curve(0)).toBeCloseTo(0);
    expect(curve(1)).toBeCloseTo(1);

    let prev = 0;
    for (let t = 0.05; t <= 1; t += 0.05) {
      const val = curve(t);
      expect(val).toBeGreaterThanOrEqual(prev);
      prev = val;
    }
  });
});
