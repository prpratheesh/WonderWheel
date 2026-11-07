/**
 * High-performance imperative wheel animation hook.
 *
 * Updates the wheel rotation and live label directly via DOM refs inside
 * requestAnimationFrame — zero React state updates during the spin.
 * Also monitors frame times to auto-detect low-powered devices when
 * performanceMode is set to 'auto'.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { pickWeighted, secureRandom } from '../services/randomSelection';
import { sound } from '../services/soundEngine';
import {
  arcIndexUnderPointer,
  easingParams,
  eligibleArcs,
  mod,
  planAutoSpin,
  planManualStop,
  pointerAngle,
  type SegmentArc,
  type SpinPlan,
} from '../services/wheelEngine';
import type { AnimationSettings } from '../types/animation';
import type { Segment } from '../types/segment';
import type { PointerPosition } from '../types/wheel';

export type SpinPhase = 'idle' | 'spinning' | 'freeSpin' | 'stopping';

interface UseWheelAnimationArgs {
  arcs: readonly SegmentArc[];
  excludedIds: ReadonlySet<string>;
  animation: AnimationSettings;
  pointerPosition: PointerPosition;
  showLiveLabel: boolean;
  hideUntilStop: boolean;
  reducedMotion: boolean;
  onWin: (segment: Segment, arc: SegmentArc) => void;
  onSlowDeviceDetected?: () => void;
}

export function useWheelAnimation({
  arcs,
  excludedIds,
  animation,
  pointerPosition,
  showLiveLabel,
  hideUntilStop,
  reducedMotion,
  onWin,
  onSlowDeviceDetected,
}: UseWheelAnimationArgs) {
  const [phase, setPhase] = useState<SpinPhase>('idle');
  const [winningArc, setWinningArc] = useState<SegmentArc | null>(null);

  const rotorRef = useRef<HTMLDivElement | null>(null);
  const pointerKickRef = useRef<HTMLDivElement | null>(null);
  const liveLabelRef = useRef<HTMLSpanElement | null>(null);

  const rotationRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const lastArcIdxRef = useRef<number>(-1);
  const manualSpeedRef = useRef<number>(0);
  const chosenArcRef = useRef<SegmentArc | null>(null);
  const activeArcsRef = useRef<readonly SegmentArc[]>(arcs);

  useEffect(() => {
    if (phase === 'idle') activeArcsRef.current = arcs;
  }, [arcs, phase]);

  const pDeg = pointerAngle(pointerPosition);

  const applyRotation = useCallback((deg: number) => {
    rotationRef.current = deg;
    const el = rotorRef.current;
    if (el) el.style.transform = `rotate3d(0, 0, 1, ${deg.toFixed(3)}deg)`;
  }, []);

  const triggerPointerKick = useCallback(
    (dir: 'cw' | 'ccw') => {
      if (!animation.effects.pointerBounce || reducedMotion) return;
      const el = pointerKickRef.current;
      if (!el) return;
      const tilt = dir === 'cw' ? -18 : 18;
      el.animate(
        [
          { transform: 'rotate(0deg)' },
          { transform: `rotate(${tilt}deg)`, offset: 0.28 },
          { transform: 'rotate(0deg)' },
        ],
        { duration: 130, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      );
    },
    [animation.effects.pointerBounce, reducedMotion],
  );

  const updateTickAndLabel = useCallback(
    (rot: number, dir: 'cw' | 'ccw') => {
      const currentArcs = activeArcsRef.current;
      if (currentArcs.length === 0) return;
      const idx = arcIndexUnderPointer(currentArcs, rot, pDeg);
      if (idx !== lastArcIdxRef.current) {
        if (lastArcIdxRef.current !== -1) {
          sound.tick();
          triggerPointerKick(dir);
        }
        lastArcIdxRef.current = idx;
        if (liveLabelRef.current) {
          if (showLiveLabel && !hideUntilStop) {
            liveLabelRef.current.textContent = currentArcs[idx]?.segment.title || '…';
          } else if (hideUntilStop) {
            liveLabelRef.current.textContent = 'Spinning…';
          }
        }
      }
    },
    [pDeg, showLiveLabel, hideUntilStop, triggerPointerKick],
  );

  const cancelFrame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  useEffect(() => () => {
    cancelFrame();
    sound.stopSpin();
  }, [cancelFrame]);

  // Keep live label fresh when idle and segments change
  useEffect(() => {
    if (phase !== 'idle') return;
    if (arcs.length === 0) {
      if (liveLabelRef.current) liveLabelRef.current.textContent = '';
      return;
    }
    const idx = arcIndexUnderPointer(arcs, rotationRef.current, pDeg);
    lastArcIdxRef.current = idx;
    if (liveLabelRef.current) {
      liveLabelRef.current.textContent = showLiveLabel ? arcs[idx]?.segment.title ?? '' : '';
    }
  }, [arcs, pDeg, phase, showLiveLabel]);

  const runPlan = useCallback(
    (plan: SpinPlan, targetArc: SegmentArc, dir: 'cw' | 'ccw') => {
      cancelFrame();
      const startTime = performance.now();
      let prevTime = startTime;
      let prevRot = plan.from;
      let slowPlayed = false;
      let slowFrames = 0;
      let totalFrames = 0;

      sound.startSpin();

      const step = (now: number) => {
        const dt = now - prevTime;
        prevTime = now;
        if (dt > 34) slowFrames++;
        totalFrames++;

        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / plan.durationMs);
        const rot = plan.angleAt(t);
        applyRotation(rot);
        updateTickAndLabel(rot, dir);

        const speed = dt > 0 ? Math.abs(rot - prevRot) / (dt / 1000) : 0;
        prevRot = rot;
        sound.setSpinSpeed(Math.min(1, speed / 900));

        if (!slowPlayed && t > 0.68 && plan.durationMs >= 2500) {
          slowPlayed = true;
          sound.slowdown();
        }

        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = 0;
          const finalRot = mod(plan.to, 360);
          applyRotation(finalRot);
          sound.stopSpin();
          if (liveLabelRef.current) {
            liveLabelRef.current.textContent = targetArc.segment.title;
          }
          if (totalFrames > 30 && slowFrames / totalFrames > 0.45) {
            onSlowDeviceDetected?.();
          }
          setWinningArc(targetArc);
          setPhase('idle');
          onWin(targetArc.segment, targetArc);
        }
      };

      rafRef.current = requestAnimationFrame(step);
    },
    [applyRotation, cancelFrame, onSlowDeviceDetected, onWin, updateTickAndLabel],
  );

  const startSpin = useCallback(
    (
      overrideArcs?: readonly SegmentArc[],
      overrideExcludedIds?: ReadonlySet<string>,
    ) => {
      if (phase !== 'idle') return false;
      const spinArcs = overrideArcs ?? arcs;
      const spinExcluded = overrideExcludedIds ?? excludedIds;
      const pool = eligibleArcs(spinArcs, spinExcluded);
      if (pool.length === 0) return false;

      activeArcsRef.current = spinArcs;
      sound.unlock();
      sound.click();
      setWinningArc(null);

      // Pre-select the winning segment BEFORE the animation starts using fair weighted selection.
      const picked = pickWeighted(pool, (a) => a.segment.weight);
      if (!picked) return false;
      chosenArcRef.current = picked;

      lastArcIdxRef.current = arcIndexUnderPointer(spinArcs, rotationRef.current, pDeg);

      if (animation.spinMode === 'manual' && !reducedMotion) {
        setPhase('freeSpin');
        const dir = animation.direction;
        const sign = dir === 'cw' ? 1 : -1;
        const targetSpeed = 820; // deg/s
        manualSpeedRef.current = 120;
        let prev = performance.now();
        sound.startSpin();

        const loop = (now: number) => {
          const dt = Math.min(0.05, (now - prev) / 1000);
          prev = now;
          manualSpeedRef.current += (targetSpeed - manualSpeedRef.current) * Math.min(1, dt * 6);
          const rot = rotationRef.current + sign * manualSpeedRef.current * dt;
          applyRotation(rot);
          updateTickAndLabel(rot, dir);
          sound.setSpinSpeed(Math.min(1, manualSpeedRef.current / 900));
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        return true;
      }

      setPhase('spinning');
      const effDuration = reducedMotion ? Math.min(1.4, animation.duration) : animation.duration;
      const effRevs = reducedMotion ? Math.min(2, animation.revolutions) : animation.revolutions;

      const plan = planAutoSpin({
        arcs: spinArcs,
        targetIndex: picked.index,
        from: rotationRef.current,
        pointerDeg: pDeg,
        anim: {
          ...animation,
          duration: effDuration,
          revolutions: effRevs,
        },
        rand: secureRandom(),
      });

      runPlan(plan, picked, animation.direction);
      return true;
    },
    [animation, arcs, excludedIds, pDeg, phase, reducedMotion, runPlan, applyRotation, updateTickAndLabel],
  );

  const stopManualSpin = useCallback(() => {
    if (phase !== 'freeSpin') return;
    const target = chosenArcRef.current;
    if (!target) return;
    sound.click();
    setPhase('stopping');
    const curve = easingParams(animation.easing, animation);
    const plan = planManualStop({
      arcs: activeArcsRef.current,
      targetIndex: target.index,
      from: rotationRef.current,
      speed: manualSpeedRef.current || 720,
      pointerDeg: pDeg,
      dir: animation.direction,
      power: Math.max(2.4, curve.power),
      stopSeconds: Math.min(4, Math.max(1.6, animation.duration * 0.45)),
      rand: secureRandom(),
    });
    runPlan(plan, target, animation.direction);
  }, [animation, pDeg, phase, runPlan]);

  const clearWinner = useCallback(() => setWinningArc(null), []);

  return {
    phase,
    winningArc,
    clearWinner,
    startSpin,
    stopManualSpin,
    rotorRef,
    pointerKickRef,
    liveLabelRef,
    rotationRef,
  };
}

