import { useColorScheme, type ColorValue } from 'react-native';

import { useColors } from '@/ui';

import type { Appearance } from './rosette-motion';

export interface RosetteColors {
  readonly appearance: Appearance;
  /** The heart star. */
  readonly heart: ColorValue;
  /** The outer star, the water petals, and the light on the lines at night. */
  readonly water: ColorValue;
  /** The inside lines and the gold petals: the gold of the mushaf's ornament lines. */
  readonly gold: ColorValue;
  readonly paper: ColorValue;
  readonly ink: ColorValue;
}

/**
 * The colours of the rosette (D29): water, the ornament line, paper and ink, with their light
 * and night values. All come from `useColors()`, so on iOS they follow Dark Mode and Increase
 * Contrast by themselves.
 *
 * The heart star takes `accentStrong`, the high-contrast water in every mode: #8FE0EA at night,
 * as D29 decided, and #0A4F59 by day, the closest charter colour to the validated #0C5056.
 */
export function useRosetteColors(): RosetteColors {
  const colors = useColors();
  const appearance: Appearance = useColorScheme() === 'dark' ? 'dark' : 'light';
  return {
    appearance,
    heart: colors.accentStrong,
    water: colors.accent,
    gold: colors.ornamentLine,
    paper: colors.paper,
    ink: colors.ink,
  };
}
