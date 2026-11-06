import { useEffect, useState } from 'react';
import { getCachedImage, loadImage, subscribeImages } from '../services/imageCache';

/** Returns a decoded object URL for an image id stored in IndexedDB. */
export function useImageUrl(imageId: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => getCachedImage(imageId)?.url ?? null);

  useEffect(() => {
    if (!imageId) {
      setUrl(null);
      return;
    }
    const cached = getCachedImage(imageId);
    if (cached) {
      setUrl(cached.url);
      return;
    }
    let alive = true;
    void loadImage(imageId).then((entry) => {
      if (alive) setUrl(entry?.url ?? null);
    });
    const unsub = subscribeImages(() => {
      if (!alive) return;
      const hit = getCachedImage(imageId);
      if (hit) setUrl(hit.url);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [imageId]);

  return url;
}

