/**
 * Fair random selection.
 * Uses the Web Crypto API (uniform 32-bit values) when available.
 */

export type RandomFn = () => number;

const buf = new Uint32Array(1);

/** Uniform random number in [0, 1). */
export function secureRandom(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(buf);
    return buf[0] / 4294967296;
  }
  return Math.random();
}

/**
 * Weighted pick. Items with weight <= 0 (or non-finite) are never chosen.
 * Returns null when no item is eligible.
 */
export function pickWeighted<T>(items: readonly T[], weightOf: (item: T) => number, rand: RandomFn = secureRandom): T | null {
  let total = 0;
  for (const it of items) {
    const w = weightOf(it);
    if (Number.isFinite(w) && w > 0) total += w;
  }
  if (total <= 0) return null;
  let r = rand() * total;
  let last: T | null = null;
  for (const it of items) {
    const w = weightOf(it);
    if (!(Number.isFinite(w) && w > 0)) continue;
    last = it;
    if (r < w) return it;
    r -= w;
  }
  return last; // floating-point safety net
}

/** Unbiased Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[], rand: RandomFn = secureRandom): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

