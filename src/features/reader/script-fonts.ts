import * as Font from 'expo-font';
import { useEffect, useState } from 'react';

import type { ReaderScript } from '@/store';
import { fontFamily, simpleScriptFont } from '@/ui';
// The index exports the names of these styles only; listening reads its tokens the same way.
import { quranTextStyles } from '@/ui/tokens';

import { useQuranFont, type QuranFontStatus } from './use-quran-font';

/** The font of the simple (imla'i) script (D41), by its token. */
export const SIMPLE_SCRIPT_FONT_FAMILY = fontFamily.quranSimple;

/** The text style of each script in the scroll, at the default text size. */
export type ScriptTextStyle = (typeof quranTextStyles)['verse' | 'verseSimple'];

/**
 * The Uthmani text takes the token of a verse read on its own (`quranTextStyles.verse`: the King
 * Fahd font, 28 points on a 56-point line, the Title 1 ramp of Dynamic Type); the simple script
 * its own (`quranTextStyles.verseSimple`: Amiri Regular, same line and ramp).
 */
export function scriptTextStyle(script: ReaderScript): ScriptTextStyle {
  return script === 'uthmani' ? quranTextStyles.verse : quranTextStyles.verseSimple;
}

function useSimpleScriptFont(isWanted: boolean): QuranFontStatus {
  const [status, setStatus] = useState<QuranFontStatus>(() =>
    Font.isLoaded(SIMPLE_SCRIPT_FONT_FAMILY) ? 'ready' : 'loading',
  );
  useEffect(() => {
    if (!isWanted || status !== 'loading') return;
    let isCurrent = true;
    Font.loadAsync(simpleScriptFont).then(
      () => {
        if (isCurrent) setStatus(Font.isLoaded(SIMPLE_SCRIPT_FONT_FAMILY) ? 'ready' : 'failed');
      },
      (error: unknown) => {
        console.error('The font of the simple script could not be loaded.', error);
        if (isCurrent) setStatus('failed');
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [isWanted, status]);
  return status;
}

/**
 * Whether the font of the script shown can be used. The Quran text is never drawn in another font
 * (spec, "Exigence absolue"): the screen waits for it, and says so if it cannot be loaded.
 */
export function useScriptFont(script: ReaderScript): QuranFontStatus {
  const uthmani = useQuranFont();
  const simple = useSimpleScriptFont(script === 'imlaei');
  return script === 'uthmani' ? uthmani : simple;
}
