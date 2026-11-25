/**
 * The pages of the first-launch flow, as data (docs/specs/ui-lot1.md, A.3). Changing their
 * number or their order is done here and nowhere else: the pager and the page components do not
 * know the lists.
 */

import { DEFAULT_GARDEN_CONFIG } from '@/domain/garden';
import { HIZB_COUNT } from '@/domain/quran';
import type { BackdropName } from '@/ui';

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
 * How a page is laid out: `story` and `voice` show a title and a sentence under the scene; `goal`
 * and `reminders` show a title, a sentence and their settings. Each kind has its own component.
 */
export type OnboardingPageKind = 'story' | 'voice' | 'goal' | 'reminders';

/**
 * How large the scene is drawn above a page (the prototype's `.stage`): `full` on the story,
 * `small` above the goal (the stage shrinks as the settings come), `none` on the reminders, whose
 * notifications take its place.
 */
export type OnboardingStage = 'full' | 'small' | 'none';

/**
 * The sky behind a page, as the prototype paints it: the warm gradient of the welcome mockup
 * (`growing`) is always there, and each other gradient named here lies over it at that opacity,
 * from 0 to 1. The pager mixes two pages' values as they pass, so the sky drains to grey a little
 * more on each day without reading.
 */
export type OnboardingBackdrop = Readonly<
  Partial<Record<Exclude<BackdropName, 'growing'>, number>>
>;

/**
 * The colours of a page's words: those of the garden (`garden`), of the dry earth over the dust
 * of the drought pages (`dust`, mort.png), or light over the deep green of listening (`deep`).
 */
export type OnboardingWords = 'garden' | 'dust' | 'deep';

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
  readonly stage: OnboardingStage;
  readonly backdrop: OnboardingBackdrop;
  readonly words: OnboardingWords;
}

/**
 * The features the introduction presents: recognising a passage by listening, following a
 * recitation word by word (shown by owner's decision of 25 November 2026, its demonstration
 * being the real page and bar of the following) and friends. A feature taken out of this set takes
 * its page out of the flow: an introduction must not promise what the app cannot do.
 */
export const SHIPPED_FEATURES: ReadonlySet<OnboardingFeature> = new Set<OnboardingFeature>([
  'voice',
  'recognition',
  'friends',
]);

/**
 * The garden that dries on the drought pages: the garden in progress the story has reached when
 * the person "stops reading". Not the complete garden, which never dries.
 */
const GARDEN_IN_PROGRESS_HIZB = 40;

/** The drought pages show the garden on the days its rules give it a new phase. */
const DROUGHT = DEFAULT_GARDEN_CONFIG;

interface PageLook {
  readonly stage?: OnboardingStage;
  readonly backdrop?: OnboardingBackdrop;
  readonly words?: OnboardingWords;
}

function page(
  id: string,
  kind: OnboardingPageKind,
  scene: OnboardingScene | null,
  { stage = 'full', backdrop = {}, words = 'garden' }: PageLook = {},
): OnboardingPage {
  return {
    id,
    kind,
    scene,
    title: `pages.${id}.title`,
    text: `pages.${id}.text`,
    stage,
    backdrop,
    words,
  };
}

function gardenPage(id: string, hizbCompleted: number, look?: PageLook): OnboardingPage {
  return page(id, 'story', { kind: 'garden', hizbCompleted }, look);
}

function droughtPage(
  id: string,
  daysWithoutReading: number,
  backdrop: OnboardingBackdrop,
): OnboardingPage {
  return page(
    id,
    'story',
    { kind: 'drought', hizbCompleted: GARDEN_IN_PROGRESS_HIZB, daysWithoutReading },
    { backdrop, words: 'dust' },
  );
}

function featurePage(
  feature: OnboardingFeature,
  kind: OnboardingPageKind,
  look?: PageLook,
): OnboardingPage {
  return { ...page(feature, kind, { kind: 'feature', feature }, look), feature };
}

const PAGE = {
  bareEarth: gardenPage('bareEarth', 0),
  hizb8: gardenPage('hizb8', 8),
  hizb20: gardenPage('hizb20', 20),
  hizb30: gardenPage('hizb30', 30),
  hizb40: gardenPage('hizb40', GARDEN_IN_PROGRESS_HIZB),
  // The complete garden, under the sunrise of the completed khatma (khatm.png). It never dries:
  // the drought that follows takes a garden still on its way.
  hizb60: gardenPage('hizb60', HIZB_COUNT, { backdrop: { complete: 1 } }),
  // The sky drains as the prototype's does (`grey` 0.4, 0.65, 0.85, 1): grey, then dust.
  thirsty: droughtPage('thirsty', DROUGHT.thirstyMinDroughtDays, { thirsty: 0.5 }),
  wilting: droughtPage('wilting', DROUGHT.wiltingMinDroughtDays, { thirsty: 1 }),
  dying: droughtPage('dying', DROUGHT.dyingMinDroughtDays, { thirsty: 1, dead: 0.6 }),
  dead: droughtPage('dead', DROUGHT.droughtDaysToDeath, { thirsty: 1, dead: 1 }),
  // The dead garden of the page before, on the day one page is read again.
  revival: page('revival', 'story', {
    kind: 'revival',
    hizbCompleted: GARDEN_IN_PROGRESS_HIZB,
    daysWithoutReading: DROUGHT.droughtDaysToDeath,
  }),
  voice: featurePage('voice', 'voice'),
  recognition: featurePage('recognition', 'story', {
    backdrop: { listening: 1 },
    words: 'deep',
  }),
  friends: featurePage('friends', 'story', { backdrop: { together: 1 } }),
  // The bare earth again, small above the settings: the garden the person is about to start.
  goal: page('goal', 'goal', { kind: 'garden', hizbCompleted: 0 }, { stage: 'small' }),
  reminders: page('reminders', 'reminders', null, { stage: 'none' }),
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
    PAGE.hizb60,
    PAGE.thirsty,
    PAGE.wilting,
    PAGE.dying,
    PAGE.dead,
    PAGE.revival,
    PAGE.recognition,
    PAGE.voice,
    PAGE.friends,
    PAGE.goal,
    PAGE.reminders,
  ],
  short: [
    PAGE.bareEarth,
    PAGE.hizb8,
    PAGE.hizb60,
    PAGE.thirsty,
    PAGE.dead,
    PAGE.revival,
    PAGE.recognition,
    PAGE.voice,
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
 * The flow the owner saw in the prototype, with the following of the recitation after the
 * listening: 16 pages.
 * Longer than Apple advises (onboarding.md: a brief flow; page-controls.md: about 10 pages):
 * deviation 3 of docs/design/SKILLS.md, to be confirmed.
 */
export const ONBOARDING_PAGES_FULL: readonly OnboardingPage[] = onboardingPages('full');

/** The flow that fits Apple's advice: 10 pages. */
export const ONBOARDING_PAGES_SHORT: readonly OnboardingPage[] = onboardingPages('short');

/** The one constant that chooses the flow: `full` or `short`. */
export const ONBOARDING_LENGTH: OnboardingLength = 'full';

/** The pages the app shows. */
export const ONBOARDING_PAGES: readonly OnboardingPage[] = onboardingPages(ONBOARDING_LENGTH);

/** The words of a scene's caption: a key of the `onboarding` namespace and its values. */
export interface SceneCaption {
  readonly key: 'captions.hizb' | 'captions.drought' | 'captions.revival';
  readonly values: Readonly<Record<string, number>>;
}

/**
 * The short caption under the garden of a story page (the prototype's `.cap`): "Hizb 8",
 * "3 jours sans lecture", "Tu reprends ta lecture". None for the bare earth, which the title names,
 * for the features, and above the settings.
 */
export function sceneCaption(page: OnboardingPage): SceneCaption | null {
  const { scene } = page;
  if (scene === null || page.stage !== 'full') return null;
  switch (scene.kind) {
    case 'garden':
      return scene.hizbCompleted === 0
        ? null
        : { key: 'captions.hizb', values: { hizb: scene.hizbCompleted } };
    case 'drought':
      return { key: 'captions.drought', values: { count: scene.daysWithoutReading } };
    case 'revival':
      return { key: 'captions.revival', values: {} };
    case 'feature':
      return null;
  }
}
