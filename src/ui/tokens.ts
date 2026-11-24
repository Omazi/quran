/**
 * Design tokens: the single place where the look of the app is decided.
 *
 * Features never write a literal color, font size, spacing or radius: they pick a
 * token. Restyling the app (the visual direction is still being refined) is then a
 * change to this file, not a hunt through screens.
 */

import { Platform } from 'react-native';

export const palette = {
  ink: '#1D2A23',
  inkMuted: '#6B756F',
  inkFaint: '#A8AFAA',
  surface: '#F7F3EA',
  card: '#FFFFFF',
  paper: '#FBF7EC',
  paperEdge: '#EFE4C8',
  hairline: 'rgba(29,42,35,0.08)',
  primary: '#1F5C45',
  primaryDeep: '#123C2D',
  primarySoft: '#E6EFE9',
  gold: '#D9A441',
  goldDeep: '#A9823F',
  water: '#3FA7B5',
  waterDeep: '#2B7F93',
  waterSoft: '#E3F1F3',
  warning: '#7A4A16',
  warningSoft: '#FBEBD3',
  danger: '#D93A3A',
  dangerSoft: '#FCEBEB',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type ColorToken = keyof typeof palette;

/** 4-point spacing scale. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radius = {
  sm: 9,
  md: 16,
  lg: 22,
  xl: 26,
  pill: 999,
} as const;

/**
 * Font families. Interface text uses the system fonts only (Apple guidance): San Francisco
 * for the interface and New York, the system serif, for large titles. Bundled fonts are
 * reserved for Quran text; see src/ui/fonts.ts.
 */
export const fontFamily = {
  /** Interface text: the platform font (San Francisco on iOS, Roboto on Android). */
  ui: undefined,
  /** Large titles: the system serif (New York on iOS). */
  display: Platform.select({ ios: 'ui-serif', default: 'serif' }),
  /** Quran text. Isolated here because the final mushaf font needs a licence (see DECISIONS D6). */
  quran: 'AmiriQuran_400Regular',
  /** Arabic titles (surah names). */
  arabicTitle: 'Amiri_700Bold',
} as const;

export const typography = {
  display: { fontFamily: fontFamily.display, fontSize: 34, lineHeight: 41, fontWeight: '700' },
  title: { fontFamily: fontFamily.display, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  headline: { fontSize: 18, lineHeight: 23, fontWeight: '700' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  button: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
} as const;

export type TypographyToken = keyof typeof typography;

/** Minimum touch target, per Apple and Google accessibility guidance. */
export const MIN_TOUCH_TARGET = 44;

export const elevation = {
  card: {
    shadowColor: palette.ink,
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
} as const;
