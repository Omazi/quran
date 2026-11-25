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
 * The palette of the validated mockups, "Le jardin, version 2" (docs/design/accueil.png, soif.png,
 * mort.png, nouveau.png, khatm.png). Owner's rule of 25 November 2026: the mockups are the visual
 * reference, and where they differ from the charter the mockup wins, each difference being listed
 * for the owner (SKILLS.md, deviations 70 to 79). Values are sampled from the mockups; dark
 * values are derived from them. A text colour is darkened from its sample only when the sample
 * misses 4.5:1 on the surface it sits on (accessibility.md › Vision); its sample is noted beside it.
 * The night values are the dusk direction the owner chose (25 November 2026), aligned with the
 * Proches tab's palette (src/ui/visit-palette.ts on work/mk-visit): a dusk sky, warm dark cards.
 */
export const gardenPalette = {
  /** The page under the cards (accueil.png #F3F1EC). */
  canvas: { light: '#F3F1EC', dark: '#151716' },
  /** A card: white by day (accueil.png). */
  surface: { light: '#FFFFFF', dark: '#222725' },
  /** The cream card inside a card ("Al-Kahf · Reprendre page 293"; the verse card of nouveau.png). */
  surfaceInset: { light: '#FBF7EC', dark: '#272319' },
  surfaceInsetBorder: { light: '#EFE4C8', dark: '#3B3425' },
  /** The serif titles ("Ton jardin", "Jardins voisins"): green-black #1D2A23. */
  heading: { light: '#1D2A23', dark: '#F1EADB' },
  /**
   * Secondary text, sampled #6D7771 (4.11:1 on the canvas), darkened to 5.05:1: the value the
   * Proches tab chose for the same grey (src/ui/visit-palette.ts on work/mk-visit, `inkSecondary`).
   */
  muted: { light: '#5F6963', dark: '#A9B1AC' },
  /**
   * The date above the title, sampled #8A7B66 (3.38:1 on the gradient), darkened to pass 4.5:1 on
   * every gradient it sits on, the dust of mort.png included (5.18:1).
   */
  dateLabel: { light: '#5C5245', dark: '#B4A893' },
  /**
   * The app's action colour, forest green #1F5C45 ("Lire et arroser", "Nouvelle khatma", every
   * prominent button; owner's decision of 25 November 2026). At night the dusk green of the
   * Proches tab (`forest`, src/ui/visit-palette.ts on work/mk-visit).
   */
  action: { light: '#1F5C45', dark: '#2E7A5B' },
  /** The label on `action`: 7.85:1 by day, 5.18:1 at night. */
  onAction: { light: '#FFFFFF', dark: '#FFFFFF' },
  /** Green text and symbols: "Tout voir", the leaf, the filled dots, "Hizb 24 terminé". */
  actionTint: { light: '#1F5C45', dark: '#7FCCA6' },
  /** The quiet button ("Partager"): pale green #E6EFE9, label `actionTint`. */
  actionTonal: { light: '#E6EFE9', dark: '#213A30' },
  /** The avatar of the person, #32785D. */
  avatarSelf: { light: '#32785D', dark: '#2E7A5B' },
  /** Water in words: "Arrosage du jour", "Arrosé depuis 12 j"; sampled #2B7F93 (3.81:1 on the gradient), darkened to 4.76:1. */
  water: { light: '#236F80', dark: '#6CCAD8' },
  /** Water as a shape: the ring of the day, the drop (#3FA7B5). A graphic beside words. */
  waterFill: { light: '#3FA7B5', dark: '#4FB8C6' },
  /** Behind water: the track of the ring, the tile of a drop (#E3F1F3). */
  waterTrack: { light: '#E3F1F3', dark: '#1D3439' },
  /** The flame of the streak (#F57834). A graphic beside the number. */
  flame: { light: '#F57834', dark: '#FF9152' },
  /** A dot of the 60 not reached yet (#D1D8D4). */
  dotEmpty: { light: '#D1D8D4', dark: '#3A403D' },
  /** The pill of the streak over the gradient: near white (#FEFAF5). */
  pillSurface: { light: '#FEFAF5', dark: '#262824' },
  /** Thirst (soif.png): the banner, its title, its text, its symbol. */
  thirstSurface: { light: '#FBEBD3', dark: '#33261A' },
  thirst: { light: '#7A4A16', dark: '#F2C58A' },
  /** Sampled #906536 (4.37:1 on the banner), darkened to 5.21:1. */
  thirstSecondary: { light: '#84592A', dark: '#D9B58A' },
  thirstIcon: { light: '#C98A3A', dark: '#E6A957' },
  /** "À sec depuis 3 j": sampled #A0662A (3.81:1 on the gradient), darkened to 5.18:1. */
  drought: { light: '#85531F', dark: '#E8B27A' },
  /** The dry earth (mort.png): its title #3E3A33 and its text, sampled #6E685D (4.15:1), darkened to 5.05:1. */
  earth: { light: '#3E3A33', dark: '#E6E0D6' },
  earthSecondary: { light: '#615B51', dark: '#B3AA9C' },
  /**
   * Friends' avatars (accueil.png: violet, ochre, blue; then green and rose, the values of the
   * Proches tab), the same at night. They only decorate a name written beside them.
   */
  avatarViolet: { light: '#7C5CD6', dark: '#7C5CD6' },
  avatarOchre: { light: '#D08A2E', dark: '#D08A2E' },
  avatarBlue: { light: '#2F80C2', dark: '#2F80C2' },
  avatarGreen: { light: '#3E8E6A', dark: '#3E8E6A' },
  avatarRose: { light: '#C4577E', dark: '#C4577E' },
  /** What dims the screen behind a sheet (nouveau.png). */
  scrim: { light: 'rgba(58, 48, 32, 0.42)', dark: 'rgba(0, 0, 0, 0.6)' },
} as const satisfies Record<string, ColorPair>;

/** High-contrast values of the palette's words and actions (color.md › Best practices). */
export const highContrastGardenPalette = {
  muted: { light: '#454D48', dark: '#CDD3CF' },
  action: { light: '#16443A', dark: '#1F5A43' },
  actionTint: { light: '#16443A', dark: '#A6E0C2' },
  water: { light: '#18525F', dark: '#9BE0EA' },
  drought: { light: '#663E14', dark: '#F5CB9E' },
  thirstSecondary: { light: '#663E14', dark: '#ECCDA8' },
} as const satisfies Partial<Record<keyof typeof gardenPalette, ColorPair>>;

/** The avatar colours of friends, in the order they are given. */
export const avatarRoles = [
  'avatarViolet',
  'avatarOchre',
  'avatarBlue',
  'avatarGreen',
  'avatarRose',
] as const satisfies readonly (keyof typeof gardenPalette)[];

/** One stop of a gradient: where it sits, from 0 (top) to 1 (bottom), and its colour. */
export type GradientStop = readonly [offset: number, color: string];

/**
 * The gradients behind the garden, sampled down the left edge of each mockup. The light end of
 * each runs into the canvas under it. Dark values are a dusk of the same hues.
 */
export const backdropGradients = {
  /** accueil.png: peach at the top, a misty green under the garden. */
  growing: {
    light: [
      [0, '#FBE3C6'],
      [0.38, '#F7E9D9'],
      [0.74, '#EBECE5'],
      [1, '#E2ECEA'],
    ],
    dark: [
      [0, '#2A2219'],
      [0.5, '#1E1B17'],
      [1, '#151A19'],
    ],
  },
  /** soif.png: the warmth drained to grey. */
  thirsty: {
    light: [
      [0, '#E6E1D8'],
      [0.55, '#ECE8E1'],
      [1, '#E4E7E5'],
    ],
    dark: [
      [0, '#312C27'],
      [0.55, '#2A2824'],
      [1, '#262826'],
    ],
  },
  /** mort.png: dust. */
  dead: {
    light: [
      [0, '#D9D4CB'],
      [0.6, '#E2DED7'],
      [1, '#E1DFDA'],
    ],
    dark: [
      [0, '#25221D'],
      [0.6, '#201E1A'],
      [1, '#1D1C19'],
    ],
  },
  /** khatm.png: a full sunrise. */
  complete: {
    light: [
      [0, '#FFD9A8'],
      [0.25, '#FCE4C0'],
      [0.6, '#F8EEDF'],
      [1, '#F7F2E7'],
    ],
    dark: [
      [0, '#3B2A16'],
      [0.5, '#251F17'],
      [1, '#1A1814'],
    ],
  },
} as const satisfies Record<string, Record<'light' | 'dark', readonly GradientStop[]>>;

export type BackdropName = keyof typeof backdropGradients;

/**
 * The soft shadow under a card and under the floating label of the garden (accueil.png): a CSS
 * box shadow, which React Native draws on every platform. None at night: a card is told by its
 * lighter surface there (dark-mode.md › Dark Mode colors).
 */
export const elevation = {
  card: { light: '0px 6px 20px rgba(60, 48, 24, 0.07)', dark: 'none' },
  floating: {
    light: '0px 8px 24px rgba(40, 32, 16, 0.14)',
    dark: '0px 8px 24px rgba(0, 0, 0, 0.4)',
  },
} as const;

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
export type GardenPaletteRole = keyof typeof gardenPalette;
export type ColorRole = SystemColorRole | AppColorRole | GardenPaletteRole;

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
  | 'canvas'
  | 'surface'
  | 'surfaceInset'
  | 'surfaceInsetBorder'
  | 'actionTonal'
  | 'avatarSelf'
  | 'waterTrack'
  | 'dotEmpty'
  | 'pillSurface'
  | 'thirstSurface'
  | 'scrim'
  | 'action'
  | 'avatarViolet'
  | 'avatarOchre'
  | 'avatarBlue'
  | 'avatarGreen'
  | 'avatarRose'
>;

/**
 * The roles a text may take: those of an icon, without `warning`. Orange colours an icon or the
 * fill of a gauge; the word beside it stays in a label colour, where it is readable.
 */
export type TextColorRole = Exclude<
  IconColorRole,
  'warning' | 'waterFill' | 'flame' | 'thirstIcon'
>;

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
  /**
   * The titles: Fraunces SemiBold, bundled (fonts.ts), as in the validated mockups. Arabic has
   * no glyph in it: the system draws Arabic titles in its own font.
   */
  display: 'FrauncesSemiBold',
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
  largeTitle: { fontFamily: fontFamily.display, fontSize: 34, lineHeight: 41, fontWeight: '600' },
  /**
   * The one word an immersive screen says ("À l'écoute…"): 36 points in regular weight, as in
   * the prototype the owner validated (D27, D29). Scales as a large title.
   */
  displayTitle: { fontFamily: fontFamily.serif, fontSize: 36, lineHeight: 40, fontWeight: '400' },
  /**
   * A title that is the message of a screen or of a sheet ("Ton jardin est complet", "Deux
   * sources jaillissent dans ton jardin"): Title 1, serif, as in the validated mockups.
   */
  title1: { fontFamily: fontFamily.display, fontSize: 28, lineHeight: 34, fontWeight: '600' },
  /** Title of an onboarding page or of a group. */
  title2: { fontFamily: fontFamily.display, fontSize: 22, lineHeight: 28, fontWeight: '600' },
  /** A figure that is read first: the numbers of a completed khatma ("604 pages"). */
  figure: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  /** The value of a card ("5 pages sur 8"): Title 3, emphasized. */
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '700' },
  /** Important label. */
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  /** A name in a card ("Al-Kahf", a friend's name): Callout, emphasized. */
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '600' },
  /** Secondary text. */
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  /** A short label that leads ("Arrosage du jour", "24 hizb sur 60"): Subheadline, emphasized. */
  subheadEmphasized: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
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
  title1: 'title1',
  title2: 'title2',
  figure: 'title2',
  title3: 'title3',
  headline: 'headline',
  body: 'body',
  callout: 'callout',
  subhead: 'subheadline',
  subheadEmphasized: 'subheadline',
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
  /** A card of the validated mockups (accueil.png: about 24 points). */
  xl: 24,
  /** Half of any height: a capsule, a circle. */
  full: 999,
} as const;

/**
 * Sizes of the pieces of the validated mockups, measured on them at 1 point per pixel
 * (docs/design/accueil.png is 390 points wide). Each grows with the text it sits beside where
 * it holds text; the shapes keep their size.
 */
export const pieceSizes = {
  /** The ring of the day's watering. */
  ringLarge: 60,
  ringLargeStroke: 6,
  /** The small ring of the floating label over the garden. */
  ringSmall: 32,
  ringSmallStroke: 3,
  /** One dot of the 60-step progress, and the least space between two. */
  dot: 4,
  /** The avatar of the header, and of a friend's card. */
  avatarMedium: 36,
  avatarSmall: 24,
  /** A tile that holds a symbol: in a card, and at the top of a sheet. */
  tileMedium: 36,
  tileLarge: 72,
  /** The main button: a capsule taller than the 44-point minimum. */
  actionHeight: 52,
  /** A friend's card in the row of neighbouring gardens. */
  neighbourCardWidth: 140,
  /** Where the floating label sits over the garden: from the top, and its widest. */
  sceneLabelTop: '14%',
  sceneLabelMaxWidth: '62%',
  /** A sheet's corners (nouveau.png), and its margin from the screen's edges. */
  sheetRadius: 32,
  /** Distance a sheet must be dragged down to close. */
  sheetDismissDistance: 80,
  /** The grabber at the top of a sheet. */
  grabberWidth: 36,
  grabberHeight: 5,
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
 * States of the default (non-iOS) controls. Material's conventions, outside the design skills:
 * a pressed layer of 10 %, disabled content at 38 %.
 */
export const stateOpacity = {
  pressed: 0.9,
  disabled: 0.38,
  /** A step under way, shown at half strength (accueil.png: the dot of the hizb being read). */
  inProgress: 0.45,
} as const;
