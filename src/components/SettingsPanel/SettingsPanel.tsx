import React, { useState } from 'react';
import {
  FolderKanban,
  Image as ImageIcon,
  Layers,
  Palette,
  Play,
  Sliders,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { newSegmentFor } from '../../services/defaults';
import { getTheme, THEME_LIST } from '../../services/themes';
import {
  EASING_LABELS,
  type EasingPreset,
  type EffectToggles,
  type Intensity,
  type SpinDirection,
  type SpinMode,
  type StopBehaviour,
} from '../../types/animation';
import {
  SOUND_LABELS,
  type AppSettings,
  type SoundKey,
  type TriState,
} from '../../types/settings';
import {
  CROWDED_SEGMENTS,
  MAX_SEGMENTS,
  MIN_SEGMENTS,
  type BackgroundType,
  type FontChoice,
  type HubStyle,
  type PointerPosition,
  type PointerStyle,
  type TextOrientation,
  type ThemeId,
  type WheelConfig,
} from '../../types/wheel';
import { contrastText, distributeColors } from '../../utils/colors';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import { ImageUploader } from '../ImageUploader/ImageUploader';
import { SegmentEditor } from '../SegmentEditor/SegmentEditor';
import { Presets } from '../../pages/Presets/Presets';

export type SettingsTab =
  | 'general'
  | 'design'
  | 'segments'
  | 'images'
  | 'animations'
  | 'sounds'
  | 'presets';

interface SettingsPanelProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  wheel: WheelConfig;
  onChange: (updater: (prev: WheelConfig) => WheelConfig) => void;
  appSettings: AppSettings;
  onUpdateAppSettings: (updater: (prev: AppSettings) => AppSettings) => void;
  muted: boolean;
  onToggleMute: () => void;
  onTestSound: (key: SoundKey) => void;
  wheels: WheelConfig[];
  activeWheelId: string;
  onSelectWheel: (id: string) => void;
  onCreateFromTemplate: (key: string, customName?: string) => Promise<WheelConfig>;
  onDuplicateWheel: (id: string) => Promise<void>;
  onRenameWheel: (id: string, name: string) => Promise<void>;
  onDeleteWheel: (id: string) => Promise<void>;
  onImportWheels: (imported: WheelConfig[], replaceExisting: boolean) => Promise<void>;
}

const NAV_ITEMS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: 'General', icon: <Sliders size={18} /> },
  { id: 'design', label: 'Wheel Design', icon: <Palette size={18} /> },
  { id: 'segments', label: 'Segments', icon: <Layers size={18} /> },
  { id: 'images', label: 'Images', icon: <ImageIcon size={18} /> },
  { id: 'animations', label: 'Animations', icon: <Sparkles size={18} /> },
  { id: 'sounds', label: 'Sounds', icon: <Volume2 size={18} /> },
  { id: 'presets', label: 'Presets', icon: <FolderKanban size={18} /> },
];

const EFFECT_LIST: { key: keyof EffectToggles; label: string; desc: string }[] = [
  { key: 'confetti', label: 'Confetti Celebration', desc: 'Colourful paper bursts across the screen' },
  { key: 'fireworks', label: 'Fireworks', desc: 'Rockets launching and bursting in the sky' },
  { key: 'stars', label: 'Floating Stars', desc: 'Golden stars rising gently' },
  { key: 'sparkles', label: 'Sparkle Effects', desc: 'Twinkling sparkles around the wheel' },
  { key: 'glow', label: 'Glowing Selected Segment', desc: 'Bright highlight around the winning wedge' },
  { key: 'pointerBounce', label: 'Pointer Bounce', desc: 'Pointer ticks as segments pass underneath' },
  { key: 'vibration', label: 'Wheel Vibration on Selection', desc: 'Playful celebratory pulse when stopping' },
  { key: 'popupAnimation', label: 'Result Popup Animation', desc: 'Spring entrance for the winner card' },
  { key: 'imageAnimation', label: 'Winning Image Animation', desc: 'Animated bounce on the selected picture' },
  { key: 'backgroundCelebration', label: 'Background Celebration Effects', desc: 'Festive animated glow behind the result' },
];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  activeTab,
  onTabChange,
  wheel,
  onChange,
  appSettings,
  onUpdateAppSettings,
  muted,
  onToggleMute,
  onTestSound,
  wheels,
  activeWheelId,
  onSelectWheel,
  onCreateFromTemplate,
  onDuplicateWheel,
  onRenameWheel,
  onDeleteWheel,
  onImportWheels,
}) => {
  const [pendingPartitionTarget, setPendingPartitionTarget] = useState<number | null>(null);

  const applyPartitionCount = (targetCount: number) => {
    const clamped = Math.min(MAX_SEGMENTS, Math.max(MIN_SEGMENTS, Math.round(targetCount)));
    onChange((prev) => {
      const cur = prev.segments.length;
      if (clamped === cur) return prev;
      if (clamped < cur) {
        return { ...prev, segments: prev.segments.slice(0, clamped) };
      }
      const working = { ...prev, segments: [...prev.segments] };
      while (working.segments.length < clamped) {
        working.segments.push(newSegmentFor(working));
      }
      return working;
    });
  };

  const requestPartitionCount = (next: number) => {
    const clamped = Math.min(MAX_SEGMENTS, Math.max(MIN_SEGMENTS, Math.round(next)));
    if (clamped < wheel.segments.length) {
      setPendingPartitionTarget(clamped);
    } else {
      applyPartitionCount(clamped);
    }
  };

  const applyTheme = (themeId: ThemeId) => {
    const t = getTheme(themeId);
    onChange((prev) => {
      const cols = distributeColors(prev.segments.length, t.palette);
      return {
        ...prev,
        design: {
          ...prev.design,
          themeId,
          borderColor: t.border,
          pointerColor: t.pointer,
          hubColor: t.hub,
          separatorColor: t.separator,
          background:
            prev.design.background.type === 'theme'
              ? {
                  ...prev.design.background,
                  color: t.bgFrom,
                  gradientFrom: t.bgFrom,
                  gradientTo: t.bgTo,
                }
              : prev.design.background,
        },
        segments: prev.segments.map((s, i) => ({
          ...s,
          bgColor: cols[i],
          textColor: contrastText(cols[i]),
        })),
      };
    });
  };

  return (
    <div className="settings-shell">
      <nav className="settings-nav" aria-label="Settings categories">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`settings-nav__item ${activeTab === item.id ? 'is-active' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="settings-content">
        {activeTab === 'general' && (
          <div className="settings-section">
            <div className="section-header">
              <div>
                <h2>General Wheel Settings</h2>
                <p className="muted">
                  Configure the wheel name, number of partitions, spin behaviour and result presentation.
                </p>
              </div>
            </div>

            <div className="card-group">
              <h3>Wheel Identity & Partitions</h3>
              <div className="form-grid form-grid--2">
                <label className="field">
                  <span>Wheel Name</span>
                  <input
                    type="text"
                    value={wheel.name}
                    maxLength={80}
                    onChange={(e) =>
                      onChange((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </label>

                <div className="field">
                  <span>
                    Number of Partitions ({wheel.segments.length} / {MAX_SEGMENTS})
                  </span>
                  <div className="slider-num-row">
                    <input
                      type="range"
                      min={MIN_SEGMENTS}
                      max={MAX_SEGMENTS}
                      value={wheel.segments.length}
                      onChange={(e) => applyPartitionCount(Number(e.target.value))}
                    />
                    <input
                      type="number"
                      min={MIN_SEGMENTS}
                      max={MAX_SEGMENTS}
                      value={wheel.segments.length}
                      onChange={(e) => requestPartitionCount(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              {wheel.segments.length >= CROWDED_SEGMENTS && (
                <div className="callout callout--warn">
                  <strong>Heads-up ({wheel.segments.length} partitions):</strong> Labels are crowded. ClassSpin will automatically switch to radial orientation, reduce font size and hide optional subtitles so text remains legible.
                </div>
              )}
            </div>

            <div className="card-group">
              <h3>Spin Timing & Rotation</h3>
              <div className="form-grid form-grid--2">
                <div className="field">
                  <span>Rotation Duration ({wheel.animation.duration}s)</span>
                  <div className="slider-num-row">
                    <input
                      type="range"
                      min={1}
                      max={60}
                      value={wheel.animation.duration}
                      onChange={(e) =>
                        onChange((prev) => ({
                          ...prev,
                          animation: {
                            ...prev.animation,
                            duration: Number(e.target.value),
                          },
                        }))
                      }
                    />
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={wheel.animation.duration}
                      onChange={(e) =>
                        onChange((prev) => ({
                          ...prev,
                          animation: {
                            ...prev.animation,
                            duration: Math.min(60, Math.max(1, Number(e.target.value) || 1)),
                          },
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="field">
                  <span>Complete Rotations Before Stopping ({wheel.animation.revolutions})</span>
                  <div className="slider-num-row">
                    <input
                      type="range"
                      min={1}
                      max={50}
                      value={wheel.animation.revolutions}
                      onChange={(e) =>
                        onChange((prev) => ({
                          ...prev,
                          animation: {
                            ...prev.animation,
                            revolutions: Number(e.target.value),
                          },
                        }))
                      }
                    />
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={wheel.animation.revolutions}
                      onChange={(e) =>
                        onChange((prev) => ({
                          ...prev,
                          animation: {
                            ...prev.animation,
                            revolutions: Math.min(50, Math.max(1, Number(e.target.value) || 1)),
                          },
                        }))
                      }
                    />
                  </div>
                </div>

                <label className="field">
                  <span>Rotation Direction</span>
                  <select
                    value={wheel.animation.direction}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        animation: {
                          ...prev.animation,
                          direction: e.target.value as SpinDirection,
                        },
                      }))
                    }
                  >
                    <option value="cw">Clockwise (CW)</option>
                    <option value="ccw">Anticlockwise (CCW)</option>
                  </select>
                </label>

                <label className="field">
                  <span>Animation Easing Style</span>
                  <select
                    value={wheel.animation.easing}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        animation: {
                          ...prev.animation,
                          easing: e.target.value as EasingPreset,
                        },
                      }))
                    }
                  >
                    {(Object.keys(EASING_LABELS) as EasingPreset[]).map((k) => (
                      <option key={k} value={k}>
                        {EASING_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Spin Interaction Mode</span>
                  <select
                    value={wheel.animation.spinMode}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        animation: {
                          ...prev.animation,
                          spinMode: e.target.value as SpinMode,
                        },
                      }))
                    }
                  >
                    <option value="auto">Automatic Duration (Default)</option>
                    <option value="manual">Manual Stop (Click to Start, Click to Stop)</option>
                  </select>
                </label>

                <label className="field">
                  <span>Segment Sizing</span>
                  <select
                    value={wheel.design.sizeByWeight ? 'weighted' : 'equal'}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        design: {
                          ...prev.design,
                          sizeByWeight: e.target.value === 'weighted',
                        },
                      }))
                    }
                  >
                    <option value="equal">Equal Slice Sizes</option>
                    <option value="weighted">Proportional to Probability Weight</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="card-group">
              <h3>Selected Result Presentation</h3>
              <div className="form-grid form-grid--2">
                <label className="field">
                  <span>Celebration Banner Heading</span>
                  <input
                    type="text"
                    value={wheel.result.heading}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        result: { ...prev.result, heading: e.target.value },
                      }))
                    }
                  />
                </label>

                <label className="field">
                  <span>Auto-Close Result Popup (0 = stay open)</span>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={wheel.result.autoCloseSeconds}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        result: {
                          ...prev.result,
                          autoCloseSeconds: Math.max(0, Number(e.target.value) || 0),
                        },
                      }))
                    }
                  />
                </label>
              </div>

              <div className="toggle-grid">
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={wheel.result.showPopup}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        result: { ...prev.result, showPopup: e.target.checked },
                      }))
                    }
                  />
                  <div>
                    <strong>Show Winner Popup Card</strong>
                    <span>Display the celebration dialog when the wheel stops</span>
                  </div>
                </label>

                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={wheel.result.fullScreenResult}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        result: { ...prev.result, fullScreenResult: e.target.checked },
                      }))
                    }
                  />
                  <div>
                    <strong>Large Full-Screen Result Presentation</strong>
                    <span>Show the selected result in a giant projector-ready card</span>
                  </div>
                </label>

                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={wheel.result.hideUntilStop}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        result: { ...prev.result, hideUntilStop: e.target.checked },
                      }))
                    }
                  />
                  <div>
                    <strong>Hide Result Until Wheel Completely Stops</strong>
                    <span>Keep the suspense high by hiding live pointer labels during the spin</span>
                  </div>
                </label>

                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={wheel.result.removeWinner}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        result: { ...prev.result, removeWinner: e.target.checked },
                      }))
                    }
                  />
                  <div>
                    <strong>Auto-Exclude Selected Winner After Each Spin</strong>
                    <span>Avoid picking the same student twice in one round</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'design' && (
          <div className="settings-section">
            <div className="section-header">
              <div>
                <h2>Wheel Design & Visual Themes</h2>
                <p className="muted">
                  Choose a classroom theme or customize every visual detail of the wheel, pointer, center hub and background.
                </p>
              </div>
            </div>

            <div className="card-group">
              <h3>Preset Colour Themes</h3>
              <div className="theme-grid">
                {THEME_LIST.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`theme-card ${wheel.design.themeId === t.id ? 'is-active' : ''}`}
                    onClick={() => applyTheme(t.id)}
                  >
                    <div className="theme-card__swatches">
                      {t.palette.slice(0, 6).map((c, i) => (
                        <span key={i} style={{ background: c }} />
                      ))}
                    </div>
                    <span className="theme-card__name">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="card-group">
              <h3>Geometry, Border & Separators</h3>
              <div className="form-grid form-grid--3">
                <label className="field">
                  <span>Wheel Size ({wheel.design.size}%)</span>
                  <input
                    type="range"
                    min={55}
                    max={100}
                    value={wheel.design.size}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        design: { ...prev.design, size: Number(e.target.value) },
                      }))
                    }
                  />
                </label>

                <label className="field">
                  <span>Border Thickness ({wheel.design.borderWidth}px)</span>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={wheel.design.borderWidth}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        design: { ...prev.design, borderWidth: Number(e.target.value) },
                      }))
                    }
                  />
                </label>

                <label className="field">
                  <span>Border Colour</span>
                  <div className="color-field">
                    <input
                      type="color"
                      value={wheel.design.borderColor}
                      onChange={(e) =>
                        onChange((prev) => ({
                          ...prev,
                          design: { ...prev.design, borderColor: e.target.value },
                        }))
                      }
                    />
                    <input
                      type="text"
                      value={wheel.design.borderColor}
                      onChange={(e) =>
                        onChange((prev) => ({
                          ...prev,
                          design: { ...prev.design, borderColor: e.target.value },
                        }))
                      }
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Separator Thickness ({wheel.design.separatorWidth}px)</span>
                  <input
                    type="range"
                    min={0}
                    max={12}
                    step={0.5}
                    value={wheel.design.separatorWidth}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        design: {
                          ...prev.design,
                          separatorWidth: Number(e.target.value),
                        },
                      }))
                    }
                  />
                </label>

                <label className="field">
                  <span>Separator Colour</span>
                  <div className="color-field">
                    <input
                      type="color"
                      value={wheel.design.separatorColor}
                      onChange={(e) =>
                        onChange((prev) => ({
                          ...prev,
                          design: { ...prev.design, separatorColor: e.target.value },
                        }))
                      }
                    />
                    <input
                      type="text"
                      value={wheel.design.separatorColor}
                      onChange={(e) =>
                        onChange((prev) => ({
                          ...prev,
                          design: { ...prev.design, separatorColor: e.target.value },
                        }))
                      }
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Shadow & Depth ({wheel.design.shadow}%)</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={wheel.design.shadow}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        design: { ...prev.design, shadow: Number(e.target.value) },
                      }))
                    }
                  />
                </label>
              </div>

              <div className="toggle-grid">
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={wheel.design.rimLights}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        design: { ...prev.design, rimLights: e.target.checked },
                      }))
                    }
                  />
                  <div>
                    <strong>Game-Show Rim Lights</strong>
                    <span>Decorative glowing bulbs around the wheel border</span>
                  </div>
                </label>

                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={wheel.design.gloss}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        design: { ...prev.design, gloss: e.target.checked },
                      }))
                    }
                  />
                  <div>
                    <strong>3D Glossy Highlight</strong>
                    <span>Soft lighting reflection across the wheel surface</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="card-group">
              <h3>Pointer & Center Hub</h3>
              <div className="form-grid form-grid--3">
                <label className="field">
                  <span>Pointer Position</span>
                  <select
                    value={wheel.design.pointerPosition}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        design: {
                          ...prev.design,
                          pointerPosition: e.target.value as PointerPosition,
                        },
                      }))
                    }
                  >
                    <option value="top">Top (12 o’clock)</option>
                    <option value="right">Right (3 o’clock)</option>
                    <option value="bottom">Bottom (6 o’clock)</option>
                    <option value="left">Left (9 o’clock)</option>
                  </select>
                </label>

                <label className="field">
                  <span>Pointer Style</span>
                  <select
                    value={wheel.design.pointerStyle}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        design: {
                          ...prev.design,
                          pointerStyle: e.target.value as PointerStyle,
                        },
                      }))
                    }
                  >
                    <option value="classic">Classic Triangle</option>
                    <option value="arrow">Bold Arrow</option>
                    <option value="pin">Teardrop Pin</option>
                  </select>
                </label>

                <label className="field">
                  <span>Pointer Colour</span>
                  <div className="color-field">
                    <input
                      type="color"
                      value={wheel.design.pointerColor}
                      onChange={(e) =>
                        onChange((prev) => ({
                          ...prev,
                          design: { ...prev.design, pointerColor: e.target.value },
                        }))
                      }
                    />
                    <input
                      type="text"
                      value={wheel.design.pointerColor}
                      onChange={(e) =>
                        onChange((prev) => ({
                          ...prev,
                          design: { ...prev.design, pointerColor: e.target.value },
                        }))
                      }
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Center Hub Design</span>
                  <select
                    value={wheel.design.hubStyle}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        design: {
                          ...prev.design,
                          hubStyle: e.target.value as HubStyle,
                        },
                      }))
                    }
                  >
                    <option value="classic">Classic Ring</option>
                    <option value="gradient">3D Gradient Dome</option>
                    <option value="star">Star Badge</option>
                    <option value="minimal">Minimal Cap</option>
                    <option value="none">Hidden</option>
                  </select>
                </label>

                <label className="field">
                  <span>Center Hub Size ({wheel.design.hubSize}%)</span>
                  <input
                    type="range"
                    min={10}
                    max={35}
                    value={wheel.design.hubSize}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        design: { ...prev.design, hubSize: Number(e.target.value) },
                      }))
                    }
                  />
                </label>

                <label className="field">
                  <span>Center Hub Colour</span>
                  <div className="color-field">
                    <input
                      type="color"
                      value={wheel.design.hubColor}
                      onChange={(e) =>
                        onChange((prev) => ({
                          ...prev,
                          design: { ...prev.design, hubColor: e.target.value },
                        }))
                      }
                    />
                    <input
                      type="text"
                      value={wheel.design.hubColor}
                      onChange={(e) =>
                        onChange((prev) => ({
                          ...prev,
                          design: { ...prev.design, hubColor: e.target.value },
                        }))
                      }
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Hub Label</span>
                  <input
                    type="text"
                    maxLength={12}
                    value={wheel.design.hubText}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        design: { ...prev.design, hubText: e.target.value },
                      }))
                    }
                  />
                </label>

                <label className="field">
                  <span>Typography</span>
                  <select
                    value={wheel.design.fontFamily}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        design: {
                          ...prev.design,
                          fontFamily: e.target.value as FontChoice,
                        },
                      }))
                    }
                  >
                    <option value="fredoka">Fredoka (Playful Rounded)</option>
                    <option value="nunito">Nunito (Clean Classroom)</option>
                    <option value="system">System Sans-Serif</option>
                  </select>
                </label>

                <label className="field">
                  <span>Label Orientation</span>
                  <select
                    value={wheel.design.textOrientation}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        design: {
                          ...prev.design,
                          textOrientation: e.target.value as TextOrientation,
                        },
                      }))
                    }
                  >
                    <option value="auto">Automatic (Upright ≤9 slices, Radial &gt;9)</option>
                    <option value="radial">Radial (Spoke-style)</option>
                    <option value="upright">Horizontal / Upright</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="card-group">
              <h3>Stage Background</h3>
              <div className="form-grid form-grid--3">
                <label className="field">
                  <span>Background Style</span>
                  <select
                    value={wheel.design.background.type}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        design: {
                          ...prev.design,
                          background: {
                            ...prev.design.background,
                            type: e.target.value as BackgroundType,
                          },
                        },
                      }))
                    }
                  >
                    <option value="theme">Match Active Theme</option>
                    <option value="gradient">Custom Gradient</option>
                    <option value="color">Solid Colour</option>
                    <option value="image">Custom Background Image</option>
                  </select>
                </label>

                {wheel.design.background.type === 'color' && (
                  <label className="field">
                    <span>Background Colour</span>
                    <div className="color-field">
                      <input
                        type="color"
                        value={wheel.design.background.color}
                        onChange={(e) =>
                          onChange((prev) => ({
                            ...prev,
                            design: {
                              ...prev.design,
                              background: {
                                ...prev.design.background,
                                color: e.target.value,
                              },
                            },
                          }))
                        }
                      />
                      <input
                        type="text"
                        value={wheel.design.background.color}
                        onChange={(e) =>
                          onChange((prev) => ({
                            ...prev,
                            design: {
                              ...prev.design,
                              background: {
                                ...prev.design.background,
                                color: e.target.value,
                              },
                            },
                          }))
                        }
                      />
                    </div>
                  </label>
                )}

                {wheel.design.background.type === 'gradient' && (
                  <>
                    <label className="field">
                      <span>Gradient Start</span>
                      <input
                        type="color"
                        value={wheel.design.background.gradientFrom}
                        onChange={(e) =>
                          onChange((prev) => ({
                            ...prev,
                            design: {
                              ...prev.design,
                              background: {
                                ...prev.design.background,
                                gradientFrom: e.target.value,
                              },
                            },
                          }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Gradient End</span>
                      <input
                        type="color"
                        value={wheel.design.background.gradientTo}
                        onChange={(e) =>
                          onChange((prev) => ({
                            ...prev,
                            design: {
                              ...prev.design,
                              background: {
                                ...prev.design.background,
                                gradientTo: e.target.value,
                              },
                            },
                          }))
                        }
                      />
                    </label>
                  </>
                )}

                {wheel.design.background.type === 'image' && (
                  <>
                    <div className="field">
                      <span>Background Image</span>
                      <ImageUploader
                        variant="background"
                        imageId={wheel.design.background.imageId}
                        onChange={(imageId) =>
                          onChange((prev) => ({
                            ...prev,
                            design: {
                              ...prev.design,
                              background: {
                                ...prev.design.background,
                                imageId,
                              },
                            },
                          }))
                        }
                      />
                    </div>
                    <label className="field">
                      <span>Darkening Overlay ({wheel.design.background.overlay}%)</span>
                      <input
                        type="range"
                        min={0}
                        max={80}
                        value={wheel.design.background.overlay}
                        onChange={(e) =>
                          onChange((prev) => ({
                            ...prev,
                            design: {
                              ...prev.design,
                              background: {
                                ...prev.design.background,
                                overlay: Number(e.target.value),
                              },
                            },
                          }))
                        }
                      />
                    </label>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'segments' && (
          <SegmentEditor wheel={wheel} onChange={onChange} />
        )}

        {activeTab === 'images' && (
          <SegmentEditor wheel={wheel} onChange={onChange} imagesOnlyView />
        )}

        {activeTab === 'animations' && (
          <div className="settings-section">
            <div className="section-header">
              <div>
                <h2>Animation & Celebration Engine</h2>
                <p className="muted">
                  Fine-tune rotation physics, easing curves, celebration particles and performance options.
                </p>
              </div>
            </div>

            <div className="card-group">
              <h3>Wheel Physics & Stopping Curve</h3>
              <div className="form-grid form-grid--3">
                <label className="field">
                  <span>Easing Preset</span>
                  <select
                    value={wheel.animation.easing}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        animation: {
                          ...prev.animation,
                          easing: e.target.value as EasingPreset,
                        },
                      }))
                    }
                  >
                    {(Object.keys(EASING_LABELS) as EasingPreset[]).map((k) => (
                      <option key={k} value={k}>
                        {EASING_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Final Stopping Behaviour</span>
                  <select
                    value={wheel.animation.stopBehaviour}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        animation: {
                          ...prev.animation,
                          stopBehaviour: e.target.value as StopBehaviour,
                        },
                      }))
                    }
                  >
                    <option value="smooth">Smooth Natural Stop</option>
                    <option value="bounce">Gentle Settle Bounce</option>
                    <option value="abrupt">Sudden / Abrupt Stop</option>
                  </select>
                </label>

                <label className="field">
                  <span>Celebration Intensity</span>
                  <select
                    value={wheel.animation.intensity}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        animation: {
                          ...prev.animation,
                          intensity: e.target.value as Intensity,
                        },
                      }))
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>

                {wheel.animation.easing === 'custom' && (
                  <>
                    <label className="field">
                      <span>
                        Starting Acceleration ({Math.round(wheel.animation.acceleration * 100)}%)
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={0.4}
                        step={0.02}
                        value={wheel.animation.acceleration}
                        onChange={(e) =>
                          onChange((prev) => ({
                            ...prev,
                            animation: {
                              ...prev.animation,
                              acceleration: Number(e.target.value),
                            },
                          }))
                        }
                      />
                    </label>

                    <label className="field">
                      <span>
                        Deceleration Curve Power ({wheel.animation.deceleration.toFixed(1)})
                      </span>
                      <input
                        type="range"
                        min={1}
                        max={8}
                        step={0.2}
                        value={wheel.animation.deceleration}
                        onChange={(e) =>
                          onChange((prev) => ({
                            ...prev,
                            animation: {
                              ...prev.animation,
                              deceleration: Number(e.target.value),
                            },
                          }))
                        }
                      />
                    </label>
                  </>
                )}
              </div>
            </div>

            <div className="card-group">
              <h3>Celebration & Visual Effects</h3>
              <div className="toggle-grid">
                {EFFECT_LIST.map((item) => (
                  <label key={item.key} className="toggle-row">
                    <input
                      type="checkbox"
                      checked={wheel.animation.effects[item.key]}
                      onChange={(e) =>
                        onChange((prev) => ({
                          ...prev,
                          animation: {
                            ...prev.animation,
                            effects: {
                              ...prev.animation.effects,
                              [item.key]: e.target.checked,
                            },
                          },
                        }))
                      }
                    />
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="card-group">
              <h3>Accessibility & Device Performance</h3>
              <div className="form-grid form-grid--2">
                <label className="field">
                  <span>Reduced Motion</span>
                  <select
                    value={appSettings.reducedMotion}
                    onChange={(e) =>
                      onUpdateAppSettings((prev) => ({
                        ...prev,
                        reducedMotion: e.target.value as TriState,
                      }))
                    }
                  >
                    <option value="auto">Auto (Follow System Preference)</option>
                    <option value="on">On (Minimal Motion)</option>
                    <option value="off">Off (Full Animations)</option>
                  </select>
                </label>

                <label className="field">
                  <span>Performance-Friendly Rendering Mode</span>
                  <select
                    value={appSettings.performanceMode}
                    onChange={(e) =>
                      onUpdateAppSettings((prev) => ({
                        ...prev,
                        performanceMode: e.target.value as TriState,
                      }))
                    }
                  >
                    <option value="auto">Auto-Detect Low-Powered Devices</option>
                    <option value="on">Always On (60 FPS Saver)</option>
                    <option value="off">Off (Maximum Visual Detail)</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sounds' && (
          <div className="settings-section">
            <div className="section-header">
              <div>
                <h2>Classroom Sound Effects</h2>
                <p className="muted">
                  All sounds are synthesised cleanly in real time using the browser Web Audio API — lightweight and 100% offline.
                </p>
              </div>
              <button
                type="button"
                className={`btn btn--sm ${muted ? 'btn--danger' : 'btn--secondary'}`}
                onClick={onToggleMute}
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                <span>{muted ? 'Unmute All Sounds' : 'Mute All Sounds'}</span>
              </button>
            </div>

            <div className="card-group">
              <div className="field">
                <span>Master Volume ({appSettings.sound.master}%)</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={appSettings.sound.master}
                  onChange={(e) =>
                    onUpdateAppSettings((prev) => ({
                      ...prev,
                      sound: { ...prev.sound, master: Number(e.target.value) },
                    }))
                  }
                />
              </div>
            </div>

            <div className="sound-list">
              {(Object.keys(SOUND_LABELS) as SoundKey[]).map((key) => {
                const ch = appSettings.sound.channels[key];
                return (
                  <div key={key} className="sound-row">
                    <label className="sound-row__toggle">
                      <input
                        type="checkbox"
                        checked={ch.enabled}
                        onChange={(e) =>
                          onUpdateAppSettings((prev) => ({
                            ...prev,
                            sound: {
                              ...prev.sound,
                              channels: {
                                ...prev.sound.channels,
                                [key]: { ...ch, enabled: e.target.checked },
                              },
                            },
                          }))
                        }
                      />
                      <strong>{SOUND_LABELS[key]}</strong>
                    </label>
                    <div className="sound-row__slider">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        disabled={!ch.enabled}
                        value={ch.volume}
                        onChange={(e) =>
                          onUpdateAppSettings((prev) => ({
                            ...prev,
                            sound: {
                              ...prev.sound,
                              channels: {
                                ...prev.sound.channels,
                                [key]: { ...ch, volume: Number(e.target.value) },
                              },
                            },
                          }))
                        }
                      />
                      <span>{ch.volume}%</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn--sm btn--secondary"
                      onClick={() => onTestSound(key)}
                    >
                      <Play size={14} />
                      <span>Preview</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'presets' && (
          <Presets
            embedded
            wheels={wheels}
            activeId={activeWheelId}
            onSelectWheel={onSelectWheel}
            onCreateFromTemplate={onCreateFromTemplate}
            onDuplicateWheel={onDuplicateWheel}
            onRenameWheel={onRenameWheel}
            onDeleteWheel={onDeleteWheel}
            onImportWheels={onImportWheels}
          />
        )}
      </div>

      <ConfirmDialog
        open={pendingPartitionTarget !== null}
        title="Reduce Number of Partitions?"
        message={`Changing from ${wheel.segments.length} to ${pendingPartitionTarget ?? 0} partitions will remove the last ${wheel.segments.length - (pendingPartitionTarget ?? 0)} partition(s).`}
        confirmLabel="Remove Partitions"
        onConfirm={() => {
          if (pendingPartitionTarget !== null) applyPartitionCount(pendingPartitionTarget);
          setPendingPartitionTarget(null);
        }}
        onCancel={() => setPendingPartitionTarget(null)}
      />
    </div>
  );
};

