import { describe, it, expect } from 'vitest';
import { pickWeighted, shuffle } from '../src/services/randomSelection';

describe('randomSelection', () => {
  it('never picks items with weight <= 0', () => {
    const items = [
      { id: '1', weight: 0 },
      { id: '2', weight: 10 },
      { id: '3', weight: 0 },
    ];

    for (let i = 0; i < 50; i++) {
      const picked = pickWeighted(items, (x) => x.weight);
      expect(picked?.id).toBe('2');
    }
  });

  it('respects weighted probabilities proportionally', () => {
    const items = [
      { id: 'A', weight: 1 },
      { id: 'B', weight: 3 },
    ];
    let countA = 0;
    let countB = 0;
    const trials = 1000;

    for (let i = 0; i < trials; i++) {
      const picked = pickWeighted(items, (x) => x.weight);
      if (picked?.id === 'A') countA++;
      if (picked?.id === 'B') countB++;
    }

    expect(countA + countB).toBe(trials);
    // B should be selected ~3x as often as A (allow statistical tolerance)
    const ratio = countB / countA;
    expect(ratio).toBeGreaterThan(1.8);
    expect(ratio).toBeLessThan(4.5);
  });

  it('shuffles arrays without losing or duplicating elements', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = shuffle(input);
    expect(shuffled.length).toBe(input.length);
    expect(shuffled.slice().sort()).toEqual(input.slice().sort());
  });
});

