export type SoundKey = 'spin' | 'tick' | 'slowdown' | 'win' | 'celebration' | 'click';

export interface SoundChannel {
  enabled: boolean;
  /** 0–100 */
  volume: number;
}

export interface SoundSettings {
  /** 0–100 */
  master: number;
  channels: Record<SoundKey, SoundChannel>;
}

export type TriState = 'auto' | 'on' | 'off';

/** Device-level settings shared by all wheels (stored in IndexedDB). */
export interface AppSettings {
  sound: SoundSettings;
  /** Reduced motion: 'auto' follows the operating-system preference. */
  reducedMotion: TriState;
  /** Performance-friendly rendering: 'auto' detects slow devices. */
  performanceMode: TriState;
}

/** Lightweight preferences (stored in localStorage). */
export interface Prefs {
  muted: boolean;
  lastWheelId: string | null;
  settingsTab: string;
  showHistory: boolean;
}

export const SOUND_LABELS: Record<SoundKey, string> = {
  spin: 'Wheel spinning',
  tick: 'Pointer tick',
  slowdown: 'Slow-down',
  win: 'Winning fanfare',
  celebration: 'Celebration sparkle',
  click: 'Button click',
};

