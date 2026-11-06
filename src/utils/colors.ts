/** Colour helpers (pure, allocation-light). */

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function parseHex(hex: string): [number, number, number] {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [128, 128, 128];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex(r: number, g: number, b: number): string {
  const c = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function isValidHex(hex: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim());
}

/** Mix colour towards white (amount > 0) or black (amount < 0). */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  const t = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  return toHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${clamp(alpha, 0, 1)})`;
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const DARK_TEXT = '#1f1b3a';
export const LIGHT_TEXT = '#ffffff';

/** Best readable text colour (white or deep navy) for a background. */
export function contrastText(bg: string): string {
  return contrastRatio(bg, LIGHT_TEXT) >= contrastRatio(bg, DARK_TEXT) * 0.72 ? LIGHT_TEXT : DARK_TEXT;
}

/**
 * Distribute palette colours across n segments so that neighbours always
 * differ — including the wrap-around between the last and first segment.
 */
export function distributeColors(n: number, palette: readonly string[]): string[] {
  const p = palette.length;
  if (p === 0) return Array.from({ length: n }, () => '#888888');
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(palette[i % p]);
  if (n > 2 && p > 2 && out[n - 1] === out[0]) {
    // Pick a colour different from both neighbours of the last slot.
    for (let k = 1; k < p; k++) {
      const c = palette[(n - 1 + k) % p];
      if (c !== out[0] && c !== out[n - 2]) {
        out[n - 1] = c;
        break;
      }
    }
  }
  return out;
}

/** Next palette colour for a newly-added segment, avoiding its neighbours. */
export function nextColor(existing: readonly string[], palette: readonly string[]): string {
  const prev = existing[existing.length - 1];
  const first = existing[0];
  const start = existing.length % Math.max(1, palette.length);
  for (let k = 0; k < palette.length; k++) {
    const c = palette[(start + k) % palette.length];
    if (c !== prev && c !== first) return c;
  }
  return palette[start] ?? '#888888';
}

