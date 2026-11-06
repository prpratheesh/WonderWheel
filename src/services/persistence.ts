import type { AppSettings, Prefs } from '../types/settings';
import type { WheelConfig } from '../types/wheel';
import { idb } from './db';
import { defaultPrefs, normalizeAppSettings, normalizeWheel } from './defaults';

/* ---------------- IndexedDB: wheels, settings, draft ---------------- */

export async function loadWheels(): Promise<WheelConfig[]> {
  const raw = await idb.getAll<unknown>('wheels');
  return raw
    .map(normalizeWheel)
    .filter((w): w is WheelConfig => w !== null)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export const saveWheel = (w: WheelConfig) => idb.put('wheels', w);
export const deleteWheelRecord = (id: string) => idb.delete('wheels', id);

export async function replaceAllWheels(wheels: WheelConfig[]): Promise<void> {
  await idb.clear('wheels');
  for (const w of wheels) await idb.put('wheels', w);
}

export async function loadAppSettings(): Promise<AppSettings> {
  return normalizeAppSettings(await idb.get('kv', 'appSettings'));
}
export const saveAppSettings = (s: AppSettings) => idb.put('kv', s, 'appSettings');

export async function loadDraft(): Promise<WheelConfig | null> {
  const raw = await idb.get('kv', 'draft');
  return raw ? normalizeWheel(raw) : null;
}
export const saveDraft = (d: WheelConfig | null) => (d ? idb.put('kv', d, 'draft') : idb.delete('kv', 'draft'));

/* ---------------- localStorage: lightweight preferences ---------------- */

const PREFS_KEY = 'classspin.prefs';

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaultPrefs();
    return { ...defaultPrefs(), ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return defaultPrefs();
  }
}

export function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* storage full / disabled */
  }
}

const PERF_KEY = 'classspin.slowDevice';
export const loadSlowDeviceFlag = (): boolean => {
  try {
    return localStorage.getItem(PERF_KEY) === '1';
  } catch {
    return false;
  }
};
export const saveSlowDeviceFlag = (slow: boolean): void => {
  try {
    localStorage.setItem(PERF_KEY, slow ? '1' : '0');
  } catch {
    /* ignore */
  }
};

