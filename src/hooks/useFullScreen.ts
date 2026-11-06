import { useCallback, useEffect, useState } from 'react';

type FullscreenDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FullscreenEl = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function currentElement(): Element | null {
  const doc = document as FullscreenDoc;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export function useFullScreen() {
  const [isFullScreen, setIsFullScreen] = useState<boolean>(() => Boolean(currentElement()));

  useEffect(() => {
    const sync = () => setIsFullScreen(Boolean(currentElement()));
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync as EventListener);
    window.addEventListener('resize', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync as EventListener);
      window.removeEventListener('resize', sync);
    };
  }, []);

  const enter = useCallback(async (el?: HTMLElement | null) => {
    const target = (el ?? document.documentElement) as FullscreenEl;
    try {
      if (target.requestFullscreen) await target.requestFullscreen();
      else if (target.webkitRequestFullscreen) await target.webkitRequestFullscreen();
      else setIsFullScreen(true); // CSS fallback if Fullscreen API is blocked
    } catch {
      setIsFullScreen(true);
    }
  }, []);

  const exit = useCallback(async () => {
    const doc = document as FullscreenDoc;
    try {
      if (currentElement()) {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
      }
    } catch {
      /* ignore */
    }
    setIsFullScreen(false);
  }, []);

  const toggle = useCallback(
    async (el?: HTMLElement | null) => {
      if (isFullScreen || currentElement()) await exit();
      else await enter(el);
    },
    [isFullScreen, enter, exit],
  );

  return { isFullScreen, enter, exit, toggle };
}

