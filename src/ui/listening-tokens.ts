/**
 * The sizes of the voice-following view, measured on the validated mockup `docs/design/voix.png`
 * (D39: the validated mockups are the visual reference). Its colours are roles of the one palette
 * (`palette` in tokens.ts, the `follow…` roles), measured for contrast in
 * `src/ui/__tests__/listening-tokens.test.ts`.
 *
 * The recognition screen is not drawn from here: it stays the validated rosette on paper (D27,
 * D29), with the charter's colours.
 */

import { DynamicColorIOS, Platform, useColorScheme, type ColorValue } from 'react-native';

import { useHighContrast } from './device-settings';
import { appColors, palette } from './tokens';

/** Opacities of what the mockups draw faint. Measured on the mockups. */
export const listeningOpacity = {
  /** The verse marks not yet recited on the followed page (voix.png). */
  upcomingMarks: 0.32,
} as const;

/**
 * Sizes of the listening screens, in points, measured on the mockups (390 points wide, the
 * same scale as an iPhone).
 */
export const listeningShape = {
  /** The round buttons above the page, and their touch area (buttons.md › Best practices). */
  sceneButtonDiameter: 40,
  sceneButtonHit: 44,
  /** The followed page: its text as a share of the page's inner width, its line height in em. */
  followTextOfWidth: 0.054,
  followLineHeightEm: 1.9,
  /** Its two gold rules, outer and inner, the gap between them, the frame's corners. */
  followOuterRule: 1.5,
  followInnerRule: 1,
  followRuleGap: 3,
  followFrameRadius: 2,
  /** The pill behind a word that is marked. */
  wordPillRadius: 4,
  /** The voice-following bar and its stop button. */
  followBarHeight: 64,
  followStopDiameter: 48,
  /** The bars of its voice meter. */
  meterBarWidth: 3,
  meterBarGap: 4,
  meterHeight: 26,
  /** The word to read again, in the bar, in the Quran font. */
  barWordSize: 18,
  /** The symbol on a round button. */
  buttonSymbol: 17,
  /** The soft shadows under the raised buttons and under the bar. */
  raisedShadow: { opacity: 0.08, radius: 8, offsetY: 2, elevation: 2 },
  floatingShadow: { opacity: 0.18, radius: 18, offsetY: 6, elevation: 6 },
} as const;

/**
 * The colour of the words not yet recited. On iOS a dynamic colour, which the system raises to
 * full ink when Increase Contrast is on (color.md › Best practices); elsewhere the device's
 * high-contrast setting, where React Native tells it.
 */
export function useUpcomingInk(): ColorValue {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const isHighContrast = useHighContrast();
  const faint = palette.followUpcomingInk;
  if (Platform.OS === 'ios') {
    return DynamicColorIOS({
      light: faint.light,
      dark: faint.dark,
      highContrastLight: appColors.ink.light,
      highContrastDark: appColors.ink.dark,
    });
  }
  return isHighContrast ? appColors.ink[scheme] : faint[scheme];
}
