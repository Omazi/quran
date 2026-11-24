import {
  ONBOARDING_LENGTH,
  ONBOARDING_PAGES,
  ONBOARDING_PAGES_FULL,
  ONBOARDING_PAGES_SHORT,
  type OnboardingPage,
} from '../pages';
import { gardenOfScene } from '../scene';

function ids(pages: readonly OnboardingPage[]): string[] {
  return pages.map((page) => page.id);
}

describe('pages of the first-launch flow', () => {
  it('are, in the full flow, the 16 pages the owner saw, in their order', () => {
    expect(ids(ONBOARDING_PAGES_FULL)).toEqual([
      'bareEarth',
      'hizb8',
      'hizb20',
      'hizb30',
      'hizb40',
      'hizb60',
      'thirsty',
      'wilting',
      'dying',
      'dead',
      'revival',
      'voice',
      'recognition',
      'friends',
      'goal',
      'reminders',
    ]);
  });

  it('are, in the short flow, the 10 pages of the specification, in their order', () => {
    expect(ids(ONBOARDING_PAGES_SHORT)).toEqual([
      'bareEarth',
      'hizb20',
      'hizb60',
      'thirsty',
      'dead',
      'revival',
      'voice',
      'recognition',
      'goal',
      'reminders',
    ]);
  });

  it('are chosen by one constant, which today chooses the full flow', () => {
    expect(ONBOARDING_LENGTH).toBe('full');
    expect(ONBOARDING_PAGES).toBe(ONBOARDING_PAGES_FULL);
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

  it('show the garden growing: bare earth, then hizb 8, 20, 30, 40 and 60', () => {
    expect(ONBOARDING_PAGES_FULL.slice(0, 6).map((page) => page.scene)).toEqual([
      { kind: 'garden', hizbCompleted: 0 },
      { kind: 'garden', hizbCompleted: 8 },
      { kind: 'garden', hizbCompleted: 20 },
      { kind: 'garden', hizbCompleted: 30 },
      { kind: 'garden', hizbCompleted: 40 },
      { kind: 'garden', hizbCompleted: 60 },
    ]);
  });

  it('show a garden of 59 hizb drying after 3, 6, 10 and 14 days, then coming back', () => {
    // Not the complete garden: the garden module keeps a garden of 60 hizb in full health.
    expect(ONBOARDING_PAGES_FULL.slice(6, 11).map((page) => page.scene)).toEqual([
      { kind: 'drought', hizbCompleted: 59, daysWithoutReading: 3 },
      { kind: 'drought', hizbCompleted: 59, daysWithoutReading: 6 },
      { kind: 'drought', hizbCompleted: 59, daysWithoutReading: 10 },
      { kind: 'drought', hizbCompleted: 59, daysWithoutReading: 14 },
      { kind: 'revival', hizbCompleted: 59, daysWithoutReading: 14 },
    ]);
  });

  it('say which garden each scene shows, and that the other scenes are not gardens', () => {
    expect(ONBOARDING_PAGES_FULL.map((page) => page.scene && gardenOfScene(page.scene))).toEqual([
      { hizbCompleted: 0, daysWithoutReading: 0, readsToday: false },
      { hizbCompleted: 8, daysWithoutReading: 0, readsToday: false },
      { hizbCompleted: 20, daysWithoutReading: 0, readsToday: false },
      { hizbCompleted: 30, daysWithoutReading: 0, readsToday: false },
      { hizbCompleted: 40, daysWithoutReading: 0, readsToday: false },
      { hizbCompleted: 60, daysWithoutReading: 0, readsToday: false },
      { hizbCompleted: 59, daysWithoutReading: 3, readsToday: false },
      { hizbCompleted: 59, daysWithoutReading: 6, readsToday: false },
      { hizbCompleted: 59, daysWithoutReading: 10, readsToday: false },
      { hizbCompleted: 59, daysWithoutReading: 14, readsToday: false },
      { hizbCompleted: 59, daysWithoutReading: 14, readsToday: true },
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it('give a scene to every page but the two that show settings', () => {
    for (const page of ONBOARDING_PAGES_FULL) {
      const showsSettings = page.kind === 'goal' || page.kind === 'reminders';
      expect(page.scene === null).toBe(showsSettings);
    }
  });

  it('keep the page about reading aloud apart, so that it can be replaced alone', () => {
    expect(
      ONBOARDING_PAGES_FULL.filter((page) => page.kind === 'voice').map((page) => page.id),
    ).toEqual(['voice']);
  });
});
