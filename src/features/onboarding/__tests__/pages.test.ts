import {
  ONBOARDING_LENGTH,
  ONBOARDING_PAGES,
  ONBOARDING_PAGES_FULL,
  ONBOARDING_PAGES_SHORT,
  SHIPPED_FEATURES,
  onboardingPages,
  sceneCaption,
  type OnboardingFeature,
  type OnboardingPage,
} from '../pages';
import ar from '../../../i18n/locales/ar/onboarding.json';
import en from '../../../i18n/locales/en/onboarding.json';
import fr from '../../../i18n/locales/fr/onboarding.json';
import { gardenOfScene } from '../scene';

const EVERY_FEATURE: ReadonlySet<OnboardingFeature> = new Set(['voice', 'recognition', 'friends']);

function ids(pages: readonly OnboardingPage[]): string[] {
  return pages.map((page) => page.id);
}

describe('pages of the first-launch flow', () => {
  it('tell, in the full flow, the story of the validated prototype: growth to completion, drought, revival, then listening, the following of the recitation and friends', () => {
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
      'recognition',
      'voice',
      'friends',
      'goal',
      'reminders',
    ]);
  });

  it('keep, in the short flow, the page that states the rule, "read and the water flows"', () => {
    expect(ids(ONBOARDING_PAGES_SHORT)).toEqual([
      'bareEarth',
      'hizb8',
      'hizb60',
      'thirsty',
      'dead',
      'revival',
      'recognition',
      'voice',
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

  it('show the garden growing from the bare earth to hizb 8, 20, 30, 40 and 60, one picture a page', () => {
    expect(ONBOARDING_PAGES_FULL.slice(0, 6).map((page) => page.scene)).toEqual([
      { kind: 'garden', hizbCompleted: 0 },
      { kind: 'garden', hizbCompleted: 8 },
      { kind: 'garden', hizbCompleted: 20 },
      { kind: 'garden', hizbCompleted: 30 },
      { kind: 'garden', hizbCompleted: 40 },
      { kind: 'garden', hizbCompleted: 60 },
    ]);
  });

  it('then dry a garden on its way, of 40 hizb, after 3, 6, 10 and 14 days, and bring it back', () => {
    expect(ONBOARDING_PAGES_FULL.slice(6, 11).map((page) => page.scene)).toEqual([
      { kind: 'drought', hizbCompleted: 40, daysWithoutReading: 3 },
      { kind: 'drought', hizbCompleted: 40, daysWithoutReading: 6 },
      { kind: 'drought', hizbCompleted: 40, daysWithoutReading: 10 },
      { kind: 'drought', hizbCompleted: 40, daysWithoutReading: 14 },
      { kind: 'revival', hizbCompleted: 40, daysWithoutReading: 14 },
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
      { hizbCompleted: 60, daysWithoutReading: 0, readsToday: false },
      { hizbCompleted: 40, daysWithoutReading: 3, readsToday: false },
      { hizbCompleted: 40, daysWithoutReading: 6, readsToday: false },
      { hizbCompleted: 40, daysWithoutReading: 10, readsToday: false },
      { hizbCompleted: 40, daysWithoutReading: 14, readsToday: false },
      { hizbCompleted: 40, daysWithoutReading: 14, readsToday: true },
      null,
      null,
      null,
      // The goal page shows the bare earth again, small: the garden the person is about to start.
      { hizbCompleted: 0, daysWithoutReading: 0, readsToday: false },
      null,
    ]);
    expect(gardenOfScene({ kind: 'feature', feature: 'voice' })).toBeNull();
  });

  it('give a scene to every page but the reminders, which show their notifications instead', () => {
    for (const page of onboardingPages('full', EVERY_FEATURE)) {
      expect(page.scene === null).toBe(page.kind === 'reminders');
    }
  });

  it('show the scene at full size on the story, small above the goal, and none on the reminders', () => {
    const stages = Object.fromEntries(
      onboardingPages('full', EVERY_FEATURE).map((page) => [page.id, page.stage]),
    );
    expect(stages).toMatchObject({ bareEarth: 'full', revival: 'full', friends: 'full' });
    expect(stages.goal).toBe('small');
    expect(stages.reminders).toBe('none');
  });
});

describe('look of each page, as the prototype paints it', () => {
  const byId = (id: string) => {
    const page = onboardingPages('full', EVERY_FEATURE).find((candidate) => candidate.id === id);
    if (page === undefined) throw new Error(`No page ${id}.`);
    return page;
  };

  it('keeps the warm sky of the welcome mockup under the growing garden', () => {
    for (const id of ['bareEarth', 'hizb8', 'hizb40', 'revival', 'goal', 'reminders']) {
      expect(byId(id).backdrop).toEqual({});
    }
    // The complete garden under the sunrise of the completed khatma (khatm.png).
    expect(byId('hizb60').backdrop).toEqual({ complete: 1 });
  });

  it('drains the sky to grey, a little more each day without reading, down to dust', () => {
    expect(byId('thirsty').backdrop).toEqual({ thirsty: 0.5 });
    expect(byId('wilting').backdrop).toEqual({ thirsty: 1 });
    expect(byId('dying').backdrop).toEqual({ thirsty: 1, dead: 0.6 });
    expect(byId('dead').backdrop).toEqual({ thirsty: 1, dead: 1 });
  });

  it('sets listening on deep green and friends on a paler sky', () => {
    expect(byId('recognition').backdrop).toEqual({ listening: 1 });
    expect(byId('friends').backdrop).toEqual({ together: 1 });
  });

  it('writes in light words on the deep green, in earth tones on dust, in the garden tones elsewhere', () => {
    expect(byId('recognition').words).toBe('deep');
    // The following of the recitation sits on the warm sky, on the paper of the reader.
    expect(byId('voice').backdrop).toEqual({});
    for (const id of ['thirsty', 'wilting', 'dying', 'dead']) expect(byId(id).words).toBe('dust');
    for (const id of ['bareEarth', 'hizb60', 'revival', 'voice', 'friends', 'goal', 'reminders']) {
      expect(byId(id).words).toBe('garden');
    }
  });

  it('labels each picture of the garden with what it shows, in a short caption', () => {
    expect(sceneCaption(byId('bareEarth'))).toBeNull();
    expect(sceneCaption(byId('hizb20'))).toEqual({ key: 'captions.hizb', values: { hizb: 20 } });
    expect(sceneCaption(byId('dying'))).toEqual({ key: 'captions.drought', values: { count: 10 } });
    expect(sceneCaption(byId('revival'))).toEqual({ key: 'captions.revival', values: {} });
    expect(sceneCaption(byId('recognition'))).toBeNull();
    expect(sceneCaption(byId('goal'))).toBeNull();
  });
});

describe('pages about features', () => {
  it('present listening, the following of the recitation and friends', () => {
    expect([...SHIPPED_FEATURES].sort()).toEqual(['friends', 'recognition', 'voice']);
    for (const pages of [ONBOARDING_PAGES_FULL, ONBOARDING_PAGES_SHORT]) {
      expect(pages.filter((page) => page.feature === 'voice')).toHaveLength(1);
    }
  });

  it('put the following of the recitation right after the listening, in both flows', () => {
    for (const pages of [ONBOARDING_PAGES_FULL, ONBOARDING_PAGES_SHORT]) {
      const order = ids(pages);
      expect(order.indexOf('voice')).toBe(order.indexOf('recognition') + 1);
    }
  });

  it('are all still written, and a page leaves the flow when its feature is taken out', () => {
    expect(ids(onboardingPages('full', EVERY_FEATURE))).toEqual([
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
      'recognition',
      'voice',
      'friends',
      'goal',
      'reminders',
    ]);
    expect(ids(onboardingPages('short', EVERY_FEATURE))).toEqual([
      'bareEarth',
      'hizb8',
      'hizb60',
      'thirsty',
      'dead',
      'revival',
      'recognition',
      'voice',
      'goal',
      'reminders',
    ]);
  });

  it('come back one by one: a page appears only for its own feature', () => {
    expect(ids(onboardingPages('full', new Set(['recognition'])))).toContain('recognition');
    expect(ids(onboardingPages('full', new Set([])))).not.toContain('recognition');
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

describe('sentences of the pages', () => {
  const NO_BREAK_SPACE = '\u00a0';
  const LOCALES = [
    ['fr', fr],
    ['en', en],
    ['ar', ar],
  ] as const;

  // A last line of one word reads as a mistake: the last two words of every sentence stay together.
  it.each(LOCALES)('%s: the last two words of a sentence never part', (_language, strings) => {
    for (const [name, page] of Object.entries(strings.pages)) {
      const words = page.text.split(/[ \u00a0]/);
      expect(words.length).toBeGreaterThan(2);
      expect(page.text.slice(-words.at(-1)!.length - 1, -words.at(-1)!.length)).toBe(
        NO_BREAK_SPACE,
      );
      expect(name).toBeTruthy();
    }
  });

  it('keeps "et il ne reste rien" in one piece, so "il" does not hang at the end of a line', () => {
    expect(fr.pages.dead.text).toBe(
      `Deux semaines sans lecture, et${NO_BREAK_SPACE}il${NO_BREAK_SPACE}ne${NO_BREAK_SPACE}reste${NO_BREAK_SPACE}rien.`,
    );
  });
});
