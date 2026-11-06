import { useCallback, useEffect } from 'react';
import { sound } from '../services/soundEngine';
import type { SoundKey, SoundSettings } from '../types/settings';

export function useSound(settings: SoundSettings, muted: boolean) {
  useEffect(() => {
    sound.configure(settings, muted);
  }, [settings, muted]);

  useEffect(() => {
    const unlock = () => sound.unlock();
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const playClick = useCallback(() => {
    sound.unlock();
    sound.click();
  }, []);

  const testSound = useCallback((key: SoundKey) => {
    sound.test(key);
  }, []);

  return { playClick, testSound };
}

