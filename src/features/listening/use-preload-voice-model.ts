import { useEffect } from 'react';

import { preloadVoiceModel } from '@/data/speech';

/** How long after the screen appears the model starts loading: its first frames come first. */
const PRELOAD_DELAY_MS = 1500;

let asked = false;

/**
 * Loads the voice model shortly after a screen from which the person can listen appears, the
 * first time in this session (D49): the listening then starts without waiting for the model.
 * Once per session; nothing on a build without the voice.
 */
export function usePreloadVoiceModel(preload: () => Promise<void> = preloadVoiceModel): void {
  useEffect(() => {
    if (asked) return;
    const timer = setTimeout(() => {
      if (asked) return;
      asked = true;
      void preload();
    }, PRELOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [preload]);
}
