import * as Font from 'expo-font';
import { useEffect, useState } from 'react';

import { appFonts, fontFamily } from '@/ui';

export type QuranFontStatus = 'loading' | 'ready' | 'failed';

/**
 * Whether the Quran font can be used. The root layout lets the app start without it, because the
 * interface uses the system fonts; the reader never shows Quran text in another font (spec,
 * "Exigence absolue"). When the font is missing it is asked for once more; if that fails too,
 * the reader says so instead of falling back.
 */
export function useQuranFont(): QuranFontStatus {
  const [status, setStatus] = useState<QuranFontStatus>(() =>
    Font.isLoaded(fontFamily.quran) ? 'ready' : 'loading',
  );
  useEffect(() => {
    if (status !== 'loading') return;
    let isCurrent = true;
    Font.loadAsync({ [fontFamily.quran]: appFonts.KFGQPCHafsUthmanic }).then(
      () => {
        if (isCurrent) setStatus(Font.isLoaded(fontFamily.quran) ? 'ready' : 'failed');
      },
      (error: unknown) => {
        console.error('The Quran font could not be loaded.', error);
        if (isCurrent) setStatus('failed');
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [status]);
  return status;
}
