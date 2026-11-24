/**
 * The pages of the first-launch flow, as data (docs/specs/ui-lot1.md, A.3). Changing their
 * number or their order is done here and nowhere else: the pager and the page components do not
 * know the lists.
 */

import { DEFAULT_GARDEN_CONFIG } from '@/domain/garden';
import { HIZB_COUNT } from '@/domain/quran';

/** A feature of the app that a page presents, other than the garden. */
export type OnboardingFeature = 'voice' | 'recognition' | 'friends';

/**
 * What the scene of a page shows. The scene is drawn by a function given to the screen; by
 * default it is a placeholder named after this description.
 */
export type OnboardingScene =
  /** The garden after `hizbCompleted` finished hizb, well watered. 0 is the bare earth. */
  | { readonly kind: 'garden'; readonly hizbCompleted: number }
  /** The same garden after a number of days without reading. */
  | {
      readonly kind: 'drought';
      readonly hizbCompleted: number;
      readonly daysWithoutReading: number;
    }
  /** A garden left without reading for a number of days, on the day reading starts again. */
  | {
      readonly kind: 'revival';
      readonly hizbCompleted: number;
      readonly daysWithoutReading: number;
    }
  /** A feature that is not the garden. */
  | { readonly kind: 'feature'; readonly feature: OnboardingFeature };

/**
 * How a page is laid out: `story` and `voice` show a scene, a title and a sentence; `goal` and
 * `reminders` show a title, a sentence and their settings. Each kind has its own component.
 */
export type OnboardingPageKind = 'story' | 'voice' | 'goal' | 'reminders';

export interface OnboardingPage {
  /** Unique name of the page. */
  readonly id: string;
  readonly kind: OnboardingPageKind;
  /** Null for the pages that show settings instead of a scene. */
  readonly scene: OnboardingScene | null;
  /** Translation key of the title, in the `onboarding` namespace. */
  readonly title: string;
  /** Translation key of the sentence under the title, in the `onboarding` namespace. */
  readonly text: string;
  /**
   * The feature the page presents, when it is not the garden. The page is shown only once that
   * feature has shipped: an introduction must not promise what the app cannot do yet.
   */
  readonly feature?: OnboardingFeature;
}

/**
 * The features that exist in the app. None yet: the pages about reading aloud, recognising a
 * passage and friends stay written here, and appear the day their feature is added to this set.
 */
export const SHIPPED_FEATURES: ReadonlySet<OnboardingFeature> = new Set<OnboardingFeature>();

/**
 * The garden that dries on the drought pages: the garden in progress the story has reached when
 * the person "stops reading". Not the complete garden, which never dries.
 */
const GARDEN_IN_PROGRESS_HIZB = 40;

/** The drought pages show the garden on the days its rules give it a new phase. */
const DROUGHT = DEFAULT_GARDEN_CONFIG;

function page(id: string, kind: OnboardingPageKind, scene: OnboardingScene | null): OnboardingPage {
  return { id, kind, scene, title: `pages.${id}.title`, text: `pages.${id}.text` };
}

function gardenPage(id: string, hizbCompleted: number): OnboardingPage {
  return page(id, 'story', { kind: 'garden', hizbCompleted });
}

function droughtPage(id: string, daysWithoutReading: number): OnboardingPage {
  return page(id, 'story', {
    kind: 'drought',
    hizbCompleted: GARDEN_IN_PROGRESS_HIZB,
    daysWithoutReading,
  });
}

function featurePage(feature: OnboardingFeature, kind: OnboardingPageKind): OnboardingPage {
  return { ...page(feature, kind, { kind: 'feature', feature }), feature };
}

const PAGE = {
  bareEarth: gardenPage('bareEarth', 0),
  hizb8: gardenPage('hizb8', 8),
  hizb20: gardenPage('hizb20', 20),
  hizb30: gardenPage('hizb30', 30),
  hizb40: gardenPage('hizb40', GARDEN_IN_PROGRESS_HIZB),
  thirsty: droughtPage('thirsty', DROUGHT.thirstyMinDroughtDays),
  wilting: droughtPage('wilting', DROUGHT.wiltingMinDroughtDays),
  dying: droughtPage('dying', DROUGHT.dyingMinDroughtDays),
  dead: droughtPage('dead', DROUGHT.droughtDaysToDeath),
  // The dead garden of the page before, on the day one page is read again.
  revival: page('revival', 'story', {
    kind: 'revival',
    hizbCompleted: GARDEN_IN_PROGRESS_HIZB,
    daysWithoutReading: DROUGHT.droughtDaysToDeath,
  }),
  // The end of the story: the complete garden comes after the drought, because it never dries.
  hizb60: gardenPage('hizb60', HIZB_COUNT),
  voice: featurePage('voice', 'voice'),
  recognition: featurePage('recognition', 'story'),
  friends: featurePage('friends', 'story'),
  goal: page('goal', 'goal', null),
  reminders: page('reminders', 'reminders', null),
} as const satisfies Record<string, OnboardingPage>;

export type OnboardingLength = 'full' | 'short';

/** Every page of each flow, feature pages included, in order. */
const EVERY_PAGE: Readonly<Record<OnboardingLength, readonly OnboardingPage[]>> = {
  full: [
    PAGE.bareEarth,
    PAGE.hizb8,
    PAGE.hizb20,
    PAGE.hizb30,
    PAGE.hizb40,
    PAGE.thirsty,
    PAGE.wilting,
    PAGE.dying,
    PAGE.dead,
    PAGE.revival,
    PAGE.hizb60,
    PAGE.voice,
    PAGE.recognition,
    PAGE.friends,
    PAGE.goal,
    PAGE.reminders,
  ],
  short: [
    PAGE.bareEarth,
    PAGE.hizb8,
    PAGE.thirsty,
    PAGE.dead,
    PAGE.revival,
    PAGE.hizb60,
    PAGE.voice,
    PAGE.recognition,
    PAGE.goal,
    PAGE.reminders,
  ],
};

/**
 * The pages of a flow: all of them, less the pages about features that have not shipped.
 * `shippedFeatures` defaults to what the app has today.
 */
export function onboardingPages(
  length: OnboardingLength,
  shippedFeatures: ReadonlySet<OnboardingFeature> = SHIPPED_FEATURES,
): readonly OnboardingPage[] {
  return EVERY_PAGE[length].filter(
    ({ feature }) => feature === undefined || shippedFeatures.has(feature),
  );
}

/**
 * The flow the owner saw in the prototype: 16 pages once every feature has shipped, 13 today.
 * Longer than Apple advises (onboarding.md: a brief flow; page-controls.md: about 10 pages):
 * deviation 3 of docs/design/SKILLS.md, to be confirmed.
 */
export const ONBOARDING_PAGES_FULL: readonly OnboardingPage[] = onboardingPages('full');

/** The flow that fits Apple's advice: 10 pages once every feature has shipped, 8 today. */
export const ONBOARDING_PAGES_SHORT: readonly OnboardingPage[] = onboardingPages('short');

/** The one constant that chooses the flow: `full` or `short`. */
export const ONBOARDING_LENGTH: OnboardingLength = 'full';

/** The pages the app shows. */
export const ONBOARDING_PAGES: readonly OnboardingPage[] = onboardingPages(ONBOARDING_LENGTH);
