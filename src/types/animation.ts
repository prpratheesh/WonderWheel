export type EasingPreset = 'smooth' | 'dramatic' | 'physics' | 'fastStart' | 'linear' | 'custom';
export type StopBehaviour = 'smooth' | 'bounce' | 'abrupt';
export type SpinDirection = 'cw' | 'ccw';
export type SpinMode = 'auto' | 'manual';
export type Intensity = 'low' | 'medium' | 'high';

export interface EffectToggles {
  confetti: boolean;
  fireworks: boolean;
  stars: boolean;
  sparkles: boolean;
  glow: boolean;
  pointerBounce: boolean;
  vibration: boolean;
  popupAnimation: boolean;
  imageAnimation: boolean;
  backgroundCelebration: boolean;
}

export interface AnimationSettings {
  /** Seconds, 1–60. */
  duration: number;
  /** Complete revolutions before stopping, 1–50. */
  revolutions: number;
  direction: SpinDirection;
  easing: EasingPreset;
  /** Fraction of the spin spent accelerating, 0–0.4 (custom easing). */
  acceleration: number;
  /** Deceleration curve power, 1 (linear) – 8 (very dramatic) (custom easing). */
  deceleration: number;
  stopBehaviour: StopBehaviour;
  spinMode: SpinMode;
  effects: EffectToggles;
  intensity: Intensity;
}

export const EASING_LABELS: Record<EasingPreset, string> = {
  smooth: 'Smooth Ease Out',
  dramatic: 'Dramatic Slow Down',
  physics: 'Natural Physics',
  fastStart: 'Fast Start / Slow End',
  linear: 'Linear',
  custom: 'Custom',
};

