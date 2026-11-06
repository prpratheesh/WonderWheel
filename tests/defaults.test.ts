import { describe, it, expect } from 'vitest';
import {
  createWheel,
  normalizeWheel,
  normalizeSegment,
  defaultSegment,
  wheelFromTemplate,
  TEMPLATES,
} from '../src/services/defaults';
import { distributeColors, contrastText } from '../src/utils/colors';

describe('defaults and normalisation', () => {
  it('creates valid starter classroom templates', () => {
    for (const t of TEMPLATES) {
      const w = wheelFromTemplate(t.key);
      expect(w.name).toBe(t.name);
      expect(w.segments.length).toBeGreaterThanOrEqual(2);
      expect(w.design.themeId).toBe(t.themeId);
    }
  });

  it('normalizes partial segment objects with safe bounds', () => {
    const raw = {
      title: 'Maths Question',
      imageSize: 9999, // out of bounds
      weight: -10, // out of bounds
    };
    const s = normalizeSegment(raw);
    expect(s.title).toBe('Maths Question');
    expect(s.imageSize).toBeLessThanOrEqual(100);
    expect(s.weight).toBeGreaterThanOrEqual(0);
  });

  it('ensures at least 2 segments exist on normalisation', () => {
    const raw = {
      name: 'Single Segment Wheel',
      segments: [defaultSegment({ title: 'Only One' })],
    };
    const w = normalizeWheel(raw);
    expect(w).not.toBeNull();
    expect(w!.segments.length).toBeGreaterThanOrEqual(2);
  });

  it('distributes contrasting palette colours so adjacent segments never clash', () => {
    const palette = ['#FF4D6D', '#FF9F1C', '#FFD23F'];
    const colors = distributeColors(5, palette);
    expect(colors.length).toBe(5);
    // Neighbors must not match
    for (let i = 0; i < colors.length - 1; i++) {
      expect(colors[i]).not.toBe(colors[i + 1]);
    }
    // Wrap-around between last and first
    expect(colors[colors.length - 1]).not.toBe(colors[0]);
  });

  it('computes readable text contrast for light and dark backgrounds', () => {
    expect(contrastText('#ffffff')).toBe('#1f1b3a'); // Dark text on white
    expect(contrastText('#000000')).toBe('#ffffff'); // White text on black
    expect(contrastText('#fef08a')).toBe('#1f1b3a'); // Dark text on light yellow
    expect(contrastText('#1e1b4b')).toBe('#ffffff'); // White text on dark navy
  });
});
