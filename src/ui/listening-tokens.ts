/**
 * The colours of the listening screens, taken from the mockups the owner validated
 * (`docs/design/shazam.png`, `docs/design/voix.png`; owner's rule of 25 November 2026: the
 * validated mockups are the visual reference). Day values are measured on the mockups; night
 * values follow the owner's "dusk" direction (the mockups have no night version). Every pair
 * of text and background is measured in `src/ui/__tests__/listening-tokens.test.ts`, at 4.5:1
 * or more for text (accessibility.md › Vision).
 *
 * These colours belong to the listening screens only: they are not roles of the charter, which
 * the owner is asked about (docs/design/SKILLS.md, deviations 85 to 89).
 */

import { DynamicColorIOS, Platform, useColorScheme, type ColorValue } from 'react-native';

import { useHighContrast } from './device-settings';
import { appColors, type AppleTextStyle, type ColorPair, type TextStyleToken } from './tokens';

export const listeningPalette = {
  // --- The recognition scene (shazam.png) ---------------------------------------------------
  /** The deep green of the scene: light at the top right, darkest at the bottom. */
  sceneTop: { light: '#19715D', dark: '#2A2219' },
  sceneMiddle: { light: '#0E5446', dark: '#1B201C' },
  sceneBottom: { light: '#07342C', dark: '#121816' },
  /** The eight-pointed star lattice drawn over the scene, at `listeningOpacity.pattern`. */
  scenePattern: { light: '#FFFFFF', dark: '#FFFFFF' },
  /** Title and icons on the scene. */
  onScene: { light: '#FFFFFF', dark: '#F1EADB' },
  /** The sentence under the title. */
  onSceneSecondary: { light: '#D3E4DE', dark: '#C9C1B1' },
  /** The round back button on the scene: white over the green. */
  sceneControl: { light: '#FFFFFF24', dark: '#FFFFFF1F' },
  /** The rings around the microphone, at `listeningOpacity.rings`. */
  ring: { light: '#E2C88F', dark: '#D9B978' },
  /** The disc of shade right around the microphone. */
  orbHalo: { light: '#0A4A3E', dark: '#0E1210' },
  /** The gold microphone: its highlight, its body and its edge. */
  orbHighlight: { light: '#F4E3B6', dark: '#E9D3A0' },
  orbBody: { light: '#DEC186', dark: '#CFAF70' },
  orbEdge: { light: '#B98F4D', dark: '#A27A3C' },
  /** The microphone symbol on the gold. */
  onOrb: { light: '#093B32', dark: '#062B24' },
  /** The result card. */
  card: { light: '#FFFFFF', dark: '#222725' },
  cardTitle: { light: '#14171A', dark: '#F1EADB' },
  cardSecondary: { light: '#5F6963', dark: '#A9B1AC' },
  /** "Passage reconnu", the page in its pill, the symbols of the card. */
  cardAccent: { light: '#1F5C45', dark: '#7FCCA6' },
  /**
   * The action colour of the whole app is the mockups' forest green (owner, 25 November 2026),
   * aligned with `src/ui/visit-palette.ts` (branch work/mk-visit): `cardAction` is its
   * `forest`, `cardAccent` its `forestText`, `cardTint` its `forestSoft`. Night values follow the
   * owner's "dusk" direction: a warm dark sky, warm dark cards.
   *
   * The pill of the page and the round buttons of the card.
   */
  cardTint: { light: '#E6EFE9', dark: '#213A30' },
  /** The capsule button of the card and its label. */
  cardAction: { light: '#1F5C45', dark: '#2E7A5B' },
  onCardAction: { light: '#FFFFFF', dark: '#FFFFFF' },
  /** The hairline between the places of "several passages". */
  cardSeparator: { light: '#ECEAE5', dark: '#333836' },

  // --- The voice-following view (voix.png) --------------------------------------------------
  /** Around the page. */
  followBackground: { light: '#EFEBDF', dark: '#151716' },
  /** The round buttons of the bar above the page. */
  followControl: { light: '#FCFBF8', dark: '#222725' },
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
  /** The star lattice of the scene. */
  pattern: 0.045,
  /** The four rings around the microphone, from the inside out. */
  rings: [0.42, 0.38, 0.25, 0.15],
  /** The disc of shade around the microphone. */
  halo: 0.6,
  /** The verse marks not yet recited on the followed page (voix.png). */
  upcomingMarks: 0.32,
} as const;

/**
 * Sizes of the listening screens, in points, measured on the mockups (390 points wide, the
 * same scale as an iPhone).
 */
export const listeningShape = {
  /** The round back button on the scene, and its touch area (buttons.md › Best practices). */
  sceneButtonDiameter: 40,
  sceneButtonHit: 44,
  /** The gold microphone. */
  orbDiameter: 112,
  /** Its centre, as a share of the screen height. */
  orbCentreY: 0.367,
  /** The four rings around it, from the inside out; the first edges the disc of shade. */
  ringRadii: [62, 86, 120, 155],
  ringWidth: 1,
  /** The side of one tile of the star lattice. */
  patternTile: 56,
  /** The result card: its corners, its margins to the screen, its padding. */
  cardRadius: 28,
  cardMargin: 12,
  cardPadding: 18,
  /** The capsule button of the card, and the round one beside it. */
  cardButtonHeight: 48,
  /** The page pill: its padding, inline and block. */
  pillPaddingInline: 12,
  pillPaddingBlock: 6,
  /** Between the card's label and its title. */
  labelGap: 2,
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
  /** Symbol sizes: on a round button, in the microphone, on the card. */
  buttonSymbol: 17,
  orbSymbol: 32,
  cardSymbol: 18,
  /** The shadow the gold microphone casts on the green (shazam.png). */
  orbShadow: { opacity: 0.35, radius: 14, offsetY: 8, elevation: 8 },
  /** The soft shadow under what floats: the card, the raised buttons, the bar. */
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
 * The two text styles of the mockups that the charter does not have: Apple's Title 3, in San
 * Francisco and bold, for the card's title ("Al-Kahf, verset 10"), and a semibold Footnote for
 * the card's label and the page pill (typography.md › Specifications gives both sizes). Each
 * follows the person's text size on its own Apple ramp.
 */
export const listeningTextStyles = {
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '700' },
  footnoteStrong: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
} as const satisfies Record<string, TextStyleToken>;

export const listeningTextRamps = {
  title3: 'title3',
  footnoteStrong: 'footnote',
} as const satisfies Record<keyof typeof listeningTextStyles, AppleTextStyle>;

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
