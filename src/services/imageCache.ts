/**
 * Decoded image cache shared by the wheel renderer (canvas sources) and the UI
 * (object URLs). Images are decoded once, off the animation path, and reused.
 */
import { getStoredImage } from './imageStorage';

export interface CachedImage {
  source: CanvasImageSource;
  url: string;
  width: number;
  height: number;
}

const cache = new Map<string, CachedImage>();
const pending = new Map<string, Promise<CachedImage | null>>();
const listeners = new Set<() => void>();

async function decode(blob: Blob): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob);
      return { source: bmp, width: bmp.width, height: bmp.height };
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  await img.decode();
  return { source: img, width: img.naturalWidth, height: img.naturalHeight };
}

export function getCachedImage(id: string | null | undefined): CachedImage | undefined {
  return id ? cache.get(id) : undefined;
}

export function loadImage(id: string): Promise<CachedImage | null> {
  const hit = cache.get(id);
  if (hit) return Promise.resolve(hit);
  const p = pending.get(id);
  if (p) return p;
  const promise = (async () => {
    try {
      const rec = await getStoredImage(id);
      if (!rec) return null;
      const d = await decode(rec.blob);
      const entry: CachedImage = { ...d, url: URL.createObjectURL(rec.blob) };
      cache.set(id, entry);
      listeners.forEach((l) => l());
      return entry;
    } catch {
      return null;
    } finally {
      pending.delete(id);
    }
  })();
  pending.set(id, promise);
  return promise;
}

/** Preload (fetch + decode) all given ids. Resolves when every image is ready. */
export async function preloadImages(ids: Iterable<string | null | undefined>): Promise<void> {
  const list = [...new Set([...ids].filter((x): x is string => !!x))].filter((id) => !cache.has(id));
  if (list.length) await Promise.all(list.map(loadImage));
}

export function evictImage(id: string): void {
  const e = cache.get(id);
  if (!e) return;
  URL.revokeObjectURL(e.url);
  if (typeof ImageBitmap !== 'undefined' && e.source instanceof ImageBitmap) e.source.close();
  cache.delete(id);
}

export function subscribeImages(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

