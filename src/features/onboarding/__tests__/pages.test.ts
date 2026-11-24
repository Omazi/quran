import {
  ONBOARDING_LENGTH,
  ONBOARDING_PAGES,
  ONBOARDING_PAGES_FULL,
  ONBOARDING_PAGES_SHORT,
  SHIPPED_FEATURES,
  onboardingPages,
  type OnboardingFeature,
  type OnboardingPage,
} from '../pages';
import { gardenOfScene } from '../scene';

const EVERY_FEATURE: ReadonlySet<OnboardingFeature> = new Set(['voice', 'recognition', 'friends']);

function ids(pages: readonly OnboardingPage[]): string[] {
  return pages.map((page) => page.id);
}

describe('pages of the first-launch flow', () => {
  it('tell, in the full flow, a story the garden rules allow: growth, drought, revival, completion', () => {
    expect(ids(ONBOARDING_PAGES_FULL)).toEqual([
      'bareEarth',
      'hizb8',
      'hizb20',
      'hizb30',
      'hizb40',
      'thirsty',
      'wilting',
      'dying',
      'dead',
      'revival',
      'hizb60',
      'goal',
      'reminders',
    ]);
  });

  it('keep, in the short flow, the page that states the rule, "read and the water flows"', () => {
    expect(ids(ONBOARDING_PAGES_SHORT)).toEqual([
      'bareEarth',
      'hizb8',
      'thirsty',
      'dead',
      'revival',
      'hizb60',
      'goal',
      'reminders',
    ]);
  });

  it('are chosen by one constant, which today chooses the full flow', () => {
    expect(ONBOARDING_LENGTH).toBe('full');
    expect(ONBOARDING_PAGES).toEqual(ONBOARDING_PAGES_FULL);
  });

  it('take the short flow from the full one: same pages, fewer of them', () => {
    for (const page of ONBOARDING_PAGES_SHORT) expect(ONBOARDING_PAGES_FULL).toContain(page);
  });

  it.each([
    ['full', ONBOARDING_PAGES_FULL],
    ['short', ONBOARDING_PAGES_SHORT],
  ])('have unique names and end with the goal, then the reminders (%s)', (_name, pages) => {
    expect(new Set(ids(pages)).size).toBe(pages.length);
    expect(pages.slice(-2).map((page) => page.kind)).toEqual(['goal', 'reminders']);
    expect(pages.filter((page) => page.kind === 'reminders')).toHaveLength(1);
  });

  it('show the garden growing from the bare earth to hizb 8, 20, 30 and 40', () => {
    expect(ONBOARDING_PAGES_FULL.slice(0, 5).map((page) => page.scene)).toEqual([
      { kind: 'garden', hizbCompleted: 0 },
      { kind: 'garden', hizbCompleted: 8 },
      { kind: 'garden', hizbCompleted: 20 },
      { kind: 'garden', hizbCompleted: 30 },
      { kind: 'garden', hizbCompleted: 40 },
    ]);
  });

  it('dry that garden of 40 hizb after 3, 6, 10 and 14 days, bring it back, then complete it', () => {
    expect(ONBOARDING_PAGES_FULL.slice(5, 11).map((page) => page.scene)).toEqual([
      { kind: 'drought', hizbCompleted: 40, daysWithoutReading: 3 },
      { kind: 'drought', hizbCompleted: 40, daysWithoutReading: 6 },
      { kind: 'drought', hizbCompleted: 40, daysWithoutReading: 10 },
      { kind: 'drought', hizbCompleted: 40, daysWithoutReading: 14 },
      { kind: 'revival', hizbCompleted: 40, daysWithoutReading: 14 },
      { kind: 'garden', hizbCompleted: 60 },
    ]);
  });

  it('never dry the complete garden, which the garden rules keep in full health', () => {
    for (const { scene } of onboardingPages('full', EVERY_FEATURE)) {
      if (scene?.kind === 'drought' || scene?.kind === 'revival') {
        expect(scene.hizbCompleted).toBeLessThan(60);
      }
    }
  });

  it('say which garden each scene shows', () => {
    expect(ONBOARDING_PAGES_FULL.map((page) => page.scene && gardenOfScene(page.scene))).toEqual([
      { hizbCompleted: 0, daysWithoutReading: 0, readsToday: false },
      { hizbCompleted: 8, daysWithoutReading: 0, readsToday: false },
      { hizbCompleted: 20, daysWithoutReading: 0, readsToday: false },
      { hizbCompleted: 30, daysWithoutReading: 0, readsToday: false },
      { hizbCompleted: 40, daysWithoutReading: 0, readsToday: false },
      { hizbCompleted: 40, daysWithoutReading: 3, readsToday: false },
      { hizbCompleted: 40, daysWithoutReading: 6, readsToday: false },
      { hizbCompleted: 40, daysWithoutReading: 10, readsToday: false },
      { hizbCompleted: 40, daysWithoutReading: 14, readsToday: false },
      { hizbCompleted: 40, daysWithoutReading: 14, readsToday: true },
      { hizbCompleted: 60, daysWithoutReading: 0, readsToday: false },
      null,
      null,
    ]);
    expect(gardenOfScene({ kind: 'feature', feature: 'voice' })).toBeNull();
  });

  it('give a scene to every page but the two that show settings', () => {
    for (const page of onboardingPages('full', EVERY_FEATURE)) {
      const showsSettings = page.kind === 'goal' || page.kind === 'reminders';
      expect(page.scene === null).toBe(showsSettings);
    }
  });
});

describe('pages about features', () => {
  it('are left out while no such feature has shipped: the flow promises nothing it cannot do', () => {
    expect(SHIPPED_FEATURES.size).toBe(0);
    for (const pages of [ONBOARDING_PAGES_FULL, ONBOARDING_PAGES_SHORT]) {
      expect(pages.filter((page) => page.feature !== undefined)).toEqual([]);
    }
  });

  it('are still written, and come back in their place when their feature ships', () => {
    expect(ids(onboardingPages('full', EVERY_FEATURE))).toEqual([
      'bareEarth',
      'hizb8',
      'hizb20',
      'hizb30',
      'hizb40',
      'thirsty',
      'wilting',
      'dying',
      'dead',
      'revival',
      'hizb60',
      'voice',
      'recognition',
      'friends',
      'goal',
      'reminders',
    ]);
    expect(ids(onboardingPages('short', EVERY_FEATURE))).toEqual([
      'bareEarth',
      'hizb8',
      'thirsty',
      'dead',
      'revival',
      'hizb60',
      'voice',
      'recognition',
      'goal',
      'reminders',
    ]);
  });

  it('come back one by one: a page appears only for its own feature', () => {
    expect(ids(onboardingPages('full', new Set(['recognition'])))).toContain('recognition');
    expect(ids(onboardingPages('full', new Set(['recognition'])))).not.toContain('voice');
    expect(ids(onboardingPages('full', new Set(['recognition'])))).not.toContain('friends');
  });

  it('keep the page about reading aloud apart, so that it can be replaced alone', () => {
    const voicePages = onboardingPages('full', EVERY_FEATURE).filter(
      ({ kind }) => kind === 'voice',
    );
    expect(voicePages.map(({ id, feature }) => [id, feature])).toEqual([['voice', 'voice']]);
  });
});
