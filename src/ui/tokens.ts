/**
 * Design tokens: the values of the design charter (docs/design/brand-spec.md, section 3).
 *
 * This file is data only. Features never read a colour from here: they call `useColors()`
 * (src/ui/use-colors.ts) or pass a role name to a component of src/ui. Text styles are applied
 * through `AppText`. Spacing, radii and layout values are imported directly.
 */

import { Platform, type TextProps } from 'react-native';

// ---------------------------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------------------------

/** A colour with one value per appearance. */
export interface ColorPair {
  readonly light: string;
  readonly dark: string;
}

/**
 * The colours that belong to the app. One colour, one meaning (color.md › Best practices).
 * `onAccent` is the label drawn on an accent background, `ink` the text drawn on `paper`.
 */
export const appColors = {
  /** Water: the main action of a screen, the selected tab, "watered". */
  accent: { light: '#0E6B78', dark: '#5CC8D6' },
  onAccent: { light: '#FFFFFF', dark: '#000000' },
  /** The garden when it is well, in content only. */
  growth: { light: '#1F6B4A', dark: '#63C794' },
  /** The mushaf page, and nothing else. */
  paper: { light: '#FBF7EC', dark: '#1B1915' },
  ink: { light: '#1C1C1E', dark: '#EFE8D8' },
  /**
   * Secondary text on `paper` (the reader's "Juz · Hizb · Page" line): ink at 65 % over paper,
   * 5.13:1 and 6.73:1, where the system's secondary label reaches only 3.35:1 on paper
   * (accessibility.md › Vision: 4.5:1 for text up to 17 points).
   */
  inkSecondary: { light: '#6A6966', dark: '#A5A094' },
  /** Ornaments of the mushaf, in content only. */
  ornament: { light: '#8F611A', dark: '#D9A441' },
  /**
   * The lines of an ornament drawn thin, never a word or an icon: the gold of the validated
   * listening rosette, #CE9A3C by day (2.36:1 on paper, a decoration that carries no
   * information). At night it is the night ornament. Approved by the owner with D27 and D29.
   */
  ornamentLine: { light: '#CE9A3C', dark: '#D9A441' },
  /**
   * Water at its high-contrast value in both appearances, whatever the contrast setting: the
   * star at the heart of the listening rosette (D29). Equal to `highContrastAppColors.accent`.
   */
  accentStrong: { light: '#0A4F59', dark: '#8FE0EA' },
} as const satisfies Record<string, ColorPair>;

/**
 * The values some app colours take when the person asks the device for more contrast (charter,
 * "Contraste élevé"; color.md › Best practices asks for one per custom colour). The colours the
 * charter does not list keep their standard value: `onAccent` on the stronger accent, and ink on
 * paper, are already far above the minimum.
 */
export const highContrastAppColors = {
  accent: { light: '#0A4F59', dark: '#8FE0EA' },
  growth: { light: '#164F36', dark: '#8FE0B4' },
  ornament: { light: '#6A470F', dark: '#EBC272' },
  /** The ornament's own row of the charter: a line asked to stand out takes the same values. */
  ornamentLine: { light: '#6A470F', dark: '#EBC272' },
} as const satisfies Partial<Record<keyof typeof appColors, ColorPair>>;

/**
 * System roles on iOS: names of UIKit's dynamic colours, resolved by the system. Their values are
 * never written in the app, so they follow Dark Mode and Increase Contrast on their own
 * (color.md › System colors, dark-mode.md › Dark Mode colors).
 */
export const iosSystemColorNames = {
  /** Overall view (color.md › Mobile). */
  background: 'systemBackground',
  /** Groups content inside the overall view. */
  secondaryBackground: 'secondarySystemBackground',
  /** Overall view of a screen that shows a grouped list. */
  groupedBackground: 'systemGroupedBackground',
  /** Groups content inside a grouped screen. */
  secondaryGroupedBackground: 'secondarySystemGroupedBackground',
  label: 'label',
  secondaryLabel: 'secondaryLabel',
  /** Non-essential content only: its contrast is low by design. */
  tertiaryLabel: 'tertiaryLabel',
  separator: 'separator',
  /** Thin shapes such as the track of a bar. */
  fill: 'systemFill',
  /** Thirst and alerts: an icon or the fill of a gauge, never a word, always beside a word. */
  warning: 'systemOrange',
  /** Destructive actions. Graphics and large or bold text. */
  destructive: 'systemRed',
} as const;

export type SystemColorRole = keyof typeof iosSystemColorNames;
export type AppColorRole = keyof typeof appColors;
export type ColorRole = SystemColorRole | AppColorRole;

/**
 * The roles an icon may take. A dynamic system colour keeps its meaning (color.md › System
 * colors): backgrounds, separators and fills never colour a foreground, and `paper` is a surface.
 */
export type IconColorRole = Exclude<
  ColorRole,
  | 'background'
  | 'secondaryBackground'
  | 'groupedBackground'
  | 'secondaryGroupedBackground'
  | 'separator'
  | 'fill'
  | 'paper'
  | 'ornamentLine'
  | 'accentStrong'
>;

/**
 * The roles a text may take: those of an icon, without `warning`. Orange colours an icon or the
 * fill of a gauge; the word beside it stays in a label colour, where it is readable.
 */
export type TextColorRole = Exclude<IconColorRole, 'warning'>;

/**
 * The colour of a switch that is on, on iOS: the system's own green, kept on purpose while the
 * other controls take the accent (toggles.md › Mobile (iOS, iPadOS)).
 */
export const iosSwitchColorName = 'systemGreen';

/**
 * System roles outside iOS (Android, web): equivalents chosen in JavaScript from the device
 * theme. Provisional until the Android lot.
 *
 * Sources: backgrounds are the surfaces the charter measures its contrasts against; labels and
 * separators are the neutral palette of the SwiftUI Design skill (typography-color.md › Color
 * Palette Structure), as are orange and red. The light orange of that palette reaches only
 * 2.2:1 on white, so it is darkened, hue unchanged, in steps of 1 %: 80 % is the first value
 * above 3:1 on the grouped background #F2F2F7 (3.03:1; 3.38:1 on white).
 */
export const fallbackSystemColors = {
  background: { light: '#FFFFFF', dark: '#000000' },
  secondaryBackground: { light: '#F2F2F7', dark: '#1C1C1E' },
  groupedBackground: { light: '#F2F2F7', dark: '#000000' },
  secondaryGroupedBackground: { light: '#FFFFFF', dark: '#1C1C1E' },
  label: { light: '#000000', dark: '#FFFFFF' },
  secondaryLabel: { light: '#6B6B6B', dark: '#8E8E93' },
  tertiaryLabel: { light: '#999999', dark: '#636366' },
  separator: { light: '#E5E5E5', dark: '#38383A' },
  fill: { light: '#E5E5E5', dark: '#38383A' },
  warning: { light: '#CC7700', dark: '#FF9500' },
  destructive: { light: '#FF3B30', dark: '#FF3B30' },
} as const satisfies Record<SystemColorRole, ColorPair>;

/** WCAG AA thresholds used by Apple's Accessibility Inspector (accessibility.md › Vision). */
export const contrastThresholds = {
  /** Text up to 17 points. */
  text: 4.5,
  /** Text of 18 points or more, bold text, and graphics. */
  largeTextAndGraphics: 3,
} as const;

// ---------------------------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------------------------

/**
 * Font families. The interface uses the system fonts only (typography.md › Using system fonts):
 * San Francisco by default, New York for large titles. React Native maps `ui-serif` to the
 * system serif design on iOS. Bundled fonts are reserved for Quran text (see fonts.ts, D6).
 */
export const fontFamily = {
  /** New York on iOS, the platform serif elsewhere. */
  serif: Platform.select({ ios: 'ui-serif', default: 'serif' }),
  /** Quran text: the Hafs font of the King Fahd Complex, the one the text was published for (D19). */
  quran: 'KFGQPCHafsUthmanic',
  /** Arabic titles (surah names). */
  quranTitle: 'Amiri_700Bold',
  /**
   * The Quran font by its PostScript name, for SwiftUI (`Font.custom`), which does not know the
   * name given to it in `appFonts`. expo-font registers the file for the whole process.
   */
  quranPostScript: 'KFGQPCHAFSUthmanicScript-Regula',
} as const;

/**
 * Regular, semibold and bold only: light weights are hard to read at small sizes
 * (typography.md › Ensuring legibility).
 */
export type FontWeightToken = '400' | '600' | '700';

export interface TextStyleToken {
  /** Omitted for San Francisco, the platform font. */
  readonly fontFamily?: string;
  /** Size in points at the default text size. */
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly fontWeight: FontWeightToken;
}

/**
 * Apple's text styles kept by the charter, at the default ("Large") text size
 * (typography.md › Specifications). At most four per screen.
 */
export const textStyles = {
  /** Screen title. */
  largeTitle: { fontFamily: fontFamily.serif, fontSize: 34, lineHeight: 41, fontWeight: '700' },
  /**
   * The one word an immersive screen says ("À l'écoute…"): 36 points in regular weight, as in
   * the prototype the owner validated (D27, D29). Scales as a large title.
   */
  displayTitle: { fontFamily: fontFamily.serif, fontSize: 36, lineHeight: 40, fontWeight: '400' },
  /** Title of an onboarding page or of a group. */
  title2: { fontFamily: fontFamily.serif, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  /** Important label. */
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  /** Secondary text. */
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  /** Notes and captions. */
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const satisfies Record<string, TextStyleToken>;

export type TextStyleName = keyof typeof textStyles;

/** Apple's name of each text style, as React Native and SwiftUI spell it. */
export type AppleTextStyle = NonNullable<TextProps['dynamicTypeRamp']>;

/**
 * The Dynamic Type ramp of each style. With it, iOS scales a text the way Apple's tables do
 * (a large title grows less than a footnote), not by one factor for all styles.
 */
export const appleTextStyles = {
  largeTitle: 'largeTitle',
  displayTitle: 'largeTitle',
  title2: 'title2',
  headline: 'headline',
  body: 'body',
  subhead: 'subheadline',
  footnote: 'footnote',
} as const satisfies Record<TextStyleName, AppleTextStyle>;

/** Smallest text size the interface may use (typography.md › Ensuring legibility). */
export const MINIMUM_FONT_SIZE = 11;

// ---------------------------------------------------------------------------------------------
// Spacing, shapes, targets
// ---------------------------------------------------------------------------------------------

/** The 8-point grid of the charter. */
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export type SpacingToken = keyof typeof spacing;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

/** Comfortable touch target of each platform (accessibility.md › Mobility; 48 dp on Material). */
export const touchTargets = { ios: 44, android: 48, default: 44 } as const;

export const layout = {
  /** Margin between the screen edge and its content. */
  screenMargin: spacing.md,
  /** Space between two controls that have a bezel (accessibility.md › Mobility). */
  controlGap: 12,
  /** Smallest width and height of anything that can be touched. */
  touchTarget: Platform.select(touchTargets),
  /** Outline of a default (non-iOS) control. */
  outlineWidth: 1,
} as const;

/**
 * States of the default (non-iOS) controls. Material's conventions, outside the design skills:
 * a pressed layer of 10 %, disabled content at 38 %.
 */
export const stateOpacity = {
  pressed: 0.9,
  disabled: 0.38,
} as const;
