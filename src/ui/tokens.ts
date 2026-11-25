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
 * The palette of the validated mockups for the reader and the Quran tab (docs/design/mushaf.png
 * and accueil.png). Owner's rule of 25 November 2026: the validated mockups are the visual
 * reference, where the charter's "the system draws almost everything" had led the screens away
 * from them (SKILLS.md, deviation 80). Light values are measured on the PNGs. The mockups have no
 * dark version: the night is the "dusk" direction the owner chose (25 November 2026), a dusk sky
 * over warm dark cards, with the values of the Proches tab and the home screen
 * (src/ui/visit-palette.ts on work/mk-visit, `gardenPalette` on work/mk-home) so that the
 * screens agree (dark-mode.md › Dark Mode colors: dimmer backgrounds, brighter foregrounds). The
 * page of the mushaf keeps its own `paper` and `ink`, which this palette never changes.
 *
 * Surfaces and lines only. Text keeps the roles of the charter (`ink`, `inkSecondary`, `accent`,
 * `ornament`), close to the mockups' own text colours and measured for contrast; the
 * differences are questions for the owner (report of the reader rebuild).
 *
 * Prefixed `reader` on purpose: other screens may grow their own mockup tokens in parallel, and
 * the architect merges them.
 */
export const readerPalette = {
  /** The sky at the top of the Quran tab (accueil.png, y = 0), fading into the ground. */
  skyTop: { light: '#FBE3C6', dark: '#2A2219' },
  /** The warm ground of the reader and of the Quran tab (mushaf.png, around the page). */
  canvas: { light: '#F3EFE4', dark: '#151716' },
  /** The white of the cards, of the round buttons and of the watered pill. */
  card: { light: '#FFFFFF', dark: '#222725' },
  /** The cream card that resumes the reading (accueil.png, "Al-Kahf · Reprendre page 293"). */
  cardCream: { light: '#FBF7EC', dark: '#272319' },
  /** Its thin golden edge. */
  cardCreamEdge: { light: '#EFE4C8', dark: '#3B3425' },
  /** Hairline between two rows of a card. */
  divider: { light: '#EFEAE0', dark: '#333836' },
  /** Track of a segmented choice and of the search field (mushaf.png, "Uthmani | Simple"). */
  track: { light: '#EBE8E1', dark: '#0F1110' },
  /** The water ring of the day (accueil.png): its track, then its fill. */
  ringTrack: { light: '#E3F1F3', dark: '#1D3439' },
  ring: { light: '#3FA7B5', dark: '#4FB8C6' },
  /** The double frame of the page: its outer rule, its inner rule, the band between them. */
  frameOuter: { light: '#E5CEA0', dark: '#7A6234' },
  frameInner: { light: '#EBDAB5', dark: '#5C4C2E' },
  frameBand: { light: '#F2EAD6', dark: '#2A251C' },
  /** The gold of the medallions, the corner points and the cartouche, top to bottom. */
  gold: { light: '#C7A05A', dark: '#B8934A' },
  goldLight: { light: '#F1D388', dark: '#D9B86E' },
  goldDeep: { light: '#9D7526', dark: '#8A6A2E' },
  /** Colour of the soft shadow under the page, the cards and the round buttons. */
  shadow: { light: '#50391A', dark: '#000000' },
} as const satisfies Record<string, ColorPair>;

export type ReaderPaletteRole = keyof typeof readerPalette;

/**
 * A QR code: dark modules on a light ground in both appearances. Scanners are made for that
 * contrast (a code drawn light on dark is not read by every camera), so it does not follow the
 * dark appearance, as a code on a Wallet pass does not. SKILLS.md, deviation 56.
 */
export const qrCodeColors = { module: '#000000', ground: '#FFFFFF' } as const;

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

export interface QuranTextStyleToken {
  readonly fontFamily: string;
  /** Size in points at the default text size. */
  readonly fontSize: number;
  readonly lineHeight: number;
  /** The Dynamic Type ramp the text follows outside the mushaf page. */
  readonly ramp: AppleTextStyle;
}

/**
 * Quran text shown outside the mushaf page: a verse found by listening, the opening words of a
 * place. The reader composes its page like an image and sizes its text itself (D19, reader
 * spec 2); here the text is read on its own, so it follows the person's text size
 * (typography.md › Supporting Dynamic Type). The fonts are the bundled ones (fonts.ts).
 *
 * Line heights: the Hafs font's own line height is 1.76 em (ascent 2,400, descent 1,200 for
 * 2,048 units); 2 em keeps the marks of two lines apart, the reader's own margin
 * (`minimumLineHeightInEm` 1.9) rounded up to the 8-point grid. Sizes: one step above the
 * interface text around them (Title 1 for a verse, Title 2 for a row), because the vowel marks of
 * the Uthmani script are small at body size. Amiri, for a surah's name above its name in the
 * interface's language, at the size of a verse, so that the display title stays the one title.
 */
export const quranTextStyles = {
  /** A verse read on its own. */
  verse: { fontFamily: fontFamily.quran, fontSize: 28, lineHeight: 56, ramp: 'title1' },
  /** The opening words of a verse, in a row that names its place. */
  openingWords: { fontFamily: fontFamily.quran, fontSize: 22, lineHeight: 44, ramp: 'title2' },
  /** A surah's Arabic name, as the reader's surah header writes it. */
  surahName: { fontFamily: fontFamily.quranTitle, fontSize: 28, lineHeight: 48, ramp: 'title1' },
} as const satisfies Record<string, QuranTextStyleToken>;

export type QuranTextStyleName = keyof typeof quranTextStyles;

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

/**
 * The bar chart of the design system (charts.md; marks after the dataviz skill's mark specs):
 * bars no wider than 24 points, with a 4-point rounded data end and a square foot on the
 * baseline, hairline grid lines.
 */
export const chart = {
  /** Height of the plot area, without its labels. */
  plotHeight: 160,
  barMaxWidth: 24,
  /** Share of its slot a bar takes at most: the rest is air between bars. */
  barSlotShare: '60%',
  barCornerRadius: 4,
} as const;

export const layout = {
  /** Margin between the screen edge and its content. */
  screenMargin: spacing.md,
  /** Space between two controls that have a bezel (accessibility.md › Mobility). */
  controlGap: 12,
  /** Smallest width and height of anything that can be touched. */
  touchTarget: Platform.select(touchTargets),
  /** Outline of a default (non-iOS) control. */
  outlineWidth: 1,
  /**
   * Above this text scale (the person's text size divided by the default one), controls that sit
   * side by side are stacked instead, so their labels keep whole words
   * (typography.md › Supporting Dynamic Type).
   */
  sideBySideMaxFontScale: 1.35,
} as const;

/**
 * Shapes of the validated mockups for the reader and the Quran tab, measured on
 * docs/design/mushaf.png and accueil.png (390 points wide). See `readerPalette`.
 */
export const readerShapes = {
  /** The white cards of the Quran tab (accueil.png). */
  cardRadius: 20,
  /** A card inside a card: the cream resume card. */
  innerCardRadius: radius.md,
  /** Height of the sky at the top of the Quran tab, as in accueil.png behind the title. */
  skyHeight: 320,
  /** The round buttons of the reader's bar: 40 points drawn, 44 touched (`layout.touchTarget`). */
  roundButton: 40,
  /** The reader's bar at the default text size, then the row of the watered pill under it. */
  barHeight: 48,
  pillRowHeight: 32,
  /** The watered pill: its height at the default text size, and its fully rounded ends. */
  pillHeight: 30,
  pillRadius: 15,
  /** Diameter of the water ring of the day, and the width of its stroke. */
  ringSize: 56,
  ringStroke: 5,
  /** The page frame: its distance to the screen edges, then its parts, from the outside in. */
  frameInset: 14,
  frameOuterRule: 2,
  frameRuleGap: 3,
  frameInnerRule: 2,
  /** The band of small lozenges above and below the text, between the two rules. */
  frameBand: 6,
  frameBandGap: 2,
  frameMotifWidth: 6,
  frameMotifHeight: 3,
  frameMotifGap: 3,
  /** The gold points at the inner corners of the frame. */
  frameCornerDot: 4,
  /** Air between the inner rule and the text. */
  frameTextInset: { horizontal: 6, vertical: 4 },
  /** The round medallions at both ends of a surah cartouche: diameter, ring, central point. */
  medallion: 20,
  medallionRing: 5,
  medallionDot: 6,
  /** The number of a surah or a hizb, in a small cream medallion at the start of its row. */
  numberBadge: 32,
  /** The two rules of a cartouche and the gap between them. */
  cartoucheRule: 2,
  cartoucheGap: 2,
  /**
   * A surah's Arabic name in gold, in Amiri (`fontFamily.quranTitle`): on the resume card, as the
   * home mockup writes "الكهف", and at the end of a surah row. Sizes at the default text size;
   * they follow it with the Title 2 ramp.
   */
  arabicName: {
    large: { fontSize: 28, lineHeight: 40 },
    row: { fontSize: 20, lineHeight: 30 },
  },
  /** The soft shadow of the mockups: its opacity, blur radius and drop. */
  shadowOpacity: 0.1,
  shadowRadius: 10,
  shadowOffsetY: 2,
} as const;

/** Semibold, for a short emphasised phrase inside a text style (the watered pill). */
export const emphasisWeight: FontWeightToken = '600';

/**
 * States of the default (non-iOS) controls. Material's conventions, outside the design skills:
 * a pressed layer of 10 %, disabled content at 38 %.
 */
export const stateOpacity = {
  pressed: 0.9,
  disabled: 0.38,
} as const;
