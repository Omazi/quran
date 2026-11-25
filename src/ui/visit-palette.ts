/**
 * The palette, shapes and text sizes of the validated mockups (docs/design/visite.png,
 * docs/design/accueil.png, docs/design/bienvenue.png), sampled from the pictures themselves.
 *
 * Owner's rule of 25 November 2026: the validated mockups are the visual reference, where they
 * differ from the charter (brand-spec.md, "the system draws almost everything"). Each difference
 * with the charter's tokens is listed for the owner in docs/design/SKILLS.md (deviations 90 to
 * 94). For now only the Proches tab uses this file: it is kept apart from `tokens.ts` so that the
 * other screens can be moved to it, and the two merged, once the owner has answered.
 *
 * The mockups exist in light only: the dark values are ours, chosen to keep the same warmth (a
 * dusk sky, warm dark cards) and the same contrasts. They are a question for the owner.
 */

import { useColorScheme } from 'react-native';

import { fontFamily, type ColorPair } from './tokens';

export const visitColors = {
  /** The sky behind the garden: top of the screen (visite.png, y = 0). */
  skyTop: { light: '#FBE3C6', dark: '#2A2219' },
  /** The sky halfway down, where the warm tone fades. */
  skyMiddle: { light: '#F6ECDE', dark: '#1E1B17' },
  /** The bottom of the visit's sky, a cool sage. */
  skyBottom: { light: '#E2ECEB', dark: '#151A19' },
  /** The ground of a page under its sky (accueil.png, "Jardins voisins"). */
  page: { light: '#F6F4EF', dark: '#151716' },
  /** A card. */
  card: { light: '#FFFFFF', dark: '#222725' },
  /** A field inside a card. */
  field: { light: '#F6F4EF', dark: '#2C322F' },
  /** Serif titles ("Ton jardin", "Jardins voisins"). */
  title: { light: '#1D2A23', dark: '#F1EADB' },
  /** Names and body text. */
  ink: { light: '#14171A', dark: '#F4F4F1' },
  /**
   * Secondary text. The mockup's grey (#6B756F) reaches 4.77:1 on a card but only 3.84:1 on the
   * sky: darkened by 6 % so that every surface passes 4.5:1 (accessibility.md › Vision).
   */
  inkSecondary: { light: '#5F6963', dark: '#A9B1AC' },
  /** The one green of the actions: "Lire avec elle", "Lire et arroser", "Tout voir". */
  forest: { light: '#1F5C45', dark: '#2E7A5B' },
  onForest: { light: '#FFFFFF', dark: '#FFFFFF' },
  /** The green as text or an icon on a card or the page (the dark forest is too dark there). */
  forestText: { light: '#1F5C45', dark: '#7FCCA6' },
  /** The soft button ("Encourager"). */
  forestSoft: { light: '#E6EFE9', dark: '#213A30' },
  onForestSoft: { light: '#1F5C45', dark: '#9FDCBD' },
  /** A hizb not yet read, in the row of sixty dots. */
  dotEmpty: { light: '#E8E9E9', dark: '#3A403D' },
  hairline: { light: '#ECEAE5', dark: '#333836' },
  /** The tile behind a garden that is well (accueil.png, Imane's card). */
  tileWellTop: { light: '#F9E4CB', dark: '#3B2F23' },
  tileWellBottom: { light: '#E7ECE8', dark: '#1F2825' },
  /** The tile behind a thirsty garden (accueil.png, Bilal's card). */
  tileThirstyTop: { light: '#E7E2DA', dark: '#312C27' },
  tileThirstyBottom: { light: '#E6E7E4', dark: '#262826' },
  /** "Continuer avec Apple": black on a light screen, white on a dark one (bienvenue.png). */
  appleButton: { light: '#000000', dark: '#FFFFFF' },
  onAppleButton: { light: '#FFFFFF', dark: '#000000' },
  /** The outlined button ("Continuer avec Google"). */
  outline: { light: '#D9DCD8', dark: '#3D4441' },
  /** Removing and blocking: 5.44:1 on a card, 5.43:1 at night. */
  destructive: { light: '#C0392B', dark: '#FF6B5E' },
  /** A friend's colour (accueil.png: Imane, Bilal, Sara, and two more of the same weight). */
  avatarViolet: { light: '#7C5CD6', dark: '#7C5CD6' },
  avatarOchre: { light: '#D08A2E', dark: '#D08A2E' },
  avatarBlue: { light: '#2F80C2', dark: '#2F80C2' },
  avatarGreen: { light: '#3E8E6A', dark: '#3E8E6A' },
  avatarRose: { light: '#C4577E', dark: '#C4577E' },
  onAvatar: { light: '#FFFFFF', dark: '#FFFFFF' },
} as const satisfies Record<string, ColorPair>;

export type VisitColorRole = keyof typeof visitColors;

/** The colours a friend can be given, in a fixed order. */
export const visitAvatarRoles = [
  'avatarViolet',
  'avatarOchre',
  'avatarBlue',
  'avatarGreen',
  'avatarRose',
] as const satisfies readonly VisitColorRole[];

export type VisitAvatarRole = (typeof visitAvatarRoles)[number];

/** Shapes measured on the mockups, in points. */
export const visitShape = {
  /** The visit's card at the bottom of the screen (visite.png). */
  sheetRadius: 28,
  /** A card of a list (accueil.png, the day's card). */
  cardRadius: 22,
  /** A garden card of the carousel (accueil.png). */
  gardenCardRadius: 18,
  /** The picture tile inside a garden card. */
  tileRadius: 14,
  /** A button: a capsule of 50 points. */
  buttonHeight: 50,
  buttonRadius: 25,
  /** Inner margin of a card. */
  cardPadding: 20,
  /** Margin between the visit's card and the screen edges. */
  sheetMargin: 8,
  avatarLarge: 48,
  avatarSmall: 22,
  /** A dot of the row of sixty hizb. */
  dot: 4,
} as const;

/**
 * The soft shadow under a card of the mockups, by day; none at night, where a shadow cannot be
 * seen and the card's lighter tone does the work.
 */
export const visitShadow = {
  card: { light: '0px 2px 12px rgba(29, 42, 35, 0.06)', dark: 'none' },
} as const;

/** Text sizes of the mockups that the charter's styles do not have. */
export const visitTextStyles = {
  /**
   * The big serif sentence of a welcome screen ("Une terre nue. Soixante hizb…", bienvenue.png):
   * 28 points, bold, the system serif. Scales as Title 1.
   */
  heading: {
    fontFamily: fontFamily.serif,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '700',
    ramp: 'title1',
  },
  /** The friend's name on the visit's card: 20 points, bold. Scales as Title 3. */
  name: { fontSize: 20, lineHeight: 25, fontWeight: '700', ramp: 'title3' },
  /** A button's label: 16 points, semibold. Scales as Callout. */
  button: { fontSize: 16, lineHeight: 21, fontWeight: '600', ramp: 'callout' },
  /** The small green line above a card's title ("Arrosage du jour"): 13 points, semibold. */
  eyebrow: { fontSize: 13, lineHeight: 18, fontWeight: '600', ramp: 'footnote' },
  /** The initial in a small avatar: 11 points, the smallest size (typography.md). */
  initialSmall: { fontSize: 11, lineHeight: 13, fontWeight: '600', ramp: 'caption2' },
} as const;

export type VisitTextStyleName = keyof typeof visitTextStyles;

/** Every role of the palette as a plain colour, for the appearance the device is in. */
export function useVisitColors(): Readonly<Record<VisitColorRole, string>> {
  const appearance = useColorScheme() === 'dark' ? 'dark' : 'light';
  return appearance === 'dark' ? DARK : LIGHT;
}

function pick(appearance: keyof ColorPair): Record<VisitColorRole, string> {
  // `Object.entries` forgets the key type; the keys are those of `visitColors`.
  const entries = Object.entries(visitColors) as [VisitColorRole, ColorPair][];
  return Object.fromEntries(entries.map(([role, pair]) => [role, pair[appearance]])) as Record<
    VisitColorRole,
    string
  >;
}

const LIGHT = pick('light');
const DARK = pick('dark');
