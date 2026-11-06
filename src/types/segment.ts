/** A single partition of the wheel. Every field is independently configurable. */

export type SegmentLayout = 'text' | 'image' | 'imageAbove' | 'imageBelow' | 'imageBeside' | 'icon';
export type ImageFit = 'contain' | 'cover';
/** Radial position of an image inside its segment (used by the "Image only" layout). */
export type ImagePosition = 'inner' | 'center' | 'outer';
/** Radial position of the text block: towards the hub, middle, or towards the rim. */
export type TextAlign = 'inner' | 'center' | 'outer';
export type FontWeight = 400 | 500 | 600 | 700 | 800;

export interface Segment {
  id: string;
  title: string;
  subtitle: string;
  /** Reference to an image blob stored in IndexedDB. */
  imageId: string | null;
  imagePosition: ImagePosition;
  /** 30–100 (% of the space available to the image). */
  imageSize: number;
  imageFit: ImageFit;
  bgColor: string;
  textColor: string;
  /** 50–200 (% of the automatic size). */
  textSize: number;
  fontWeight: FontWeight;
  textAlign: TextAlign;
  layout: SegmentLayout;
  /** Hidden segments are not drawn on the wheel at all. */
  visible: boolean;
  /** Disabled segments are drawn (dimmed) but can never be selected. */
  enabled: boolean;
  /** Probability weight. 0 = never selected. Default 1. */
  weight: number;
}

export const SEGMENT_LAYOUT_LABELS: Record<SegmentLayout, string> = {
  text: 'Text only',
  image: 'Image only',
  imageAbove: 'Image above text',
  imageBelow: 'Image below text',
  imageBeside: 'Image beside text',
  icon: 'Small icon with text',
};

