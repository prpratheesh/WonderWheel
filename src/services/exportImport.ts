/**
 * JSON export / import. Images are embedded as data URLs so a backup file is
 * fully self-contained and can be restored on any computer.
 */
import type { WheelConfig } from '../types/wheel';
import { normalizeWheel } from './defaults';
import { blobToDataUrl, dataUrlToBlob, getStoredImage, putStoredImage, type StoredImage } from './imageStorage';
import { uid } from '../utils/misc';

export const EXPORT_FORMAT = 'classspin-backup';
export const EXPORT_VERSION = 1;

export interface ExportedImage {
  id: string;
  name: string;
  width: number;
  height: number;
  dataUrl: string;
}

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  app: 'ClassSpin';
  wheels: WheelConfig[];
  images: ExportedImage[];
}

export function referencedImageIds(wheels: readonly WheelConfig[]): Set<string> {
  const ids = new Set<string>();
  for (const w of wheels) {
    for (const s of w.segments) if (s.imageId) ids.add(s.imageId);
    if (w.design.background.imageId) ids.add(w.design.background.imageId);
  }
  return ids;
}

export async function buildExport(wheels: readonly WheelConfig[]): Promise<ExportFile> {
  const images: ExportedImage[] = [];
  for (const id of referencedImageIds(wheels)) {
    const rec = await getStoredImage(id);
    if (!rec) continue;
    images.push({ id, name: rec.name, width: rec.width, height: rec.height, dataUrl: await blobToDataUrl(rec.blob) });
  }
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'ClassSpin',
    wheels: wheels.map((w) => JSON.parse(JSON.stringify(w)) as WheelConfig),
    images,
  };
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function safeFileName(name: string): string {
  return name.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-').toLowerCase() || 'wheel';
}

export const MAX_IMPORT_BYTES = 200 * 1024 * 1024;

/**
 * Parse and store an import file. Images are written to IndexedDB under fresh
 * ids. When `freshIds` is true the wheels also get new ids (so importing
 * never overwrites existing wheels).
 */
export async function importFile(file: File, freshIds: boolean): Promise<WheelConfig[]> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('This file is too large to import.');
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('This file is not a valid ClassSpin backup (invalid JSON).');
  }
  const d = data as Partial<ExportFile> & { segments?: unknown };
  // Accept a bare single wheel too.
  const rawWheels: unknown[] = Array.isArray(d.wheels) ? d.wheels : Array.isArray(d.segments) ? [data] : [];
  if (!rawWheels.length) throw new Error('No wheels were found in this file.');

  const idMap = new Map<string, string>();
  for (const img of Array.isArray(d.images) ? d.images : []) {
    if (!img || typeof img.id !== 'string' || typeof img.dataUrl !== 'string') continue;
    try {
      const blob = await dataUrlToBlob(img.dataUrl);
      const rec: StoredImage = {
        id: uid('img_'),
        blob,
        type: blob.type,
        width: Number(img.width) || 0,
        height: Number(img.height) || 0,
        name: String(img.name ?? 'image'),
        createdAt: Date.now(),
      };
      await putStoredImage(rec);
      idMap.set(img.id, rec.id);
    } catch {
      /* skip broken images */
    }
  }

  const wheels: WheelConfig[] = [];
  for (const raw of rawWheels) {
    const w = normalizeWheel(raw);
    if (!w) continue;
    if (freshIds) {
      w.id = uid('w_');
      w.segments.forEach((s) => (s.id = uid('s_')));
    }
    w.segments.forEach((s) => (s.imageId = s.imageId ? idMap.get(s.imageId) ?? null : null));
    const bg = w.design.background.imageId;
    w.design.background.imageId = bg ? idMap.get(bg) ?? null : null;
    if (!w.design.background.imageId && w.design.background.type === 'image') w.design.background.type = 'theme';
    wheels.push(w);
  }
  if (!wheels.length) throw new Error('No valid wheels were found in this file.');
  return wheels;
}

