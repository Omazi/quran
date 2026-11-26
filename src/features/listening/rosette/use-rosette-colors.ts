import { useColorScheme, type ColorValue } from 'react-native';

import { useColorValues, useColors } from '@/ui';

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
export function useRosetteColors(fixed?: Appearance): RosetteColors {
  const dynamic = useColors();
  // A rosette always drawn on a dark sky (the first launch's dusk) takes its night values in
  // both appearances, as plain values; the contrast setting is still the device's.
  const fixedValues = useColorValues(fixed ?? 'dark');
  const colors = fixed === undefined ? dynamic : fixedValues;
  const scheme: Appearance = useColorScheme() === 'dark' ? 'dark' : 'light';
  return {
    appearance: fixed ?? scheme,
    heart: colors.accentStrong,
    water: colors.accent,
    gold: colors.ornamentLine,
    paper: colors.paper,
    ink: colors.ink,
  };
}
