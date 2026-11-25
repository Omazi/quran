import { Amiri_400Regular } from '@expo-google-fonts/amiri/400Regular';
import * as Font from 'expo-font';
import { useEffect, useState } from 'react';

import type { ReaderScript } from '@/store';
// The index exports the names of these styles only; listening reads its tokens the same way.
import { quranTextStyles } from '@/ui/tokens';

import { READER_CONFIG } from './config';
import { useQuranFont, type QuranFontStatus } from './use-quran-font';

/**
 * The font of the simple (imla'i) script (D41): Amiri Regular, a Naskh drawn for running Arabic
 * text, SIL Open Font License 1.1 (node_modules/@expo-google-fonts/amiri/LICENSE_FONT), from a
 * package the app already ships. Registered by the reader, not by the root layout: only a reader
 * who chooses the simple script loads it.
 *
 * It belongs with the other fonts in `src/ui` (fonts.ts and the `fontFamily` tokens); it is kept
 * here while the tokens are being consolidated on another branch, and moves there at the merge.
 */
export const SIMPLE_SCRIPT_FONT_FAMILY = 'Amiri_400Regular';

/** The text style of each script in the scroll, at the default text size. */
export interface ScriptTextStyle {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly ramp: (typeof quranTextStyles)['verse']['ramp'];
}

/**
 * The Uthmani text takes the token of a verse read on its own (`quranTextStyles.verse`: the King
 * Fahd font, 28 points on a 56-point line, the Title 1 ramp of Dynamic Type). The simple script
 * takes the same line and ramp, its size scaled by `simpleScriptScale`: Amiri draws its letters
 * larger than the King Fahd font at the same size.
 */
export function scriptTextStyle(script: ReaderScript): ScriptTextStyle {
  const { fontFamily, fontSize, lineHeight, ramp } = quranTextStyles.verse;
  if (script === 'uthmani') return { fontFamily, fontSize, lineHeight, ramp };
  return {
    fontFamily: SIMPLE_SCRIPT_FONT_FAMILY,
    fontSize: fontSize * READER_CONFIG.simpleScriptScale,
    lineHeight,
    ramp,
  };
}

function useSimpleScriptFont(isWanted: boolean): QuranFontStatus {
  const [status, setStatus] = useState<QuranFontStatus>(() =>
    Font.isLoaded(SIMPLE_SCRIPT_FONT_FAMILY) ? 'ready' : 'loading',
  );
  useEffect(() => {
    if (!isWanted || status !== 'loading') return;
    let isCurrent = true;
    Font.loadAsync({ [SIMPLE_SCRIPT_FONT_FAMILY]: Amiri_400Regular }).then(
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
