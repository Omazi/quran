/**
 * The pages of the first-launch flow, as data (docs/specs/ui-lot1.md, A.3). Changing their
 * number or their order is done here and nowhere else: the pager and the page components do not
 * know the lists.
 */

import { DEFAULT_GARDEN_CONFIG } from '@/domain/garden';
import { HIZB_COUNT } from '@/domain/quran';

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
  | { readonly kind: 'feature'; readonly feature: 'voice' | 'recognition' | 'friends' };

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
}

/** The complete garden, the last page of its growth. */
const COMPLETE_GARDEN_HIZB = HIZB_COUNT;

/**
 * The garden that dries on the drought pages: one hizb short of complete. A complete garden can
 * no longer dry (the garden module always shows it in full health), so it cannot show drought.
 */
const DRYING_GARDEN_HIZB = HIZB_COUNT - 1;

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
    hizbCompleted: DRYING_GARDEN_HIZB,
    daysWithoutReading,
  });
}

const PAGE = {
  bareEarth: gardenPage('bareEarth', 0),
  hizb8: gardenPage('hizb8', 8),
  hizb20: gardenPage('hizb20', 20),
  hizb30: gardenPage('hizb30', 30),
  hizb40: gardenPage('hizb40', 40),
  hizb60: gardenPage('hizb60', COMPLETE_GARDEN_HIZB),
  thirsty: droughtPage('thirsty', DROUGHT.thirstyMinDroughtDays),
  wilting: droughtPage('wilting', DROUGHT.wiltingMinDroughtDays),
  dying: droughtPage('dying', DROUGHT.dyingMinDroughtDays),
  dead: droughtPage('dead', DROUGHT.droughtDaysToDeath),
  // The dead garden of the page before, on the day one page is read again.
  revival: page('revival', 'story', {
    kind: 'revival',
    hizbCompleted: DRYING_GARDEN_HIZB,
    daysWithoutReading: DROUGHT.droughtDaysToDeath,
  }),
  voice: page('voice', 'voice', { kind: 'feature', feature: 'voice' }),
  recognition: page('recognition', 'story', { kind: 'feature', feature: 'recognition' }),
  friends: page('friends', 'story', { kind: 'feature', feature: 'friends' }),
  goal: page('goal', 'goal', null),
  reminders: page('reminders', 'reminders', null),
} as const satisfies Record<string, OnboardingPage>;

/**
 * The 16 pages the owner saw in the prototype. Longer than Apple advises (onboarding.md: a brief
 * flow; page-controls.md: about 10 pages): deviation 3 of docs/design/SKILLS.md, to be confirmed.
 */
export const ONBOARDING_PAGES_FULL: readonly OnboardingPage[] = [
  PAGE.bareEarth,
  PAGE.hizb8,
  PAGE.hizb20,
  PAGE.hizb30,
  PAGE.hizb40,
  PAGE.hizb60,
  PAGE.thirsty,
  PAGE.wilting,
  PAGE.dying,
  PAGE.dead,
  PAGE.revival,
  PAGE.voice,
  PAGE.recognition,
  PAGE.friends,
  PAGE.goal,
  PAGE.reminders,
];

/** The 10 pages that fit Apple's advice, ready for the day the owner chooses them. */
export const ONBOARDING_PAGES_SHORT: readonly OnboardingPage[] = [
  PAGE.bareEarth,
  PAGE.hizb20,
  PAGE.hizb60,
  PAGE.thirsty,
  PAGE.dead,
  PAGE.revival,
  PAGE.voice,
  PAGE.recognition,
  PAGE.goal,
  PAGE.reminders,
];

export type OnboardingLength = 'full' | 'short';

/** The one constant that chooses the flow: `full` (16 pages) or `short` (10 pages). */
export const ONBOARDING_LENGTH: OnboardingLength = 'full';

const PAGES_BY_LENGTH: Readonly<Record<OnboardingLength, readonly OnboardingPage[]>> = {
  full: ONBOARDING_PAGES_FULL,
  short: ONBOARDING_PAGES_SHORT,
};

/** The pages the app shows. */
export const ONBOARDING_PAGES: readonly OnboardingPage[] = PAGES_BY_LENGTH[ONBOARDING_LENGTH];
