import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Shuffle,
  Sparkles,
  Trash2,
  ListPlus,
} from 'lucide-react';
import { newSegmentFor } from '../../services/defaults';
import { shuffle } from '../../services/randomSelection';
import { getTheme } from '../../services/themes';
import {
  SEGMENT_LAYOUT_LABELS,
  type FontWeight,
  type ImageFit,
  type ImagePosition,
  type Segment,
  type SegmentLayout,
  type TextAlign,
} from '../../types/segment';
import { CROWDED_SEGMENTS, MAX_SEGMENTS, MIN_SEGMENTS, type WheelConfig } from '../../types/wheel';
import { contrastText, distributeColors } from '../../utils/colors';
import { uid } from '../../utils/misc';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import { ImageUploader } from '../ImageUploader/ImageUploader';

interface SegmentEditorProps {
  wheel: WheelConfig;
  onChange: (updater: (prev: WheelConfig) => WheelConfig) => void;
  imagesOnlyView?: boolean;
}

export const SegmentEditor: React.FC<SegmentEditorProps> = ({
  wheel,
  onChange,
  imagesOnlyView = false,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(
    wheel.segments[0]?.id ?? null,
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const segments = wheel.segments;
  const palette = getTheme(wheel.design.themeId).palette;

  const updateSegment = (id: string, patch: Partial<Segment>) => {
    onChange((prev) => ({
      ...prev,
      segments: prev.segments.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const addSegment = () => {
    if (segments.length >= MAX_SEGMENTS) return;
    onChange((prev) => {
      const seg = newSegmentFor(prev);
      setExpandedId(seg.id);
      return { ...prev, segments: [...prev.segments, seg] };
    });
  };

  const duplicateSegment = (id: string) => {
    if (segments.length >= MAX_SEGMENTS) return;
    onChange((prev) => {
      const idx = prev.segments.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const copy: Segment = {
        ...prev.segments[idx],
        id: uid('s_'),
        title: `${prev.segments[idx].title} (Copy)`.slice(0, 120),
      };
      const next = [...prev.segments];
      next.splice(idx + 1, 0, copy);
      setExpandedId(copy.id);
      return { ...prev, segments: next };
    });
  };

  const moveSegment = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= segments.length) return;
    onChange((prev) => {
      const next = [...prev.segments];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return { ...prev, segments: next };
    });
  };

  const confirmRemoveSegment = () => {
    if (!confirmDeleteId || segments.length <= MIN_SEGMENTS) {
      setConfirmDeleteId(null);
      return;
    }
    const idToDelete = confirmDeleteId;
    setConfirmDeleteId(null);
    onChange((prev) => ({
      ...prev,
      segments: prev.segments.filter((s) => s.id !== idToDelete),
    }));
  };

  const recolorAll = () => {
    onChange((prev) => {
      const cols = distributeColors(prev.segments.length, palette);
      return {
        ...prev,
        segments: prev.segments.map((s, i) => ({
          ...s,
          bgColor: cols[i],
          textColor: contrastText(cols[i]),
        })),
      };
    });
  };

  const shuffleOrder = () => {
    onChange((prev) => ({
      ...prev,
      segments: shuffle(prev.segments),
    }));
  };

  const applyBulkAdd = () => {
    const lines = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return;
    onChange((prev) => {
      const slots = Math.max(0, MAX_SEGMENTS - prev.segments.length);
      const toAdd = lines.slice(0, slots);
      let working = { ...prev, segments: [...prev.segments] };
      for (const line of toAdd) {
        const seg = newSegmentFor(working, { title: line.slice(0, 120) });
        working.segments.push(seg);
      }
      return working;
    });
    setBulkText('');
    setBulkOpen(false);
  };

  const applyImageLayoutAll = (layout: SegmentLayout, fit: ImageFit) => {
    onChange((prev) => ({
      ...prev,
      segments: prev.segments.map((s) =>
        s.imageId ? { ...s, layout, imageFit: fit } : s,
      ),
    }));
  };

  if (imagesOnlyView) {
    return (
      <div className="settings-section">
        <div className="section-header">
          <div>
            <h2>Segment Images & Layouts</h2>
            <p className="muted">
              Upload a picture for any partition (JPG, PNG, WebP, SVG). Images are saved locally in IndexedDB and remain available offline and after refreshing.
            </p>
          </div>
          <div className="toolbar-row">
            <button
              type="button"
              className="btn btn--sm btn--secondary"
              onClick={() => applyImageLayoutAll('imageAbove', 'contain')}
            >
              All: Image Above Text
            </button>
            <button
              type="button"
              className="btn btn--sm btn--secondary"
              onClick={() => applyImageLayoutAll('icon', 'contain')}
            >
              All: Icon + Text
            </button>
            <button
              type="button"
              className="btn btn--sm btn--secondary"
              onClick={() => applyImageLayoutAll('image', 'cover')}
            >
              All: Image Only (Cover)
            </button>
          </div>
        </div>

        <div className="image-grid">
          {segments.map((seg, idx) => (
            <div key={seg.id} className="image-grid__card">
              <div className="image-grid__card-top">
                <span
                  className="color-dot"
                  style={{ background: seg.bgColor }}
                />
                <strong>
                  #{idx + 1} {seg.title || 'Untitled'}
                </strong>
              </div>
              <ImageUploader
                imageId={seg.imageId}
                onChange={(imageId) =>
                  updateSegment(seg.id, {
                    imageId,
                    layout:
                      imageId && seg.layout === 'text' ? 'imageAbove' : seg.layout,
                  })
                }
              />
              <div className="form-grid form-grid--2">
                <label className="field">
                  <span>Layout</span>
                  <select
                    value={seg.layout}
                    onChange={(e) =>
                      updateSegment(seg.id, {
                        layout: e.target.value as SegmentLayout,
                      })
                    }
                  >
                    {(Object.keys(SEGMENT_LAYOUT_LABELS) as SegmentLayout[]).map(
                      (k) => (
                        <option key={k} value={k}>
                          {SEGMENT_LAYOUT_LABELS[k]}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="field">
                  <span>Display Mode</span>
                  <select
                    value={seg.imageFit}
                    onChange={(e) =>
                      updateSegment(seg.id, {
                        imageFit: e.target.value as ImageFit,
                      })
                    }
                  >
                    <option value="contain">Contain (Full image)</option>
                    <option value="cover">Cover (Rounded crop)</option>
                  </select>
                </label>
                <label className="field">
                  <span>Image Size ({seg.imageSize}%)</span>
                  <input
                    type="range"
                    min={30}
                    max={100}
                    value={seg.imageSize}
                    onChange={(e) =>
                      updateSegment(seg.id, {
                        imageSize: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>Position</span>
                  <select
                    value={seg.imagePosition}
                    onChange={(e) =>
                      updateSegment(seg.id, {
                        imagePosition: e.target.value as ImagePosition,
                      })
                    }
                  >
                    <option value="inner">Inner (Towards hub)</option>
                    <option value="center">Center</option>
                    <option value="outer">Outer (Towards rim)</option>
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="settings-section">
      <div className="section-header">
        <div>
          <h2>
            Partitions ({segments.length} / {MAX_SEGMENTS})
          </h2>
          <p className="muted">
            Customize each partition’s text, colours, image, layout and probability weight.
          </p>
        </div>
        <div className="toolbar-row">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={addSegment}
            disabled={segments.length >= MAX_SEGMENTS}
          >
            <Plus size={16} />
            <span>Add Partition</span>
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => setBulkOpen((v) => !v)}
          >
            <ListPlus size={16} />
            <span>Bulk Add Names</span>
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={recolorAll}
            title="Redistribute theme colours evenly"
          >
            <Sparkles size={16} />
            <span>Auto-Colour</span>
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={shuffleOrder}
            title="Shuffle partition order"
          >
            <Shuffle size={16} />
            <span>Shuffle</span>
          </button>
        </div>
      </div>

      {segments.length >= CROWDED_SEGMENTS && (
        <div className="callout callout--warn">
          <strong>Crowded wheel notice ({segments.length} partitions):</strong> Text size is automatically scaled down and subtitles are hidden where needed so labels never overlap.
        </div>
      )}

      {bulkOpen && (
        <div className="bulk-box">
          <label className="field">
            <span>Paste one student name or question per line (up to {MAX_SEGMENTS} total):</span>
            <textarea
              rows={4}
              placeholder="Aarav&#10;Diya&#10;Kabir&#10;Meera"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
          </label>
          <div className="toolbar-row">
            <button type="button" className="btn btn--primary btn--sm" onClick={applyBulkAdd}>
              Add Lines
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setBulkOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="segment-list">
        {segments.map((seg, index) => {
          const isOpen = expandedId === seg.id;
          return (
            <div
              key={seg.id}
              className={`segment-item ${!seg.visible ? 'is-hidden' : ''} ${!seg.enabled ? 'is-disabled' : ''}`}
            >
              <div className="segment-item__summary">
                <span className="segment-item__num">#{index + 1}</span>
                <input
                  type="color"
                  className="color-swatch"
                  value={seg.bgColor}
                  onChange={(e) => {
                    const bgColor = e.target.value;
                    updateSegment(seg.id, {
                      bgColor,
                      textColor: contrastText(bgColor),
                    });
                  }}
                  title="Partition background colour"
                />
                <input
                  type="text"
                  className="segment-item__title-input"
                  value={seg.title}
                  placeholder="Partition title…"
                  onChange={(e) => updateSegment(seg.id, { title: e.target.value })}
                />
                <div className="segment-item__quick">
                  <button
                    type="button"
                    className={`chip-toggle ${seg.enabled ? 'is-on' : ''}`}
                    onClick={() => updateSegment(seg.id, { enabled: !seg.enabled })}
                    title={seg.enabled ? 'Enabled (can be picked)' : 'Disabled (cannot be picked)'}
                  >
                    {seg.enabled ? 'Active' : 'Disabled'}
                  </button>
                  <button
                    type="button"
                    className="icon-action"
                    onClick={() => updateSegment(seg.id, { visible: !seg.visible })}
                    title={seg.visible ? 'Hide from wheel' : 'Show on wheel'}
                    aria-label="Toggle visibility"
                  >
                    {seg.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button
                    type="button"
                    className="icon-action"
                    onClick={() => moveSegment(index, -1)}
                    disabled={index === 0}
                    title="Move up"
                    aria-label="Move partition up"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-action"
                    onClick={() => moveSegment(index, 1)}
                    disabled={index === segments.length - 1}
                    title="Move down"
                    aria-label="Move partition down"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-action"
                    onClick={() => duplicateSegment(seg.id)}
                    disabled={segments.length >= MAX_SEGMENTS}
                    title="Duplicate partition"
                    aria-label="Duplicate partition"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-action icon-action--danger"
                    onClick={() => setConfirmDeleteId(seg.id)}
                    disabled={segments.length <= MIN_SEGMENTS}
                    title={segments.length <= MIN_SEGMENTS ? 'At least 2 partitions required' : 'Delete partition'}
                    aria-label="Delete partition"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-action"
                    onClick={() => setExpandedId(isOpen ? null : seg.id)}
                    title={isOpen ? 'Collapse details' : 'More options'}
                    aria-label="Toggle partition details"
                  >
                    {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="segment-item__details">
                  <div className="form-grid form-grid--3">
                    <label className="field">
                      <span>Subtitle (optional)</span>
                      <input
                        type="text"
                        value={seg.subtitle}
                        placeholder="Short hint or subtitle…"
                        onChange={(e) => updateSegment(seg.id, { subtitle: e.target.value })}
                      />
                    </label>

                    <label className="field">
                      <span>Background Colour</span>
                      <div className="color-field">
                        <input
                          type="color"
                          value={seg.bgColor}
                          onChange={(e) => updateSegment(seg.id, { bgColor: e.target.value })}
                        />
                        <input
                          type="text"
                          value={seg.bgColor}
                          onChange={(e) => updateSegment(seg.id, { bgColor: e.target.value })}
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Text Colour</span>
                      <div className="color-field">
                        <input
                          type="color"
                          value={seg.textColor}
                          onChange={(e) => updateSegment(seg.id, { textColor: e.target.value })}
                        />
                        <button
                          type="button"
                          className="btn btn--sm btn--ghost"
                          onClick={() =>
                            updateSegment(seg.id, { textColor: contrastText(seg.bgColor) })
                          }
                        >
                          Auto Contrast
                        </button>
                      </div>
                    </label>

                    <label className="field">
                      <span>Text Size ({seg.textSize}%)</span>
                      <input
                        type="range"
                        min={50}
                        max={200}
                        value={seg.textSize}
                        onChange={(e) =>
                          updateSegment(seg.id, { textSize: Number(e.target.value) })
                        }
                      />
                    </label>

                    <label className="field">
                      <span>Font Weight</span>
                      <select
                        value={seg.fontWeight}
                        onChange={(e) =>
                          updateSegment(seg.id, {
                            fontWeight: Number(e.target.value) as FontWeight,
                          })
                        }
                      >
                        <option value={500}>Medium (500)</option>
                        <option value={600}>Semi-Bold (600)</option>
                        <option value={700}>Bold (700)</option>
                        <option value={800}>Extra-Bold (800)</option>
                      </select>
                    </label>

                    <label className="field">
                      <span>Text Alignment</span>
                      <select
                        value={seg.textAlign}
                        onChange={(e) =>
                          updateSegment(seg.id, {
                            textAlign: e.target.value as TextAlign,
                          })
                        }
                      >
                        <option value="inner">Inner (Near hub)</option>
                        <option value="center">Center</option>
                        <option value="outer">Outer (Near rim)</option>
                      </select>
                    </label>

                    <label className="field">
                      <span>Image-to-Text Layout</span>
                      <select
                        value={seg.layout}
                        onChange={(e) =>
                          updateSegment(seg.id, {
                            layout: e.target.value as SegmentLayout,
                          })
                        }
                      >
                        {(Object.keys(SEGMENT_LAYOUT_LABELS) as SegmentLayout[]).map((k) => (
                          <option key={k} value={k}>
                            {SEGMENT_LAYOUT_LABELS[k]}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>Probability Weight ({seg.weight})</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={seg.weight}
                        onChange={(e) =>
                          updateSegment(seg.id, { weight: Number(e.target.value) })
                        }
                      />
                    </label>

                    <div className="field">
                      <span>Partition Image</span>
                      <ImageUploader
                        compact
                        imageId={seg.imageId}
                        onChange={(imageId) =>
                          updateSegment(seg.id, {
                            imageId,
                            layout:
                              imageId && seg.layout === 'text' ? 'imageAbove' : seg.layout,
                          })
                        }
                      />
                    </div>

                    {seg.imageId && (
                      <>
                        <label className="field">
                          <span>Image Size ({seg.imageSize}%)</span>
                          <input
                            type="range"
                            min={30}
                            max={100}
                            value={seg.imageSize}
                            onChange={(e) =>
                              updateSegment(seg.id, { imageSize: Number(e.target.value) })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Image Display Mode</span>
                          <select
                            value={seg.imageFit}
                            onChange={(e) =>
                              updateSegment(seg.id, {
                                imageFit: e.target.value as ImageFit,
                              })
                            }
                          >
                            <option value="contain">Contain</option>
                            <option value="cover">Cover</option>
                          </select>
                        </label>
                        <label className="field">
                          <span>Image Position</span>
                          <select
                            value={seg.imagePosition}
                            onChange={(e) =>
                              updateSegment(seg.id, {
                                imagePosition: e.target.value as ImagePosition,
                              })
                            }
                          >
                            <option value="inner">Inner</option>
                            <option value="center">Center</option>
                            <option value="outer">Outer</option>
                          </select>
                        </label>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        title="Delete Partition?"
        message="Are you sure you want to remove this partition from the wheel?"
        confirmLabel="Delete Partition"
        onConfirm={confirmRemoveSegment}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
};

