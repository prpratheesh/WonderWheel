import type { AnimationSettings } from './animation';
import type { Segment } from './segment';

export type PointerPosition = 'top' | 'right' | 'bottom' | 'left';
export type PointerStyle = 'classic' | 'arrow' | 'pin';
export type HubStyle = 'classic' | 'gradient' | 'star' | 'minimal' | 'none';
export type TextOrientation = 'auto' | 'radial' | 'upright';
export type BackgroundType = 'theme' | 'color' | 'gradient' | 'image';
export type FontChoice = 'fredoka' | 'nunito' | 'system';
export type ThemeId = 'rainbow' | 'pastel' | 'ocean' | 'candy' | 'space' | 'classroom' | 'custom';

export interface BackgroundSettings {
  type: BackgroundType;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  imageId: string | null;
  /** 0–80: darkening overlay over background images for readability. */
  overlay: number;
}

export interface WheelDesign {
  themeId: ThemeId;
  /** 50–100: % of the available stage the wheel occupies. */
  size: number;
  pointerPosition: PointerPosition;
  pointerStyle: PointerStyle;
  pointerColor: string;
  /** 0–40 (px at a 1000px wheel). */
  borderWidth: number;
  borderColor: string;
  rimLights: boolean;
  /** 0–12 (px at a 1000px wheel). */
  separatorWidth: number;
  separatorColor: string;
  hubStyle: HubStyle;
  /** 10–35: % of the wheel diameter. */
  hubSize: number;
  hubColor: string;
  hubText: string;
  textOrientation: TextOrientation;
  fontFamily: FontChoice;
  /** Size each segment proportionally to its probability weight. */
  sizeByWeight: boolean;
  background: BackgroundSettings;
  /** 0–100 shadow/depth strength. */
  shadow: number;
  /** Glossy lighting overlay for a 3D look. */
  gloss: boolean;
}

export interface ResultSettings {
  showPopup: boolean;
  /** Open the result as a large full-screen presentation. */
  fullScreenResult: boolean;
  /** Show the name currently under the pointer while spinning. */
  showLiveLabel: boolean;
  /** Keep the result hidden until the wheel has completely stopped. */
  hideUntilStop: boolean;
  heading: string;
  /** Automatically exclude winners from later spins in this session. */
  removeWinner: boolean;
  /** Auto close popup after N seconds (0 = never). */
  autoCloseSeconds: number;
}

export interface WheelConfig {
  version: 1;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  segments: Segment[];
  design: WheelDesign;
  animation: AnimationSettings;
  result: ResultSettings;
}

export const MIN_SEGMENTS = 2;
export const MAX_SEGMENTS = 100;
export const CROWDED_SEGMENTS = 40;

