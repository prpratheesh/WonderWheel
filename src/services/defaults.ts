import type { AnimationSettings } from '../types/animation';
import type { Segment } from '../types/segment';
import type { AppSettings, Prefs, SoundKey } from '../types/settings';
import type { ResultSettings, ThemeId, WheelConfig, WheelDesign } from '../types/wheel';
import { contrastText, distributeColors, nextColor } from '../utils/colors';
import { uid } from '../utils/misc';
import { getTheme } from './themes';

export function defaultSegment(partial: Partial<Segment> = {}): Segment {
  const bg = partial.bgColor ?? '#3A86FF';
  return {
    id: uid('s_'),
    title: 'New item',
    subtitle: '',
    imageId: null,
    imagePosition: 'center',
    imageSize: 85,
    imageFit: 'contain',
    bgColor: bg,
    textColor: contrastText(bg),
    textSize: 100,
    fontWeight: 700,
    textAlign: 'outer',
    layout: 'text',
    visible: true,
    enabled: true,
    weight: 1,
    ...partial,
  };
}

export function defaultDesign(themeId: ThemeId = 'rainbow'): WheelDesign {
  const t = getTheme(themeId);
  return {
    themeId,
    size: 94,
    pointerPosition: 'top',
    pointerStyle: 'classic',
    pointerColor: t.pointer,
    borderWidth: 26,
    borderColor: t.border,
    rimLights: true,
    separatorWidth: 3,
    separatorColor: t.separator,
    hubStyle: 'classic',
    hubSize: 19,
    hubColor: t.hub,
    hubText: 'SPIN',
    textOrientation: 'auto',
    fontFamily: 'fredoka',
    sizeByWeight: false,
    background: { type: 'theme', color: t.bgFrom, gradientFrom: t.bgFrom, gradientTo: t.bgTo, imageId: null, overlay: 30 },
    shadow: 60,
    gloss: true,
  };
}

export function defaultAnimation(): AnimationSettings {
  return {
    duration: 6,
    revolutions: 6,
    direction: 'cw',
    easing: 'smooth',
    acceleration: 0.08,
    deceleration: 3,
    stopBehaviour: 'smooth',
    spinMode: 'auto',
    effects: {
      confetti: true,
      fireworks: false,
      stars: true,
      sparkles: true,
      glow: true,
      pointerBounce: true,
      vibration: true,
      popupAnimation: true,
      imageAnimation: true,
      backgroundCelebration: true,
    },
    intensity: 'medium',
  };
}

export function defaultResult(): ResultSettings {
  return {
    showPopup: true,
    fullScreenResult: false,
    showLiveLabel: true,
    hideUntilStop: false,
    heading: '🎉 CONGRATULATIONS! 🎉',
    removeWinner: false,
    autoCloseSeconds: 0,
  };
}

type Item = string | { title: string; subtitle?: string };

export function createWheel(name: string, items: Item[], themeId: ThemeId = 'rainbow'): WheelConfig {
  const theme = getTheme(themeId);
  const colors = distributeColors(items.length, theme.palette);
  const now = Date.now();
  return {
    version: 1,
    id: uid('w_'),
    name,
    createdAt: now,
    updatedAt: now,
    segments: items.map((it, i) =>
      defaultSegment({
        title: typeof it === 'string' ? it : it.title,
        subtitle: typeof it === 'string' ? '' : it.subtitle ?? '',
        bgColor: colors[i],
        textColor: contrastText(colors[i]),
      }),
    ),
    design: defaultDesign(themeId),
    animation: defaultAnimation(),
    result: defaultResult(),
  };
}

/** Adds a new segment with an automatically chosen contrasting colour. */
export function newSegmentFor(wheel: WheelConfig, partial: Partial<Segment> = {}): Segment {
  const palette = getTheme(wheel.design.themeId).palette;
  const bg = nextColor(wheel.segments.map((s) => s.bgColor), palette);
  return defaultSegment({ title: `Item ${wheel.segments.length + 1}`, bgColor: bg, textColor: contrastText(bg), ...partial });
}

export interface WheelTemplate {
  key: string;
  name: string;
  emoji: string;
  themeId: ThemeId;
  items: Item[];
}

export const TEMPLATES: WheelTemplate[] = [
  {
    key: 'students',
    name: 'Student Names',
    emoji: '🧒',
    themeId: 'rainbow',
    items: ['Janaaki', 'Arjun', 'Meera', 'Rahul', 'Aisha', 'Kabir', 'Diya', 'Vihaan', 'Ananya', 'Rohan', 'Saanvi', 'Ishaan'],
  },
  {
    key: 'english',
    name: 'English Questions',
    emoji: '📖',
    themeId: 'candy',
    items: [
      { title: 'A word with A', subtitle: 'Say a word starting with A' },
      { title: 'Name an animal', subtitle: 'Any animal you like' },
      { title: 'Spell CAT', subtitle: 'C - A - T' },
      { title: 'Opposite of BIG', subtitle: 'Think small!' },
      { title: 'Rhymes with HAT', subtitle: 'Cat, mat, bat…' },
      { title: 'Name a colour', subtitle: 'Point to it too' },
      { title: 'Read a sentence', subtitle: 'From your book' },
      { title: 'Name a fruit', subtitle: 'Yummy!' },
    ],
  },
  {
    key: 'maths',
    name: 'Mathematics',
    emoji: '➕',
    themeId: 'ocean',
    items: ['2 + 3 = ?', '5 − 1 = ?', 'Count to 20', '4 + 4 = ?', 'Draw a triangle', '10 − 3 = ?', 'Is 6 even?', '1 + 7 = ?', 'Count by 2s', '9 − 4 = ?'],
  },
  {
    key: 'science',
    name: 'Science Quiz',
    emoji: '🔬',
    themeId: 'space',
    items: [
      { title: 'Name a planet', subtitle: 'In our solar system' },
      { title: 'What do plants need?', subtitle: 'To grow big' },
      { title: 'Our 5 senses', subtitle: 'Name them all' },
      { title: 'Hot or cold?', subtitle: 'Ice cream' },
      { title: 'Name a bird', subtitle: 'That can fly' },
      { title: 'Day or night?', subtitle: 'When do we see stars' },
      { title: 'Living or not?', subtitle: 'A tree' },
      { title: 'Name a sea animal', subtitle: 'Under the water' },
    ],
  },
  {
    key: 'rewards',
    name: 'Rewards',
    emoji: '🏆',
    themeId: 'pastel',
    items: ['⭐ Gold Star', '🎨 Free Drawing', '📚 Story Time', '🏆 Class Leader', '🎵 Pick a Song', '🧸 Toy Time', '🍎 Line Leader', '👏 Big Clap'],
  },
  {
    key: 'activities',
    name: 'Classroom Activities',
    emoji: '🎲',
    themeId: 'classroom',
    items: ['💃 Dance Break', '🎤 Sing a Song', '🙋 Simon Says', '✏️ Draw a Picture', '🐘 Act an Animal', '📖 Tell a Story', '👏 Clap Game', '🤫 Quiet Reading'],
  },
  {
    key: 'blank',
    name: 'Blank Wheel',
    emoji: '✨',
    themeId: 'rainbow',
    items: ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5', 'Item 6'],
  },
];

export function wheelFromTemplate(key: string): WheelConfig {
  const t = TEMPLATES.find((x) => x.key === key) ?? TEMPLATES[0];
  return createWheel(t.name, t.items, t.themeId);
}

const SOUND_KEYS: SoundKey[] = ['spin', 'tick', 'slowdown', 'win', 'celebration', 'click'];

export function defaultAppSettings(): AppSettings {
  const vol: Record<SoundKey, number> = { spin: 45, tick: 60, slowdown: 40, win: 80, celebration: 60, click: 50 };
  return {
    sound: {
      master: 80,
      channels: Object.fromEntries(SOUND_KEYS.map((k) => [k, { enabled: true, volume: vol[k] }])) as AppSettings['sound']['channels'],
    },
    reducedMotion: 'auto',
    performanceMode: 'auto',
  };
}

export function defaultPrefs(): Prefs {
  return { muted: false, lastWheelId: null, settingsTab: 'general', showHistory: true };
}

/* ------------------------------------------------------------------ */
/* Normalisation — makes stored/imported data safe and complete.        */
/* ------------------------------------------------------------------ */

type AnyRec = Record<string, unknown>;
const isRec = (v: unknown): v is AnyRec => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Deep-merge `src` onto `base`, keeping only keys known in `base` with matching primitive types. */
function mergeKnown<T>(base: T, src: unknown): T {
  if (!isRec(src) || !isRec(base)) return base;
  const out: AnyRec = { ...(base as AnyRec) };
  for (const key of Object.keys(base as AnyRec)) {
    const b = (base as AnyRec)[key];
    const v = src[key];
    if (v === undefined) continue;
    if (isRec(b)) out[key] = mergeKnown(b, v);
    else if (b === null) out[key] = typeof v === 'string' || v === null ? v : null;
    else if (typeof b === typeof v) out[key] = v;
  }
  return out as T;
}

const num = (v: number, min: number, max: number, fallback: number) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);

export function normalizeSegment(raw: unknown): Segment {
  const s = mergeKnown(defaultSegment(), raw);
  if (isRec(raw) && typeof raw.id === 'string' && raw.id) s.id = raw.id;
  s.title = String(s.title).slice(0, 120);
  s.subtitle = String(s.subtitle).slice(0, 160);
  s.imageSize = num(s.imageSize, 30, 100, 85);
  s.textSize = num(s.textSize, 50, 200, 100);
  s.weight = num(s.weight, 0, 100, 1);
  return s;
}

export function normalizeWheel(raw: unknown): WheelConfig | null {
  if (!isRec(raw) || !Array.isArray(raw.segments)) return null;
  const base = createWheel('Wheel', []);
  const themeId = isRec(raw.design) && typeof raw.design.themeId === 'string' ? (raw.design.themeId as ThemeId) : 'rainbow';
  const w: WheelConfig = {
    ...base,
    id: typeof raw.id === 'string' && raw.id ? raw.id : base.id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.slice(0, 80) : 'Untitled Wheel',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : base.createdAt,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : base.updatedAt,
    segments: raw.segments.slice(0, 100).map(normalizeSegment),
    design: mergeKnown(defaultDesign(getTheme(themeId).id), raw.design),
    animation: mergeKnown(defaultAnimation(), raw.animation),
    result: mergeKnown(defaultResult(), raw.result),
  };
  w.animation.duration = num(w.animation.duration, 1, 60, 6);
  w.animation.revolutions = num(w.animation.revolutions, 1, 50, 6);
  while (w.segments.length < 2) w.segments.push(newSegmentFor(w));
  return w;
}

export function normalizeAppSettings(raw: unknown): AppSettings {
  return mergeKnown(defaultAppSettings(), raw);
}

