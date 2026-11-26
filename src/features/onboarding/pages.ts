/**
 * The pages of the first launch, as data, in the order of the "voix" prototype the owner chose
 * (docs/design/premier-lancement-voix/index.html, `COPY` and `STOPS`): the garden grows over five
 * pages, dries over four, revives, then the voice follows a recitation, a passage is recognised,
 * friends, and the two settings. The owner's decision of 25 November 2026 fixes this order and the
 * prototype's words: the voice page comes before the recognition.
 *
 * The screen reads everything it shows from here: which garden, which caption, which sky, how
 * alive the voice is, how far the camera has turned. Changing a page is done here, not in a
 * component.
 */

/** A garden picture of the story's stage (the prototype's `GS`). */
export type StageGarden =
  | 'g0'
  | 'g8'
  | 'g20'
  | 'g30'
  | 'g40'
  | 'g60'
  | 'd3'
  | 'd6'
  | 'd10'
  | 'd14'
  /** The garden of the chosen goal, a month from now (the personalisation pages). */
  | 'preview';

/**
 * The caption over the garden (`.cap`): a hizb count, days without reading, the revival, or the
 * garden a month from now on the personalisation pages.
 */
export type StageCaption =
  | { readonly kind: 'hizb'; readonly hizb: number }
  | { readonly kind: 'drought'; readonly days: number }
  | { readonly kind: 'revival' }
  | { readonly kind: 'preview' };

/**
 * The skies laid over the warm one, each from 0 to 1 (`bg = [grey, dusk, plain]`): grey drains the
 * warmth during the drought, dusk is the night of the two voice pages, plain the pale paper of
 * friends and settings.
 */
export interface StageSky {
  readonly grey: number;
  readonly dusk: number;
  readonly plain: number;
}

/** What a page holds besides its words: the story, a feature's demonstration, or a setting. */
export type OnboardingPageKind =
  'story' | 'voice' | 'recognition' | 'friends' | 'goal' | 'reminders';

export interface OnboardingPage {
  /** Unique name of the page, also the key of its words. */
  readonly id: string;
  readonly kind: OnboardingPageKind;
  /** Translation keys of the title and its sentence, in the `onboarding` namespace. */
  readonly title: string;
  readonly text: string;
  /** The garden the stage shows on this page, or null when the stage shows something else. */
  readonly garden: StageGarden | null;
  readonly caption: StageCaption | null;
  /** The caption's dot is earth-coloured on the drought pages, water-coloured elsewhere. */
  readonly isDry: boolean;
  readonly sky: StageSky;
  /** How alive the recitation is, 0 (silent and grey) to 1 (`voice`). */
  readonly voice: number;
  /** How far the camera has walked around the garden, in degrees (`TURN`). */
  readonly turn: number;
}

const WARM: StageSky = { grey: 0, dusk: 0, plain: 0 };
const DUSK: StageSky = { grey: 0, dusk: 1, plain: 0 };
const PLAIN: StageSky = { grey: 0, dusk: 0, plain: 1 };

function page(
  id: string,
  kind: OnboardingPageKind,
  look: Omit<OnboardingPage, 'id' | 'kind' | 'title' | 'text' | 'isDry'> & { isDry?: boolean },
): OnboardingPage {
  return {
    id,
    kind,
    title: `pages.${id}.title`,
    text: `pages.${id}.text`,
    isDry: look.isDry ?? false,
    ...look,
  };
}

function grow(id: string, garden: StageGarden, hizb: number, turn: number): OnboardingPage {
  return page(id, 'story', {
    garden,
    caption: hizb === 0 ? null : { kind: 'hizb', hizb },
    sky: WARM,
    voice: 1,
    turn,
  });
}

function dry(
  id: string,
  garden: StageGarden,
  days: number,
  grey: number,
  voice: number,
  turn: number,
): OnboardingPage {
  return page(id, 'story', {
    garden,
    caption: { kind: 'drought', days },
    isDry: true,
    sky: { grey, dusk: 0, plain: 0 },
    voice,
    turn,
  });
}

/** The sixteen pages, in order. */
export const ONBOARDING_PAGES: readonly OnboardingPage[] = [
  grow('bareEarth', 'g0', 0, -5),
  grow('hizb8', 'g8', 8, -3),
  grow('hizb20', 'g20', 20, -1),
  grow('hizb30', 'g30', 30, 1),
  grow('hizb40', 'g40', 40, 3),
  grow('hizb60', 'g60', 60, 5),
  // The drought dries the complete garden, as the prototype does; the voice fades with it.
  dry('thirsty', 'd3', 3, 0.4, 0.5, 4),
  dry('wilting', 'd6', 6, 0.65, 0.22, 3),
  dry('dying', 'd10', 10, 0.85, 0.06, 1.5),
  // Straight on the dead page: the revival that follows masks the garden (motion spec §0.7).
  dry('dead', 'd14', 14, 1, 0, 0),
  page('revival', 'story', {
    garden: 'g60',
    caption: { kind: 'revival' },
    sky: WARM,
    voice: 1,
    turn: 0,
  }),
  page('voice', 'voice', { garden: null, caption: null, sky: DUSK, voice: 1, turn: 0 }),
  page('recognition', 'recognition', { garden: null, caption: null, sky: DUSK, voice: 1, turn: 0 }),
  page('friends', 'friends', { garden: null, caption: null, sky: PLAIN, voice: 0, turn: 0 }),
  page('goal', 'goal', {
    garden: 'preview',
    caption: { kind: 'preview' },
    sky: PLAIN,
    voice: 0,
    turn: 0,
  }),
  page('reminders', 'reminders', {
    garden: 'preview',
    caption: { kind: 'preview' },
    sky: PLAIN,
    voice: 0,
    turn: 0,
  }),
];

/** The same list, under the name the settings' language test reads. */
export const ONBOARDING_PAGES_FULL = ONBOARDING_PAGES;

/** The index of the page of a kind, for the pieces of the stage that belong to one page. */
export function pageIndexOf(kind: OnboardingPageKind, pages = ONBOARDING_PAGES): number {
  const index = pages.findIndex((candidate) => candidate.kind === kind);
  if (index < 0) throw new RangeError(`The first launch has no page of kind ${kind}.`);
  return index;
}

/**
 * The stage of each growing garden and the stage it grows from: between the two, what the new
 * one adds rises from the ground before the whole picture settles (the prototype's `from`).
 */
export const GROWS_FROM: Readonly<Partial<Record<StageGarden, StageGarden>>> = {
  g8: 'g0',
  g20: 'g8',
  g30: 'g20',
  g40: 'g30',
  g60: 'g40',
};
