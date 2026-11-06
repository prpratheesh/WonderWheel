import React, { useEffect, useRef } from 'react';
import { ParticleSystem } from '../../services/particles';
import type { EffectToggles, Intensity } from '../../types/animation';

export interface CelebrationBurst {
  id: number;
  colors: string[];
}

interface CelebrationProps {
  burst: CelebrationBurst | null;
  effects: EffectToggles;
  intensity: Intensity;
  reducedMotion: boolean;
  performanceMode: boolean;
}

export const Celebration: React.FC<CelebrationProps> = ({
  burst,
  effects,
  intensity,
  reducedMotion,
  performanceMode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sysRef = useRef<ParticleSystem | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sys = new ParticleSystem(canvas);
    sysRef.current = sys;

    const syncSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, performanceMode ? 1.25 : 2);
      sys.resize(window.innerWidth, window.innerHeight, dpr);
    };
    syncSize();
    window.addEventListener('resize', syncSize);
    return () => {
      window.removeEventListener('resize', syncSize);
      sys.stop();
      sysRef.current = null;
    };
  }, [performanceMode]);

  useEffect(() => {
    if (!burst || reducedMotion) return;
    const anyEnabled =
      effects.confetti || effects.fireworks || effects.stars || effects.sparkles;
    if (!anyEnabled) return;
    sysRef.current?.celebrate({
      confetti: effects.confetti,
      fireworks: effects.fireworks,
      stars: effects.stars,
      sparkles: effects.sparkles,
      intensity,
      colors: burst.colors,
      origin: { x: window.innerWidth / 2, y: window.innerHeight * 0.45 },
      lite: performanceMode,
    });
  }, [burst, effects, intensity, performanceMode, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="celebration-canvas"
      aria-hidden="true"
    />
  );
};

