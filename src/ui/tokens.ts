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
 * The one palette of the app, after the validated mockups (docs/design/accueil.png, soif.png,
 * mort.png, nouveau.png, khatm.png, mushaf.png, visite.png, bienvenue.png, voix.png). Owner's rule
 * of 25 November 2026 (D39): the mockups are the visual reference, and where they differ from
 * Apple's guidelines or the charter, the difference is listed for the owner (SKILLS.md). Values
 * are sampled from the mockups; a text colour is darkened from its sample only when the sample
 * misses 4.5:1 on the surface it sits on (accessibility.md › Vision), its sample noted beside it.
 *
 * One role, one value: the home screen, the Quran tab, the reader, the Proches tab and the
 * voice-following view used to keep their own palettes, which gave the same role slightly
 * different values (three page grounds, three greys of dots, two hairlines). They were merged
 * here on 25 November 2026. The night values are the "dusk" the owner chose: a warm dark sky,
 * warm dark cards (dark-mode.md › Dark Mode colors: dimmer backgrounds, brighter foregrounds).
 */
export const palette = {
  // --- Grounds and surfaces ------------------------------------------------------------------
  /** The page under the cards of every tab (accueil.png #F3F1EC). */
  canvas: { light: '#F3F1EC', dark: '#151716' },
  /** The top of the sky over a page, which fades into `canvas` (accueil.png, visite.png, y = 0). */
  skyTop: { light: '#FBE3C6', dark: '#2A2219' },
  /** The warm ground around the mushaf page, in the reader and while following the voice (mushaf.png). */
  pageGround: { light: '#F3EFE4', dark: '#151716' },
  /** A card, a round button over the page, the watered pill: white by day (accueil.png). */
  surface: { light: '#FFFFFF', dark: '#222725' },
  /** The cream card inside a card ("Al-Kahf · Reprendre page 293"; the verse card of nouveau.png). */
  surfaceInset: { light: '#FBF7EC', dark: '#272319' },
  surfaceInsetBorder: { light: '#EFE4C8', dark: '#3B3425' },
  /** A text field inside a card (visite.png): the page's ground, set in the white. */
  field: { light: '#F3F1EC', dark: '#2C322F' },
  /** Track of a segmented choice and of the search field on the page (mushaf.png, "Uthmani | Simple"). */
  track: { light: '#EBE8E1', dark: '#0F1110' },
  /** Hairline between two rows of a card. */
  divider: { light: '#EFEAE0', dark: '#333836' },
  /** The thin border of an outlined button ("Continuer avec Google", bienvenue.png). */
  outline: { light: '#D9DCD8', dark: '#3D4441' },
  /** The pill of the streak over the gradient: near white (#FEFAF5). */
  pillSurface: { light: '#FEFAF5', dark: '#262824' },
  /** The bottom bar under the mushaf page (mushaf.png #F9F7EE) and its top hairline. */
  bar: { light: '#F9F7EE', dark: '#1B1E1D' },
  barEdge: { light: '#E2DFD8', dark: '#333836' },
  /** Colour of the soft shadows drawn with React Native's shadow props (the page, round buttons). */
  shadow: { light: '#50391A', dark: '#000000' },
  /** What dims the screen behind a sheet (nouveau.png). */
  scrim: { light: 'rgba(58, 48, 32, 0.42)', dark: 'rgba(0, 0, 0, 0.6)' },

  // --- Words ---------------------------------------------------------------------------------
  /** The serif titles ("Ton jardin", "Jardins voisins", "Proches"): green-black #1D2A23. */
  heading: { light: '#1D2A23', dark: '#F1EADB' },
  /** Secondary text, sampled #6D7771 (4.11:1 on the canvas), darkened to 5.05:1. */
  muted: { light: '#5F6963', dark: '#A9B1AC' },
  /**
   * The date above the title, sampled #8A7B66 (3.38:1 on the gradient), darkened to pass 4.5:1 on
   * every gradient it sits on, the dust of mort.png included (5.18:1).
   */
  dateLabel: { light: '#5C5245', dark: '#B4A893' },
  /** Removing and blocking, in words: 5.44:1 on a card, 5.43:1 at night (the system red is 3.55:1). */
  destructiveText: { light: '#C0392B', dark: '#FF6B5E' },

  // --- Action: forest green, the app's one action colour (owner, 25 November 2026) -----------
  /**
   * Every prominent button: "Lire et arroser", "Nouvelle khatma", "Lire avec elle", the reader's
   * microphone, and the system's prominent button. The label on it, `onAction`: 7.85:1 by day,
   * 5.18:1 at night.
   */
  action: { light: '#1F5C45', dark: '#2E7A5B' },
  onAction: { light: '#FFFFFF', dark: '#FFFFFF' },
  /** Green words and symbols: "Tout voir", the leaf, the filled dots, a link button. */
  actionTint: { light: '#1F5C45', dark: '#7FCCA6' },
  /** The quiet button ("Partager", "Encourager"): pale green #E6EFE9, label `actionTint`. */
  actionTonal: { light: '#E6EFE9', dark: '#213A30' },
  /** The black capsule of "Continuer avec Apple" (bienvenue.png), white at night, and its label. */
  contrastButton: { light: '#000000', dark: '#FFFFFF' },
  onContrastButton: { light: '#FFFFFF', dark: '#000000' },

  // --- Water: only where it means water --------------------------------------------------------
  /** Water in words: "Arrosage du jour", "Arrosé depuis 12 j"; sampled #2B7F93 (3.81:1 on the gradient), darkened to 4.76:1. */
  water: { light: '#236F80', dark: '#6CCAD8' },
  /** Water as a shape: the ring of the day, the drop (#3FA7B5). A graphic beside words. */
  waterFill: { light: '#3FA7B5', dark: '#4FB8C6' },
  /** Behind water: the track of the ring, the tile of a drop (#E3F1F3). */
  waterTrack: { light: '#E3F1F3', dark: '#1D3439' },

  // --- The garden's states -------------------------------------------------------------------
  /** The flame of the streak (#F57834). A graphic beside the number. */
  flame: { light: '#F57834', dark: '#FF9152' },
  /** A step not reached yet in a row of dots (#D1D8D4). */
  dotEmpty: { light: '#D1D8D4', dark: '#3A403D' },
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

  // --- People --------------------------------------------------------------------------------
  /** The avatar of the person, #32785D. */
  avatarSelf: { light: '#32785D', dark: '#2E7A5B' },
  /**
   * Friends' avatars (accueil.png: violet, ochre, blue; then green and rose), the same at night.
   * They only decorate a name written beside them. The initial on them is `onAction`, white.
   */
  avatarViolet: { light: '#7C5CD6', dark: '#7C5CD6' },
  avatarOchre: { light: '#D08A2E', dark: '#D08A2E' },
  avatarBlue: { light: '#2F80C2', dark: '#2F80C2' },
  avatarGreen: { light: '#3E8E6A', dark: '#3E8E6A' },
  avatarRose: { light: '#C4577E', dark: '#C4577E' },

  // --- The mushaf page's frame (mushaf.png) ---------------------------------------------------
  /** The double frame of the page: its outer rule, its inner rule, the band between them. */
  frameOuter: { light: '#E5CEA0', dark: '#7A6234' },
  frameInner: { light: '#EBDAB5', dark: '#5C4C2E' },
  frameBand: { light: '#F2EAD6', dark: '#2A251C' },
  /** The gold of the medallions, the corner points and the cartouche, top to bottom. */
  gold: { light: '#C7A05A', dark: '#B8934A' },
  goldLight: { light: '#F1D388', dark: '#D9B86E' },
  goldDeep: { light: '#9D7526', dark: '#8A6A2E' },

  // --- Following the voice (voix.png); the recognition rosette keeps the charter (D27, D29) ---
  /** The two gold rules of the followed page's frame. */
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
  /** The listening bar at the bottom: a green from its start to its end, and what it carries. */
  followBarStart: { light: '#19715D', dark: '#155E4E' },
  followBarEnd: { light: '#0B4A3D', dark: '#08362D' },
  onFollowBar: { light: '#FFFFFF', dark: '#FFFFFF' },
  onFollowBarSecondary: { light: '#E4EFEB', dark: '#D6E6E1' },
  followBarControl: { light: '#FFFFFF2E', dark: '#FFFFFF29' },

  // --- The launch (the app icon's layers; app.json's expo-splash-screen colours) --------------
  /** The deep water behind the mark, a step deeper at night: `app.json` has the same two values. */
  launchWater: { light: '#0B3C44', dark: '#072C33' },
  /** The calligraphic word, the drops and the leaf of the mark, the same in both appearances. */
  launchWord: { light: '#F6FBF9', dark: '#F6FBF9' },
  launchDrops: { light: '#8FE0EA', dark: '#8FE0EA' },
  launchLeaf: { light: '#8FDB6B', dark: '#8FDB6B' },

  // --- The first launch (docs/design/premier-lancement-prototype.html) -----------------------
  /**
   * The page dots of the first launch (docs/design/premier-lancement-prototype.html, `.pc`): the
   * other pages' dots (ink at 22 %), the current one, and the translucent capsule under them where
   * the system's glass is not available. At night, and over the deep green of the listening page,
   * the prototype's light values.
   */
  pageDot: { light: 'rgba(29, 42, 35, 0.22)', dark: 'rgba(255, 255, 255, 0.35)' },
  pageDotCurrent: { light: '#1D2A23', dark: '#FFFFFF' },
  pageDotsSurface: { light: 'rgba(255, 255, 255, 0.55)', dark: 'rgba(255, 255, 255, 0.14)' },
  pageDotsEdge: { light: 'rgba(255, 255, 255, 0.9)', dark: 'rgba(255, 255, 255, 0.22)' },
  /**
   * The sentence over the deep green of the listening page (shazam.png, the prototype's
   * `.copy.light`): the prototype's white at 78 % as a solid value, 5.82:1 on #1F5C45 (`action`),
   * where the words begin. Its title takes `onAction`, the same white.
   */
  onActionSecondary: { light: '#D3E1DC', dark: '#D3E1DC' },
  /** The thin gold lines of the star pattern on that green (shazam.png): a decoration only. */
  patternLine: { light: 'rgba(232, 207, 152, 0.13)', dark: 'rgba(232, 207, 152, 0.1)' },
  /**
   * The rosette drawn on that green, in the card "Quel est ce passage ?" of the Quran tab
   * (maquettes 2026-11-26, 3A): its outer star in pale water and its inside lines in pale gold;
   * its heart takes `onAction`. A decoration beside the words that name the action.
   */
  onActionRosette: { light: '#BFE9EE', dark: '#BFE9EE' },
  onActionRosetteGold: { light: '#E3C27A', dark: '#E3C27A' },
  /** The label of the white capsule on that green ("Reconnaître"): 10.9:1 on white. */
  onActionCapsule: { light: '#123C2D', dark: '#123C2D' },
  /** The white capsule itself, the same in both appearances: it sits on the dark green. */
  actionCapsule: { light: '#FFFFFF', dark: '#FFFFFF' },
  /**
   * The golden microphone of the listening page (shazam.png): its light, middle and deep gold,
   * and its rays. A shape beside the words that name it.
   */
  orbLight: { light: '#FAEBC2', dark: '#F3DFA9' },
  orbMiddle: { light: '#D9A441', dark: '#C8963B' },
  orbDeep: { light: '#9C7838', dark: '#86662E' },
  orbRays: { light: '#F2D48B', dark: '#E2C27A' },
  /** The microphone on the gold disc: the prototype's deep green, the same at night. */
  onOrb: { light: '#123C2D', dark: '#123C2D' },
  /**
   * A notification shown in the first launch's reminders page (the prototype's `.notif`): the
   * translucent card of the system's banners, and its bright edge.
   */
  notificationSurface: { light: 'rgba(255, 255, 255, 0.72)', dark: 'rgba(44, 48, 46, 0.78)' },
  notificationEdge: { light: 'rgba(255, 255, 255, 0.9)', dark: 'rgba(255, 255, 255, 0.12)' },

  // --- The first launch, "voix" direction (docs/design/premier-lancement-voix/index.html) ------
  /**
   * The thread of the voice under the garden (the prototype's canvas): water at its centre, gold
   * at its ends, grey when the garden is dry. A decoration beside the words, never a word.
   */
  voiceWater: { light: '#0E6B78', dark: '#5CC8D6' },
  voiceGold: { light: '#CE9A3C', dark: '#D9A441' },
  voiceGrey: { light: '#A8A094', dark: '#6E675D' },
  /** The soft light behind the garden (`.sun`), and the water light of the dusk sky (`.dusk-glow`). */
  storyGlow: { light: 'rgba(255, 250, 240, 0.75)', dark: 'rgba(255, 236, 210, 0.07)' },
  duskGlow: { light: 'rgba(92, 200, 214, 0.12)', dark: 'rgba(92, 200, 214, 0.12)' },
  /**
   * The mushaf page of the voice page, on the dusk sky in both appearances (`.mushaf`): its two
   * greys of night paper, its gold rules, the words still to come, read and just read, the word
   * to read again, and the three pills under a word (just read, to read again, read again).
   */
  nightPageTop: { light: '#221E19', dark: '#221E19' },
  nightPageBottom: { light: '#1B1915', dark: '#1B1915' },
  nightPageRule: { light: 'rgba(217, 164, 65, 0.5)', dark: 'rgba(217, 164, 65, 0.5)' },
  nightPageRuleSoft: { light: 'rgba(217, 164, 65, 0.28)', dark: 'rgba(217, 164, 65, 0.28)' },
  nightPageGold: { light: '#D9A441', dark: '#D9A441' },
  nightPageInk: { light: '#EFE8D8', dark: '#EFE8D8' },
  nightPageCurrent: { light: '#F6DFA4', dark: '#F6DFA4' },
  nightPageReread: { light: '#FF7B72', dark: '#FF7B72' },
  /** The pill under the word being recited, under the garden (`.pill`). */
  versePill: { light: 'rgba(206, 154, 60, 0.24)', dark: 'rgba(217, 164, 65, 0.3)' },
  nightPillRead: { light: 'rgba(217, 164, 65, 0.26)', dark: 'rgba(217, 164, 65, 0.26)' },
  nightPillReread: { light: 'rgba(255, 95, 85, 0.16)', dark: 'rgba(255, 95, 85, 0.16)' },
  nightPillRereadEdge: { light: 'rgba(255, 123, 114, 0.9)', dark: 'rgba(255, 123, 114, 0.9)' },
  nightPillFixed: { light: 'rgba(92, 200, 214, 0.22)', dark: 'rgba(92, 200, 214, 0.22)' },
  /** The verse inside the card of the passage found (`.found .q`), light on the dusk sky. */
  foundVerseBack: { light: '#F3EAD5', dark: '#F3EAD5' },
  /** The encouragement that travels to a thirsty friend (`.heart`) and its word (`.enc`). */
  heart: { light: '#E0577D', dark: '#E0577D' },
  encouraged: { light: '#C2456A', dark: '#F08AA8' },
  /** The drought drawn on the garden: the cracks of the earth, the rings of the water's return. */
  crack: { light: 'rgba(88, 58, 32, 0.5)', dark: 'rgba(88, 58, 32, 0.5)' },
  revivalRing: { light: '#DFFBFF', dark: '#DFFBFF' },
  revivalRingSoft: { light: '#8FE0EA', dark: '#8FE0EA' },
} as const satisfies Record<string, ColorPair>;

/**
 * The colours of the leaves that fall from the drying garden on the first launch (the prototype's
 * `LEAF`): autumn ochres and browns, the same in both appearances. Decoration only.
 */
export const droughtLeafColors = ['#C9A13B', '#B5652E', '#9E7A3A', '#D68634', '#8F843E'] as const;

/** High-contrast values of the palette's words and actions (color.md › Best practices). */
export const highContrastPalette = {
  muted: { light: '#454D48', dark: '#CDD3CF' },
  action: { light: '#16443A', dark: '#1F5A43' },
  actionTint: { light: '#16443A', dark: '#A6E0C2' },
  water: { light: '#18525F', dark: '#9BE0EA' },
  drought: { light: '#663E14', dark: '#F5CB9E' },
  thirstSecondary: { light: '#663E14', dark: '#ECCDA8' },
} as const satisfies Partial<Record<keyof typeof palette, ColorPair>>;

/** The avatar colours of friends, in the order they are given. */
export const avatarRoles = [
  'avatarViolet',
  'avatarOchre',
  'avatarBlue',
  'avatarGreen',
  'avatarRose',
] as const satisfies readonly (keyof typeof palette)[];

/** How many colours a friend's avatar can take (`Avatar`, `DottedProgress`). */
export const avatarColorCount = avatarRoles.length;

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
  /**
   * shazam.png and the prototype's listening page: deep green, lighter at the top. The prototype
   * draws it as a radial light from the top corner; a vertical gradient keeps its three values.
   * The same at night, a step darker.
   */
  listening: {
    light: [
      [0, '#1E8069'],
      [0.42, '#1F5C45'],
      [1, '#0E2F24'],
    ],
    dark: [
      [0, '#17644F'],
      [0.42, '#174636'],
      [1, '#0A231B'],
    ],
  },
  /** The prototype's page of friends (`.bg.plain`): the peach paled to paper. */
  together: {
    light: [
      [0, '#EFE9DB'],
      [0.55, '#F4F1EA'],
      [1, '#F5F4F1'],
    ],
    dark: [
      [0, '#26231E'],
      [0.55, '#1D1C19'],
      [1, '#181817'],
    ],
  },
  /**
   * The dusk of the voice and listening pages of the first launch (the prototype's `.sky.dusk`, a
   * radial light centred a third of the way down): its vertical section, the same at night.
   */
  dusk: {
    light: [
      [0, '#1D1A16'],
      [0.34, '#2A251F'],
      [0.7, '#12100D'],
      [1, '#0A0907'],
    ],
    dark: [
      [0, '#1D1A16'],
      [0.34, '#2A251F'],
      [0.7, '#12100D'],
      [1, '#0A0907'],
    ],
  },
  /**
   * The tail of the night curtain of the first launch (motion spec §4): under the dusk, half a
   * screen that fades the night into the sky it uncovers, the same in both appearances.
   */
  duskTail: {
    light: [
      [0, 'rgba(10, 9, 7, 1)'],
      [0.3, 'rgba(10, 9, 7, 0.82)'],
      [0.68, 'rgba(10, 9, 7, 0.35)'],
      [1, 'rgba(10, 9, 7, 0)'],
    ],
    dark: [
      [0, 'rgba(10, 9, 7, 1)'],
      [0.3, 'rgba(10, 9, 7, 0.82)'],
      [0.68, 'rgba(10, 9, 7, 0.35)'],
      [1, 'rgba(10, 9, 7, 0)'],
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
/**
 * The launch: the deep water of the app icon and the three colours of its layers (word, drops,
 * leaf), the same in both appearances except the water, which is a step deeper at night. The two
 * water values are those of `app.json` (expo-splash-screen), so that the native launch screen and
 * the animation that takes over from it are one colour, with no flash between them
 * (launching.md › Launch screens). Scripts of the icon: tools/app-icon/make_icon.py. The values
 * are roles of `palette` (`launch…`), read here in the shape the launch animation takes.
 */
export const launchColors = {
  water: palette.launchWater,
  word: palette.launchWord.light,
  drops: palette.launchDrops.light,
  leaf: palette.launchLeaf.light,
} as const;

/** Width of the launch mark in points: the `imageWidth` the native launch screen used (app.json). */
export const launchMarkWidth = 180;

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
export type PaletteRole = keyof typeof palette;
export type ColorRole = SystemColorRole | AppColorRole | PaletteRole;

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
  | 'skyTop'
  | 'pageGround'
  | 'field'
  | 'track'
  | 'divider'
  | 'outline'
  | 'bar'
  | 'barEdge'
  | 'shadow'
  | 'contrastButton'
  | 'frameOuter'
  | 'frameInner'
  | 'frameBand'
  | 'gold'
  | 'goldLight'
  | 'goldDeep'
  | 'followFrame'
  | 'followRereadBack'
  | 'followCurrentBack'
  | 'followBarStart'
  | 'followBarEnd'
  | 'followBarControl'
  | 'launchWater'
  | 'launchWord'
  | 'launchDrops'
  | 'launchLeaf'
  | 'pageDot'
  | 'pageDotCurrent'
  | 'pageDotsSurface'
  | 'pageDotsEdge'
  | 'patternLine'
  | 'orbLight'
  | 'orbMiddle'
  | 'orbDeep'
  | 'notificationSurface'
  | 'notificationEdge'
>;

/**
 * The roles a text may take: those of an icon, without `warning`. Orange colours an icon or the
 * fill of a gauge; the word beside it stays in a label colour, where it is readable.
 */
export type TextColorRole = Exclude<
  IconColorRole,
  'warning' | 'waterFill' | 'flame' | 'thirstIcon' | 'orbRays'
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
   * The reader's simple (imla'i) script (D41): Amiri Regular (`simpleScriptFont`). The Uthmani
   * text never uses it: its signs only have their shape in `quran`.
   */
  quranSimple: 'Amiri_400Regular',
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
  /**
   * The simple script of the reader's scroll (D41). Amiri draws its letters larger than the King
   * Fahd font at the same size: 26 points read like the Uthmani text's 28 (compared on the web
   * screenshots of Al-Kahf); the same line height keeps the two scripts on one rhythm.
   */
  verseSimple: {
    fontFamily: fontFamily.quranSimple,
    fontSize: 26,
    lineHeight: 56,
    ramp: 'title1',
  },
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
  /** The small ring of growth on the line under the garden (maquettes 2026-11-26, 1A: 40, 3.6). */
  ringSmall: 40,
  ringSmallStroke: 3.5,
  /** One dot of the 60-step progress, and the least space between two. */
  dot: 4,
  /** The step under way: a small circle, its line (maquettes 2026-11-26, 1A: 7 and 1.6). */
  dotCurrent: 7,
  dotCurrentStroke: 1.5,
  /** The avatar of a friend's page (visite.png). */
  avatarLarge: 48,
  /** The avatar of the header, and of a friend's card. */
  avatarMedium: 36,
  avatarSmall: 24,
  /** A tile that holds a symbol: in a card, and at the top of a sheet. */
  tileMedium: 36,
  tileLarge: 72,
  /** The main button: a capsule taller than the 44-point minimum. */
  actionHeight: 52,
  /** A drawn mark in place of a symbol in a button: the rosette of "Reconnaître" (3C: 24). */
  markInButton: 24,
  /** A friend's card in the row of neighbouring gardens. */
  neighbourCardWidth: 140,
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
 * Shapes of the validated mockups for the reader and the Quran tab, measured on
 * docs/design/mushaf.png and accueil.png (390 points wide). Colours in `palette`.
 */
export const readerShapes = {
  /** Height of the sky at the top of the Quran tab, as in accueil.png behind the title. */
  skyHeight: 320,
  /** The round buttons of the reader's bar: 40 points drawn, 44 touched (`layout.touchTarget`). */
  roundButton: 40,
  /** The big microphone of the reader's bottom bar (mushaf.png: 56 points). */
  micButton: 56,
  /** The reader's bar at the default text size, then the row of the watered pill under it. */
  barHeight: 48,
  pillRowHeight: 32,
  /** The watered pill: its height at the default text size, and its fully rounded ends. */
  pillHeight: 30,
  pillRadius: 15,
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

/** The simulated voice of the first launch's listening page (the rest is onboarding's config). */
export const storyMotion = {
  /** The simulated voice that moves the listening rosette: a level every this long. */
  demoLevelMs: 90,
} as const;

/**
 * The first launch in the "voix" direction the owner chose (docs/design/premier-lancement-voix/
 * index.html, its `layout()`), measured at 390 × 844 points. Distances "from the top" are counted
 * from the safe area's top; shares are of the window's height unless named otherwise. Layout of a
 * scene that changes under the finger: the screen places each piece from these once, then moves
 * it with transforms only.
 */
export const voiceStoryLayout = {
  /** The garden: 106 % of the width, at most 36 % of the height, its picture's proportions. */
  gardenWidthShare: 1.06,
  gardenHeightShare: 0.36,
  /** Its top: at least 52 points, or 13 % of the height. */
  gardenTopMin: 52,
  gardenTopShare: 0.13,
  /** The recited line under it: the gap (at least 14 points, or 2.6 %) and the line's height. */
  verseGapMin: 14,
  verseGapShare: 0.026,
  verseLineHeight: 46,
  verseTextSize: 25,
  verseMarkSize: 23,
  verseWordGapEm: 0.3,
  /** The pill behind the word being recited: its height, corners, and the air on each side. */
  versePillHeight: 32,
  versePillRadius: 9,
  versePillPad: 5,
  /** A pill is drawn this wide and stretched to its word (`scaleX`, transform only). */
  pillBaseWidth: 100,
  /** The thread of the voice under the line: the gap (at least 24 points, or 4 %). */
  waveGapMin: 24,
  waveGapShare: 0.04,
  /** Its bars: how many, the step between two, their longest reach, their width. */
  waveBars: 36,
  waveStep: 7,
  waveReach: 40,
  waveWidth: 3,
  /** The words: at least 40 points under the thread, or 246 points above the bottom. */
  copyBelowWave: 40,
  copyFromBottom: 246,
  margin: spacing.lg,
  copyGap: 10,
  /** The caption over the garden (`.cap`): from the garden's top, from the start edge. */
  captionTop: 4,
  captionStart: 22,
  captionHeight: 30,
  captionPadding: 12,
  captionDot: 6,
  captionGap: 7,
  /** The soft light behind the garden (`.sun`). */
  glowWidth: 560,
  glowHeight: 420,
  duskGlowSize: 520,
  /** The app's name, the page dots on the end edge, and the hint to swipe. */
  brandTop: 16,
  dotsAboveCentre: 50,
  dotsEnd: 9,
  dot: 4,
  dotSmall: 3,
  dotSmaller: 2,
  dotCurrent: 14,
  dotGap: 6,
  dotsTouchWidth: 44,
  hintFromBottom: 74,
  hintGap: 4,
  /** How far each drifting thing travels: the words, the hint's nudge, a rising garden element. */
  copyTravel: 56,
  /** The sentence under a title comes from further down, so it follows the title (motion spec §3). */
  copyTextTravel: 76,
  /** The first page arrives (motion spec §2): the garden rises 14 points from 97 %, the line 10, the title 16, the sentence 20. */
  introGardenRise: 14,
  introGardenScale: 0.97,
  introLineRise: 10,
  introTitleRise: 16,
  introTextRise: 20,
  hintTravelFrom: 6,
  hintTravelTo: -8,
  riseTravel: 26,
  /** The garden above the settings: its top, its scale (share of the height, at most). */
  previewTop: 50,
  goalPreviewShare: 0.27,
  goalPreviewMax: 0.72,
  remindersPreviewShare: 0.205,
  remindersPreviewMax: 0.6,
  goalPanelGap: 14,
  remindersPanelGap: 10,
  /** The settings: choice buttons, their corners and gaps; the result and list cards. */
  choiceHeight: 54,
  choiceSmallHeight: 48,
  choiceRadius: 18,
  choiceGap: 10,
  choiceIconGap: 8,
  choicePadding: 12,
  cardPadding: 16,
  rollGap: 4,
  leadGap: 8,
  panelGap: 14,
  notificationGap: 11,
  notificationPadding: 11,
  cardRadius: 22,
  listRadius: 20,
  rowMinHeight: 50,
  notificationIcon: 38,
  notificationIconRadius: 9,
  notificationRadius: 22,
  rollHeight: 34,
  rollTravel: 14,
  finishHeight: 54,
  finishGap: 24,
  /** The mushaf page of the voice page (`.mushaf`). */
  pageTopMin: 52,
  pageTopShare: 0.088,
  pageInset: 18,
  pageRadius: 20,
  pageFrameInset: 10,
  pageFrameRadius: 12,
  pageFrameGap: 4,
  pageCorner: 18,
  pageHeadTop: 30,
  pageHeadHeight: 46,
  pageHeadWidthShare: 0.78,
  pageHeadTextSize: 21,
  pageTextMax: 24,
  /** The text size is the page's width less 72 points, over this many em. */
  pageTextEms: 12.2,
  pageLineEm: 1.9,
  pagePadding: 18,
  pageBottomPad: 44,
  pagePillHeight: 36,
  pagePillRadius: 10,
  pagePillPad: 6,
  /** The bar under the page (`.follow`): its height, side insets, how far it overlaps the page. */
  followHeight: 60,
  followInset: 34,
  followOverlap: 30,
  followTextStart: 106,
  followTextEnd: 20,
  followWaveStart: 22,
  followWaveStep: 2.2,
  followWaveReach: 26,
  followWaveWidth: 1.7,
  /** The thread wrapped round the listening rosette (motion spec §7): its bars' width. */
  ringBarWidth: 2.2,
  /** The bar's two lines of state slide 6 points as they swap. */
  subtitleTravel: 6,
  /** The listening page: the rosette's radius (share of width, of height), its place, the card. */
  rosetteWidthShare: 0.27,
  rosetteHeightShare: 0.155,
  rosetteTopShare: 0.34,
  rosetteAboveCopy: 2.9,
  rosetteFoundScale: 0.6,
  /** The room the small rosette takes above the card: its radius and 8 %. */
  rosetteFoundRoom: 1.08,
  rosetteLabelBelow: 1.75,
  rosetteMinTop: 70,
  rosetteAboveCard: 26,
  listenLabelSize: 26,
  foundInset: 18,
  foundRadius: 26,
  foundPadding: 16,
  foundAboveCopy: 30,
  foundRise: 46,
  foundVerseSize: 19,
  foundVerseLineEm: 2,
  foundButtonHeight: 46,
  /** The friends' page (`.friends`). */
  friendsInset: 20,
  friendsTopMin: 60,
  friendCardRadius: 22,
  friendGardenHeight: 112,
  friendGardenRadius: 16,
  friendGardenScale: 1.5,
  friendMiddleLift: 14,
  friendsGap: 10,
  khatmaBarHeight: 6,
  heartSize: 30,
  heartArc: 70,
  /** The heart leaves the reciting friend's garden 50 points down its card, lands on the thirsty one's corner. */
  heartStartDrop: 50,
  heartEndInset: 18,
  heartEndDrop: 16,
  /** The friends sit a little above the middle between the preview's top and the words. */
  friendsLift: 10,
  /** The drought: a falling leaf, and a droplet of the voice rising into the garden. */
  /** The cracks and the two rings of the returning water, in picture pixels. */
  crackWidth: 2.8,
  ringWidth: 7,
  ringSoftWidth: 4,
  leafSize: 3.6,
  leafSizeRange: 2.8,
  leafSway: 9,
  dropletSize: 1.1,
  dropletSizeRange: 1.6,
  /** Drawn at these sizes and scaled (transform only), and where a droplet leaves the thread. */
  dropletBox: 6,
  leafBox: 12,
  dropletRise: 10,
} as const;

/**
 * The small measures of the first launch's demonstrations (the prototype's CSS, at 1 point per
 * pixel): the friends' cards, the card of the passage found, the night mushaf page and its bar,
 * and their shadows. Sizes of `voiceStoryLayout`'s pieces, kept apart because they are many.
 */
export const voiceStoryDetails = {
  hairGap: 2,
  friendCardPadding: 7,
  friendCardPaddingBottom: 12,
  friendNameGap: 5,
  friendNameTop: 9,
  friendStatusInset: 4,
  friendStatusMinHeight: 17,
  friendLiveGap: 6,
  friendGardenShift: 2,
  friendGardenOverflow: '-25%',
  khatmaTop: 6,
  khatmaPaddingVertical: 14,
  khatmaGap: 12,
  avatarOverlap: -8,
  youHeight: 28,
  youMinWidth: 32,
  youPadding: 6,
  equalizerBar: 2,
  equalizerHeight: 12,
  pagePillPaddingH: 9,
  pagePillPaddingV: 4,
  verseTop: 8,
  versePaddingH: 12,
  versePaddingV: 6,
  actionsGap: 10,
  actionsTop: 12,
  pageHeadBottom: 6,
  pageLinesTop: 4,
  pageMarkGap: 4,
  pageCornerOffset: 2,
  pageFrameInnerRadius: 9,
  pageRuleWidth: 1,
  pageRuleSoftWidth: 0.6,
  pageStarWidth: 0.9,
  pageStarHeart: 1.6,
  pageStarShare: 0.83,
  pageRereadEdge: 2,
  followTextTop: 11,
  followLineHeight: 20,
  followWordSize: 17,
} as const;

/** The soft shadows of the first launch's floating pieces on the dusk (`.mushaf`, `.follow`, `.found`). */
export const voiceStoryShadows = {
  page: '0px 34px 70px rgba(0, 0, 0, 0.5)',
  follow: '0px 16px 34px rgba(0, 0, 0, 0.4)',
  found: '0px 30px 60px rgba(0, 0, 0, 0.45)',
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
  /** A step under way, shown at half strength (accueil.png: the dot of the hizb being read). */
  inProgress: 0.45,
} as const;
