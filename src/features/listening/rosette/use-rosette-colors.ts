import { DynamicColorIOS, Platform, useColorScheme, type ColorValue } from 'react-native';

import { useColors } from '@/ui';
// The one colour `useColors()` has no role for (see `heart` below): read from the tokens, never
// written here.
import { highContrastAppColors } from '@/ui/tokens';

import type { Appearance } from './rosette-motion';

export interface RosetteColors {
  readonly appearance: Appearance;
  /** The heart star. */
  readonly heart: ColorValue;
  /** The outer star, the water petals, and the light on the lines at night. */
  readonly water: ColorValue;
  /** The inside lines and the gold petals: the gold of the mushaf's ornaments. */
  readonly gold: ColorValue;
  readonly paper: ColorValue;
  readonly ink: ColorValue;
}

let iosHeart: ColorValue | undefined;

/**
 * The colours of the rosette: the app's four colours (water, gold, paper, ink) with their light
 * and night values (D29). The water, the gold, the paper and the ink come from `useColors()`, so
 * on iOS they follow Dark Mode and Increase Contrast by themselves.
 *
 * The heart star takes the high-contrast value of water in every mode: #8FE0EA at night, as D29
 * decided, and #0A4F59 by day, the closest charter colour to the validated #0C5056. `useColors()`
 * has no role for "water at its high-contrast value while contrast is standard"; until src/ui
 * offers one, it is built here from the token, the same way `useColors()` builds its own.
 */
export function useRosetteColors(): RosetteColors {
  const colors = useColors();
  const appearance: Appearance = useColorScheme() === 'dark' ? 'dark' : 'light';
  const heartPair = highContrastAppColors.accent;
  let heart: ColorValue;
  if (Platform.OS === 'ios') {
    iosHeart ??= DynamicColorIOS({ light: heartPair.light, dark: heartPair.dark });
    heart = iosHeart;
  } else {
    heart = heartPair[appearance];
  }
  return {
    appearance,
    heart,
    water: colors.accent,
    gold: colors.ornament,
    paper: colors.paper,
    ink: colors.ink,
  };
}
