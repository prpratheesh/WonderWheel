/**
 * Central state manager for ClassSpin:
 *  - Active wheel & saved presets (IndexedDB)
 *  - Unsaved settings draft with Preview mode (IndexedDB)
 *  - App-level sound & performance settings (IndexedDB)
 *  - Lightweight UI preferences (localStorage)
 *  - Session winner exclusions & spin history
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createWheel,
  defaultAppSettings,
  defaultPrefs,
  TEMPLATES,
  wheelFromTemplate,
} from '../services/defaults';
import { preloadImages } from '../services/imageCache';
import { collectGarbage } from '../services/imageStorage';
import { referencedImageIds } from '../services/exportImport';
import {
  deleteWheelRecord,
  loadAppSettings,
  loadDraft,
  loadPrefs,
  loadSlowDeviceFlag,
  loadWheels,
  replaceAllWheels,
  saveAppSettings,
  saveDraft,
  savePrefs,
  saveSlowDeviceFlag,
  saveWheel,
} from '../services/persistence';
import { requestPersistentStorage } from '../services/db';
import type { AppSettings, Prefs } from '../types/settings';
import type { ResultSettings, WheelConfig } from '../types/wheel';
import { debounce, deepClone, uid } from '../utils/misc';

import { decompressWheelFromShare } from '../services/shareService';

export type PageRoute = 'wheel' | 'settings' | 'presets';

export interface SpinHistoryItem {
  id: string;
  segmentId: string;
  title: string;
  subtitle: string;
  bgColor: string;
  imageId: string | null;
  time: number;
}

function readRouteFromHash(): PageRoute {
  const h = window.location.hash.replace(/^#\/?/, '');
  if (h === 'settings' || h === 'presets') return h;
  return 'wheel';
}

export function useAppStore() {
  const [ready, setReady] = useState(false);
  const [route, setRouteState] = useState<PageRoute>(readRouteFromHash);
  const [wheels, setWheels] = useState<WheelConfig[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  /** Working draft while editing in Settings (also used in Preview mode). */
  const [draft, setDraftState] = useState<WheelConfig | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [previewingDraft, setPreviewingDraft] = useState(false);

  const [appSettings, setAppSettingsState] = useState<AppSettings>(defaultAppSettings);
  const [prefs, setPrefsState] = useState<Prefs>(defaultPrefs);
  const [slowDevice, setSlowDevice] = useState<boolean>(loadSlowDeviceFlag);
  const [osReducedMotion, setOsReducedMotion] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  const [excludedIds, setExcludedIds] = useState<Set<string>>(() => new Set());
  const [sessionRound, setSessionRound] = useState<number>(1);
  const [history, setHistory] = useState<SpinHistoryItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  // Sync hash navigation
  useEffect(() => {
    const onHash = () => setRouteState(readRouteFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((next: PageRoute) => {
    const targetHash = next === 'wheel' ? '#/' : `#/${next}`;
    if (window.location.hash !== targetHash) window.location.hash = targetHash;
    setRouteState(next);
  }, []);

  // OS reduced-motion listener
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setOsReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Initial load from IndexedDB + localStorage
  useEffect(() => {
    let mounted = true;
    void (async () => {
      void requestPersistentStorage();
      const loadedPrefs = loadPrefs();
      const [loadedWheels, loadedSettings, savedDraft] = await Promise.all([
        loadWheels(),
        loadAppSettings(),
        loadDraft(),
      ]);

      let list = loadedWheels;
      if (list.length === 0) {
        // Seed starter classroom wheels on first launch
        list = TEMPLATES.filter((t) => t.key !== 'blank').map((t) =>
          createWheel(t.name, t.items, t.themeId),
        );
        for (const w of list) await saveWheel(w);
      }

      // Check if opened via a share link (#/share?wheel=...)
      let sharedWheel: WheelConfig | null = null;
      if (window.location.hash.includes('share?wheel=')) {
        try {
          const match = window.location.hash.match(/wheel=([^&]+)/);
          if (match && match[1]) {
            sharedWheel = await decompressWheelFromShare(decodeURIComponent(match[1]));
            if (sharedWheel) {
              await saveWheel(sharedWheel);
              list = [sharedWheel, ...list];
              loadedPrefs.lastWheelId = sharedWheel.id;
              savePrefs(loadedPrefs);
              // Clean up the hash to clean URL
              window.location.hash = '#/';
            }
          }
        } catch {
          // invalid share URL, proceed normally
        }
      }

      const initialWheel =
        sharedWheel ??
        list.find((w) => w.id === loadedPrefs.lastWheelId) ?? list[0];

      if (!mounted) return;
      setPrefsState(loadedPrefs);
      setAppSettingsState(loadedSettings);
      setWheels(list);
      setActiveId(initialWheel.id);
      if (sharedWheel) {
        setDraftState(deepClone(sharedWheel));
        setIsDirty(false);
        showToast(`Loaded shared wheel: "${sharedWheel.name}"!`);
      } else if (savedDraft && list.some((w) => w.id === savedDraft.id)) {
        setDraftState(savedDraft);
        setIsDirty(true);
      } else {
        setDraftState(deepClone(initialWheel));
        setIsDirty(false);
        void saveDraft(null);
      }
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const savedWheel = useMemo(
    () => wheels.find((w) => w.id === activeId) ?? wheels[0] ?? null,
    [wheels, activeId],
  );

  /** Wheel currently shown on the main stage (draft when previewing, saved otherwise). */
  const displayedWheel = useMemo<WheelConfig | null>(() => {
    if ((route === 'settings' || previewingDraft) && draft) return draft;
    return savedWheel;
  }, [route, previewingDraft, draft, savedWheel]);

  // Preload all images referenced by the displayed wheel
  useEffect(() => {
    if (!displayedWheel) return;
    const ids = displayedWheel.segments.map((s) => s.imageId);
    if (displayedWheel.design.background.imageId) ids.push(displayedWheel.design.background.imageId);
    void preloadImages(ids);
  }, [displayedWheel]);

  const persistDraftDebounced = useMemo(
    () => debounce((d: WheelConfig | null) => void saveDraft(d), 250),
    [],
  );

  const updateDraft = useCallback(
    (updater: (prev: WheelConfig) => WheelConfig) => {
      setDraftState((prev) => {
        const base = prev ?? (savedWheel ? deepClone(savedWheel) : null);
        if (!base) return null;
        const next = { ...updater(deepClone(base)), updatedAt: Date.now() };
        persistDraftDebounced(next);
        return next;
      });
      setIsDirty(true);
    },
    [persistDraftDebounced, savedWheel],
  );

  /** Immediate mutation on the active wheel from the main screen (e.g. quick edit). */
  const commitWheel = useCallback(async (next: WheelConfig) => {
    const stamped = { ...deepClone(next), updatedAt: Date.now() };
    await saveWheel(stamped);
    await saveDraft(null);
    setWheels((list) => list.map((w) => (w.id === stamped.id ? stamped : w)));
    setDraftState(deepClone(stamped));
    setIsDirty(false);
    setPreviewingDraft(false);
  }, []);

  const saveDraftToWheel = useCallback(async () => {
    if (!draft) return;
    await commitWheel(draft);
    showToast('Settings saved!');
  }, [commitWheel, draft, showToast]);

  const discardDraft = useCallback(() => {
    if (!savedWheel) return;
    persistDraftDebounced.cancel();
    void saveDraft(null);
    setDraftState(deepClone(savedWheel));
    setIsDirty(false);
    setPreviewingDraft(false);
    showToast('Unsaved changes discarded');
  }, [persistDraftDebounced, savedWheel, showToast]);

  const resetCurrentToDefault = useCallback(() => {
    if (!draft) return;
    const fresh = wheelFromTemplate('students');
    fresh.id = draft.id;
    fresh.name = draft.name;
    fresh.createdAt = draft.createdAt;
    setDraftState(fresh);
    setIsDirty(true);
    persistDraftDebounced(fresh);
    showToast('Wheel reset to defaults (click Save to keep)');
  }, [draft, persistDraftDebounced, showToast]);

  const updatePrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  const updateAppSettings = useCallback((updater: (prev: AppSettings) => AppSettings) => {
    setAppSettingsState((prev) => {
      const next = updater(deepClone(prev));
      void saveAppSettings(next);
      return next;
    });
  }, []);

  const selectWheel = useCallback(
    (id: string) => {
      const found = wheels.find((w) => w.id === id);
      if (!found) return;
      persistDraftDebounced.cancel();
      void saveDraft(null);
      setActiveId(found.id);
      setDraftState(deepClone(found));
      setIsDirty(false);
      setPreviewingDraft(false);
      setExcludedIds(new Set());
      setSessionRound(1);
      setHistory([]);
      updatePrefs({ lastWheelId: found.id });
    },
    [persistDraftDebounced, updatePrefs, wheels],
  );

  const createFromTemplate = useCallback(
    async (templateKey: string, customName?: string) => {
      const w = wheelFromTemplate(templateKey);
      if (customName?.trim()) w.name = customName.trim();
      await saveWheel(w);
      setWheels((prev) => [...prev, w]);
      setActiveId(w.id);
      setDraftState(deepClone(w));
      setIsDirty(false);
      setPreviewingDraft(false);
      setExcludedIds(new Set());
      setSessionRound(1);
      setHistory([]);
      updatePrefs({ lastWheelId: w.id });
      showToast(`Created "${w.name}"`);
      return w;
    },
    [showToast, updatePrefs],
  );

  const duplicateWheel = useCallback(
    async (id: string) => {
      const src = wheels.find((w) => w.id === id);
      if (!src) return;
      const copy = deepClone(src);
      copy.id = uid('w_');
      copy.name = `${src.name} (Copy)`;
      copy.createdAt = Date.now();
      copy.updatedAt = Date.now();
      copy.segments.forEach((s) => (s.id = uid('s_')));
      await saveWheel(copy);
      setWheels((prev) => [...prev, copy]);
      showToast(`Duplicated "${src.name}"`);
    },
    [showToast, wheels],
  );

  const renameWheel = useCallback(
    async (id: string, name: string) => {
      const trimmed = name.trim().slice(0, 80);
      if (!trimmed) return;
      const target = wheels.find((w) => w.id === id);
      if (!target) return;
      const updated = { ...target, name: trimmed, updatedAt: Date.now() };
      await saveWheel(updated);
      setWheels((prev) => prev.map((w) => (w.id === id ? updated : w)));
      if (draft?.id === id) setDraftState((d) => (d ? { ...d, name: trimmed } : d));
    },
    [draft?.id, wheels],
  );

  const deleteWheel = useCallback(
    async (id: string) => {
      if (wheels.length <= 1) {
        showToast('Keep at least one wheel');
        return;
      }
      await deleteWheelRecord(id);
      const remaining = wheels.filter((w) => w.id !== id);
      setWheels(remaining);
      if (activeId === id) {
        const next = remaining[0];
        setActiveId(next.id);
        setDraftState(deepClone(next));
        setIsDirty(false);
        setPreviewingDraft(false);
        updatePrefs({ lastWheelId: next.id });
      }
      void collectGarbage(referencedImageIds(remaining));
      showToast('Wheel deleted');
    },
    [activeId, showToast, updatePrefs, wheels],
  );

  const addImportedWheels = useCallback(
    async (imported: WheelConfig[], replaceExisting: boolean) => {
      if (replaceExisting) {
        await replaceAllWheels(imported);
        setWheels(imported);
        const first = imported[0];
        setActiveId(first.id);
        setDraftState(deepClone(first));
        setIsDirty(false);
        setPreviewingDraft(false);
        updatePrefs({ lastWheelId: first.id });
        void collectGarbage(referencedImageIds(imported));
      } else {
        for (const w of imported) await saveWheel(w);
        setWheels((prev) => {
          const next = [...prev, ...imported];
          return next;
        });
        const first = imported[0];
        setActiveId(first.id);
        setDraftState(deepClone(first));
        setIsDirty(false);
        setPreviewingDraft(false);
        updatePrefs({ lastWheelId: first.id });
      }
      showToast(`Imported ${imported.length} wheel${imported.length > 1 ? 's' : ''}!`);
    },
    [showToast, updatePrefs],
  );

  const recordWin = useCallback((seg: { id: string; title: string; subtitle: string; bgColor: string; imageId: string | null }, exclude: boolean) => {
    setHistory((prev) => [
      {
        id: uid('h_'),
        segmentId: seg.id,
        title: seg.title,
        subtitle: seg.subtitle,
        bgColor: seg.bgColor,
        imageId: seg.imageId,
        time: Date.now(),
      },
      ...prev.slice(0, 29),
    ]);
    if (exclude) {
      setExcludedIds((prev) => {
        const next = new Set(prev);
        next.add(seg.id);
        return next;
      });
    }
  }, []);

  const excludeSegment = useCallback((segmentId: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      next.add(segmentId);
      return next;
    });
  }, []);

  const resetExclusions = useCallback(() => {
    setExcludedIds(new Set());
    setSessionRound(1);
    showToast('Session reset — all options restored');
  }, [showToast]);

  const startNextSession = useCallback(() => {
    setExcludedIds(new Set());
    setSessionRound((prev) => {
      const next = prev + 1;
      showToast(`Starting Session ${next} — all options restored!`);
      return next;
    });
  }, [showToast]);

  const updateWheelResultSettings = useCallback(
    async (patch: Partial<ResultSettings>) => {
      const current = displayedWheel;
      if (!current) return;
      const updated: WheelConfig = {
        ...deepClone(current),
        updatedAt: Date.now(),
        result: {
          ...current.result,
          ...patch,
        },
      };
      if (previewingDraft) {
        setDraftState(updated);
        persistDraftDebounced(updated);
      } else {
        await saveWheel(updated);
        setWheels((list) => list.map((w) => (w.id === updated.id ? updated : w)));
        setDraftState(deepClone(updated));
      }
    },
    [displayedWheel, persistDraftDebounced, previewingDraft],
  );

  const clearHistory = useCallback(() => setHistory([]), []);

  const markSlowDevice = useCallback(() => {
    if (!slowDevice) {
      setSlowDevice(true);
      saveSlowDeviceFlag(true);
    }
  }, [slowDevice]);

  const effectiveReducedMotion =
    appSettings.reducedMotion === 'on' ||
    (appSettings.reducedMotion === 'auto' && osReducedMotion);

  const effectivePerformanceMode =
    appSettings.performanceMode === 'on' ||
    (appSettings.performanceMode === 'auto' && slowDevice);

  return {
    ready,
    route,
    navigate,
    wheels,
    activeId,
    savedWheel,
    displayedWheel,
    draft,
    isDirty,
    previewingDraft,
    setPreviewingDraft,
    updateDraft,
    commitWheel,
    saveDraftToWheel,
    discardDraft,
    resetCurrentToDefault,
    selectWheel,
    createFromTemplate,
    duplicateWheel,
    renameWheel,
    deleteWheel,
    addImportedWheels,
    appSettings,
    updateAppSettings,
    prefs,
    updatePrefs,
    effectiveReducedMotion,
    effectivePerformanceMode,
    markSlowDevice,
    excludedIds,
    sessionRound,
    excludeSegment,
    resetExclusions,
    startNextSession,
    updateWheelResultSettings,
    history,
    recordWin,
    clearHistory,
    toast,
    showToast,
  };
}

export type AppStore = ReturnType<typeof useAppStore>;

