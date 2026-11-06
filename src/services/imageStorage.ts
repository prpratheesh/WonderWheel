/**
 * Image storage: validates, downsizes and stores uploads as Blobs in IndexedDB.
 * Every image (including SVG) is rasterised on upload. This keeps memory small,
 * makes drawing on the canvas fast and neutralises any script inside SVG files.
 */
import { idb } from './db';
import { uid } from '../utils/misc';

export interface StoredImage {
  id: string;
  blob: Blob;
  type: string;
  width: number;
  height: number;
  name: string;
  createdAt: number;
}

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
export const ACCEPT_ATTR = '.jpg,.jpeg,.png,.webp,.svg,image/jpeg,image/png,image/webp,image/svg+xml';
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const SEGMENT_IMAGE_MAX_DIM = 640;
export const BACKGROUND_IMAGE_MAX_DIM = 1920;

export class ImageUploadError extends Error {}

function typeOf(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext === 'svg' ? 'image/svg+xml' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : '';
}

function loadElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageUploadError('This image could not be read. Please try a different file.'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new ImageUploadError('Could not process image.'))), type, quality),
  );
}

/** Validate + downscale an uploaded file. Returns the processed blob. */
export async function processUpload(file: File, maxDim: number): Promise<{ blob: Blob; width: number; height: number }> {
  const type = typeOf(file);
  if (!ACCEPTED_TYPES.includes(type)) throw new ImageUploadError('Please choose a JPG, PNG, WebP or SVG image.');
  if (file.size > MAX_UPLOAD_BYTES) throw new ImageUploadError('That image is larger than 10 MB. Please choose a smaller file.');

  const source = type === 'image/svg+xml' ? new Blob([await file.text()], { type: 'image/svg+xml' }) : file;
  const img = await loadElement(source);
  let w = img.naturalWidth || 512;
  let h = img.naturalHeight || 512;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  // Vector images are rendered crisply at the max size.
  const s = type === 'image/svg+xml' ? maxDim / Math.max(w, h) : scale;
  w = Math.max(1, Math.round(w * s));
  h = Math.max(1, Math.round(h * s));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageUploadError('Could not process image.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  let blob = await canvasToBlob(canvas, 'image/webp', 0.9);
  if (blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/png', 1);
  canvas.width = canvas.height = 0; // release memory
  return { blob, width: w, height: h };
}

export async function storeImage(blob: Blob, width: number, height: number, name: string): Promise<StoredImage> {
  const rec: StoredImage = { id: uid('img_'), blob, type: blob.type, width, height, name, createdAt: Date.now() };
  await idb.put('images', rec);
  return rec;
}

export const getStoredImage = (id: string) => idb.get<StoredImage>('images', id);
export const deleteStoredImage = (id: string) => idb.delete('images', id);
export const putStoredImage = (rec: StoredImage) => idb.put('images', rec);

/** Delete images no longer referenced by any wheel. */
export async function collectGarbage(referenced: ReadonlySet<string>): Promise<number> {
  const keys = await idb.keys('images');
  let removed = 0;
  for (const k of keys) {
    if (typeof k === 'string' && !referenced.has(k)) {
      await idb.delete('images', k);
      removed++;
    }
  }
  return removed;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const m = /^data:(image\/(png|jpeg|webp|svg\+xml));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new ImageUploadError('Invalid embedded image.');
  const bin = atob(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}

