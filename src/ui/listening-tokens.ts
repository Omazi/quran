/**
 * The colours and sizes of the voice-following view, taken from the validated mockup
 * `docs/design/voix.png` (owner's rule of 25 November 2026: the validated mockups are the visual
 * reference). Day values are measured on the mockup; night values follow the owner's "dusk"
 * direction (warm dark surfaces), the mockup having no night version. Every pair of text and
 * background is measured in `src/ui/__tests__/listening-tokens.test.ts`, at 4.5:1 or more for
 * text (accessibility.md › Vision).
 *
 * The recognition screen is not drawn from here: it stays the validated rosette on paper (D27,
 * D29), with the charter's colours. These colours are not roles of the charter (SKILLS.md,
 * deviations 85 to 87).
 */

import { DynamicColorIOS, Platform, useColorScheme, type ColorValue } from 'react-native';

import { useHighContrast } from './device-settings';
import { appColors, type ColorPair } from './tokens';

export const listeningPalette = {
  // --- The voice-following view (voix.png) --------------------------------------------------
  /** Around the page. */
  followBackground: { light: '#EFEBDF', dark: '#151716' },
  /** The round buttons of the bar above the page, and their symbol. */
  followControl: { light: '#FCFBF8', dark: '#222725' },
  onFollowControl: { light: '#14171A', dark: '#F1EADB' },
  /** The two gold rules of the page's frame. */
  followFrame: { light: '#D8BC82', dark: '#8C6F35' },
  /** The word to read again: red ink in a rose pill. */
  followRereadInk: { light: '#B02A22', dark: '#FF8F87' },
  followRereadBack: { light: '#F8DEDC', dark: '#4A2522' },
  /**
   * The words not yet recited: ink at 32 % over the paper (voix.png draws them faint). Full ink
   * when the person asks for more contrast (`useUpcomingInk`).
   */
  followUpcomingInk: { light: '#B4B1AA', dark: '#5F5B53' },
  /** The word just recited. */
  followCurrentBack: { light: '#EAD8B2', dark: '#4D3F22' },
  /** The listening bar at the bottom: a green from its start to its end. */
  followBarStart: { light: '#19715D', dark: '#155E4E' },
  followBarEnd: { light: '#0B4A3D', dark: '#08362D' },
  onFollowBar: { light: '#FFFFFF', dark: '#FFFFFF' },
  onFollowBarSecondary: { light: '#E4EFEB', dark: '#D6E6E1' },
  followBarControl: { light: '#FFFFFF2E', dark: '#FFFFFF29' },
  /** The soft shadows under the card, the raised buttons and the bar. */
  shadow: { light: '#000000', dark: '#000000' },
} as const satisfies Record<string, ColorPair>;

export type ListeningPaletteRole = keyof typeof listeningPalette;

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

/** One colour per role of the listening screens, for the current appearance. */
export type ListeningColors = Readonly<Record<ListeningPaletteRole, string>>;

function resolve(appearance: keyof ColorPair): ListeningColors {
  const entries = Object.entries(listeningPalette) as [ListeningPaletteRole, ColorPair][];
  return Object.fromEntries(entries.map(([role, pair]) => [role, pair[appearance]])) as Record<
    ListeningPaletteRole,
    string
  >;
}

const RESOLVED = { light: resolve('light'), dark: resolve('dark') } as const;

/**
 * The colours of the listening screens, plain strings (react-native-svg takes no dynamic
 * colour), chosen from the phone's appearance; there is no appearance setting in the app
 * (dark-mode.md › Best practices).
 */
export function useListeningColors(): ListeningColors & { readonly isHighContrast: boolean } {
  const scheme = useColorScheme();
  const isHighContrast = useHighContrast();
  return { ...RESOLVED[scheme === 'dark' ? 'dark' : 'light'], isHighContrast };
}

/**
 * The colour of the words not yet recited. On iOS a dynamic colour, which the system raises to
 * full ink when Increase Contrast is on (color.md › Best practices); elsewhere the device's
 * high-contrast setting, where React Native tells it.
 */
export function useUpcomingInk(): ColorValue {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const isHighContrast = useHighContrast();
  const faint = listeningPalette.followUpcomingInk;
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
