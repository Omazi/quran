import { quranStructure } from '@/data/quran';
import { DEFAULT_GARDEN_CONFIG, gardenVariant } from '@/domain/garden';
import { EMPTY_JOURNAL, recordPageRead, type ReadingJournal } from '@/domain/khatm';
import { addDays, parseLocalDate } from '@/domain/shared/local-date';
import { resolveResumePage } from '@/features/reader';

import {
  buildReadingHistory,
  READING_HISTORY_CONFIG,
  READING_HISTORIES,
  type ReadingHistoryName,
} from '../dev-preview/reading-histories';
import { buildHomeModel, type HomeModelInput, type HomeNotice } from '../home-model';
import { buildHomeModelOrUnavailable } from '../use-home-model';

const TODAY = parseLocalDate('2026-11-24');
const RANGES = quranStructure.hizbPageRanges();
const GOAL = READING_HISTORY_CONFIG.dailyGoalPages;
const LAST_PAGE_OF_GARDEN = RANGES[READING_HISTORY_CONFIG.gardenHizb - 1]?.lastPage ?? Number.NaN;
const PAGE_COUNT = RANGES[RANGES.length - 1]?.lastPage ?? Number.NaN;

/** The input of a preset as it would be on `today`. Building a journal reads it page by page. */
const inputs = new Map<ReadingHistoryName, HomeModelInput>();
function inputOf(preset: ReadingHistoryName): HomeModelInput {
  let input = inputs.get(preset);
  if (input === undefined) {
    input = { ...buildReadingHistory(preset, TODAY, RANGES), today: TODAY, hizbPageRanges: RANGES };
    inputs.set(preset, input);
  }
  return input;
}

const modelOf = (preset: ReadingHistoryName) => buildHomeModel(inputOf(preset));

function readToday(journal: ReadingJournal, firstPage: number, pageCount: number): ReadingJournal {
  let next = journal;
  for (let page = firstPage; page < firstPage + pageCount; page += 1) {
    next = recordPageRead(next, { page, date: TODAY });
  }
  return next;
}

describe('buildHomeModel, on every state of the garden', () => {
  it('new user: bare earth, nothing to resume, a whole khatma ahead', () => {
    const model = modelOf('bare-earth');
    expect(model.status).toBe('ready');
    expect(model.garden.phase).toBe('bare');
    expect(model.garden.hizbCompleted).toBe(0);
    expect(model.notice).toBe('bare');
    expect(model.streakDays).toBe(0);
    expect(model.today).toEqual({
      pagesRead: 0,
      goalPages: GOAL,
      pagesRemaining: GOAL,
      goalReached: false,
    });
    expect(model.reading).toEqual({
      khatm: 1,
      nextPage: 1,
      hasStarted: false,
      // The khatm module's rule: today's share today, then the rest at the pace of the goal.
      estimatedFinishDate: addDays(TODAY, Math.ceil((PAGE_COUNT - GOAL) / GOAL)),
      finishesToday: false,
    });
  });

  it('hizb 24, read every day: thriving, water flowing, no message', () => {
    const model = modelOf('thriving');
    expect(model.garden).toMatchObject({
      hizbCompleted: 24,
      phase: 'thriving',
      water: 'flowing',
      droughtDays: 0,
      isComplete: false,
    });
    // The scenario of the garden specification.
    expect(model.garden.lastUnlocked?.id).toBe('springs');
    expect(model.garden.nextElement?.element.id).toBe('tree-12');
    expect(model.garden.nextElement?.growth).toBeGreaterThan(0);
    expect(model.notice).toBeNull();
    expect(model.today).toMatchObject({
      pagesRead: READING_HISTORY_CONFIG.pagesReadToday,
      goalPages: GOAL,
      goalReached: false,
    });
    expect(model.reading).toMatchObject({
      khatm: 1,
      nextPage: LAST_PAGE_OF_GARDEN + READING_HISTORY_CONFIG.pagesReadToday + 1,
      hasStarted: true,
    });
    // Every day of the made-up history was read, today included.
    const daysBeforeToday = Math.ceil(
      LAST_PAGE_OF_GARDEN / READING_HISTORY_CONFIG.gardenPagesPerDay,
    );
    expect(model.streakDays).toBe(daysBeforeToday + 1);
  });

  const droughts: readonly (readonly [ReadingHistoryName, HomeNotice, number])[] = [
    ['thirsty', 'thirsty', DEFAULT_GARDEN_CONFIG.thirstyMinDroughtDays],
    ['wilting', 'wilting', DEFAULT_GARDEN_CONFIG.wiltingMinDroughtDays],
    ['dying', 'dying', DEFAULT_GARDEN_CONFIG.dyingMinDroughtDays],
    ['dead', 'dead', DEFAULT_GARDEN_CONFIG.droughtDaysToDeath],
  ];

  it.each(droughts)(
    '%s: the garden shows its drought and keeps its hizb',
    (preset, notice, days) => {
      const model = modelOf(preset);
      expect(model.garden.phase).toBe(notice);
      expect(model.garden.droughtDays).toBe(days);
      expect(model.garden.water).toBe('dry');
      expect(model.garden.hizbCompleted).toBe(24);
      expect(model.garden.lastUnlocked?.id).toBe('springs');
      expect(model.notice).toBe(notice);
      expect(model.streakDays).toBe(0);
      expect(model.today.pagesRead).toBe(0);
      expect(model.reading).toMatchObject({ nextPage: LAST_PAGE_OF_GARDEN + 1, hasStarted: true });
    },
  );

  it('dying hides the last elements; dead hides them all', () => {
    expect(modelOf('wilting').garden.visibleElements).toHaveLength(24);
    expect(modelOf('dying').garden.visibleElements).toHaveLength(20);
    expect(modelOf('dead').garden.visibleElements).toHaveLength(0);
  });

  it('khatma complete: the full garden stays, and the next khatma is ready to start', () => {
    const model = modelOf('khatma-complete');
    expect(model.garden).toMatchObject({
      hizbCompleted: 60,
      isComplete: true,
      phase: 'thriving',
      water: 'flowing',
    });
    expect(model.garden.visibleElements).toHaveLength(60);
    expect(model.garden.nextElement).toBeNull();
    expect(model.garden.variant).toEqual(gardenVariant(1, READING_HISTORY_CONFIG.userSeed));
    expect(model.notice).toBe('complete');
    expect(model.today.pagesRead).toBe(PAGE_COUNT % READING_HISTORY_CONFIG.khatmaPagesPerDay);
    expect(model.reading).toMatchObject({ khatm: 2, nextPage: 1, hasStarted: false });
    expect(model.reading.estimatedFinishDate).not.toBeNull();
  });

  it.each(READING_HISTORIES)('%s: the same input always gives the same model', (preset) => {
    expect(buildHomeModel(inputOf(preset))).toEqual(buildHomeModel(inputOf(preset)));
  });

  it.each(READING_HISTORIES)('%s: the garden is the one of this person and khatma', (preset) => {
    const { garden } = modelOf(preset);
    expect(garden.variant).toEqual(gardenVariant(1, READING_HISTORY_CONFIG.userSeed));
  });
});

describe('buildHomeModel, at the edges', () => {
  it('day boundary: the next morning the count restarts and nothing is lost yet', () => {
    const today = modelOf('thriving');
    const tomorrow = buildHomeModel({ ...inputOf('thriving'), today: addDays(TODAY, 1) });
    expect(tomorrow.today.pagesRead).toBe(0);
    // The day in progress never penalises: same streak, same garden, water still flowing.
    expect(tomorrow.streakDays).toBe(today.streakDays);
    expect(tomorrow.garden.phase).toBe('thriving');
    expect(tomorrow.garden.water).toBe('flowing');
    expect(tomorrow.notice).toBeNull();
    expect(tomorrow.reading.nextPage).toBe(today.reading.nextPage);
  });

  it('day boundary: one missed day stills the water without a message', () => {
    const later = buildHomeModel({ ...inputOf('thriving'), today: addDays(TODAY, 2) });
    expect(later.garden.water).toBe('still');
    expect(later.garden.phase).toBe('thriving');
    expect(later.notice).toBeNull();
    expect(later.streakDays).toBe(0);
  });

  it('a page read during a drought is told as a recovery, not as a warning', () => {
    const input = inputOf('dead');
    const journal = readToday(input.journal, LAST_PAGE_OF_GARDEN + 1, 1);
    const model = buildHomeModel({ ...input, journal });
    expect(model.garden.water).toBe('flowing');
    expect(model.garden.droughtDays).toBe(
      DEFAULT_GARDEN_CONFIG.droughtDaysToDeath -
        DEFAULT_GARDEN_CONFIG.droughtDaysRecoveredPerWateredDay,
    );
    expect(model.garden.phase).toBe('dying');
    expect(model.notice).toBe('recovering');
    expect(model.streakDays).toBe(1);
  });

  it('pause: paused days neither dry the garden nor break the streak', () => {
    const input = inputOf('wilting');
    const days = DEFAULT_GARDEN_CONFIG.wiltingMinDroughtDays;
    const pauses = [{ from: addDays(TODAY, -days), to: TODAY }];
    const model = buildHomeModel({ ...input, settings: { ...input.settings, pauses } });
    expect(model.garden.phase).toBe('thriving');
    expect(model.garden.droughtDays).toBe(0);
    expect(model.garden.isPausedToday).toBe(true);
    expect(model.notice).toBeNull();
    expect(model.streakDays).toBeGreaterThan(0);
  });

  it('goal reached: the model says so once the pages of the day are read', () => {
    const input = inputOf('thriving');
    const missing = GOAL - READING_HISTORY_CONFIG.pagesReadToday;
    const firstUnread = LAST_PAGE_OF_GARDEN + READING_HISTORY_CONFIG.pagesReadToday + 1;
    const model = buildHomeModel({
      ...input,
      journal: readToday(input.journal, firstUnread, missing),
    });
    expect(model.today).toMatchObject({ pagesRead: GOAL, pagesRemaining: 0, goalReached: true });
  });

  it('the first page after a complete khatma opens a new garden on bare earth', () => {
    const input = inputOf('khatma-complete');
    const model = buildHomeModel({ ...input, journal: readToday(input.journal, 1, 1) });
    expect(model.garden.phase).toBe('bare');
    expect(model.garden.hizbCompleted).toBe(0);
    expect(model.garden.variant).toEqual(gardenVariant(2, READING_HISTORY_CONFIG.userSeed));
    expect(model.notice).toBe('bare');
    expect(model.reading).toMatchObject({ khatm: 2, nextPage: 2, hasStarted: true });
  });

  it('the last pages of a khatma are estimated for today', () => {
    let journal = EMPTY_JOURNAL;
    const yesterday = addDays(TODAY, -1);
    for (let page = 1; page <= PAGE_COUNT - GOAL; page += 1) {
      journal = recordPageRead(journal, { page, date: yesterday });
    }
    const model = buildHomeModel({ ...inputOf('bare-earth'), journal });
    expect(model.reading).toMatchObject({
      nextPage: PAGE_COUNT - GOAL + 1,
      estimatedFinishDate: TODAY,
      finishesToday: true,
    });
  });

  it('a page dated after today (time-zone change) does not break the screen', () => {
    const journal = recordPageRead(EMPTY_JOURNAL, { page: 1, date: addDays(TODAY, 1) });
    const model = buildHomeModel({ ...inputOf('bare-earth'), journal });
    expect(model.garden.phase).toBe('bare');
    expect(model.today.pagesRead).toBe(0);
    expect(model.reading).toMatchObject({ nextPage: 2, hasStarted: true });
  });

  it.each([0, -1, 2.5])('refuses a daily goal of %p pages', (dailyGoalPages) => {
    const input = inputOf('thriving');
    expect(() =>
      buildHomeModel({ ...input, settings: { ...input.settings, dailyGoalPages } }),
    ).toThrow(RangeError);
  });

  it('refuses a damaged journal and incomplete hizb ranges', () => {
    const input = inputOf('thriving');
    const twice = [...input.journal, ...input.journal.slice(0, 1)];
    expect(() => buildHomeModel({ ...input, journal: twice })).toThrow(RangeError);
    expect(() => buildHomeModel({ ...input, hizbPageRanges: RANGES.slice(0, 59) })).toThrow(
      RangeError,
    );
  });
});

describe("the page to resume, the same as the reader's", () => {
  const withLastOpened = (lastOpenedPage: number | null) => {
    const input = inputOf('thriving');
    return buildHomeModel({ ...input, settings: { ...input.settings, lastOpenedPage } });
  };

  it('is the first unread page while the reader was never opened', () => {
    const input = inputOf('thriving');
    const expected = resolveResumePage({
      lastOpenedPage: null,
      journal: input.journal,
      hizbPageRanges: RANGES,
    });
    expect(withLastOpened(null).reading.nextPage).toBe(expected);
    expect(expected).toBe(LAST_PAGE_OF_GARDEN + READING_HISTORY_CONFIG.pagesReadToday + 1);
  });

  it.each([1, 293, 604])('is the last page opened in the reader: page %i', (page) => {
    const input = inputOf('thriving');
    const model = withLastOpened(page);
    expect(model.reading.nextPage).toBe(
      resolveResumePage({ lastOpenedPage: page, journal: input.journal, hizbPageRanges: RANGES }),
    );
    expect(model.reading.nextPage).toBe(page);
    expect(model.reading.hasStarted).toBe(true);
  });

  it('counts a person who opened the reader without reading as someone who resumes', () => {
    const input = inputOf('bare-earth');
    const model = buildHomeModel({
      ...input,
      settings: { ...input.settings, lastOpenedPage: 12 },
    });
    expect(model.reading).toMatchObject({ nextPage: 12, hasStarted: true });
  });

  it('refuses a page outside the book', () => {
    const input = inputOf('thriving');
    expect(() =>
      buildHomeModel({ ...input, settings: { ...input.settings, lastOpenedPage: 605 } }),
    ).toThrow(RangeError);
  });
});

describe('buildHomeModelOrUnavailable', () => {
  afterEach(() => jest.restoreAllMocks());

  it('gives the model when it can be built', () => {
    expect(buildHomeModelOrUnavailable(inputOf('thriving'))).toEqual(modelOf('thriving'));
  });

  it('says the screen is unavailable, and logs why, instead of crashing', () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    const input = inputOf('thriving');
    const model = buildHomeModelOrUnavailable({
      ...input,
      settings: { ...input.settings, dailyGoalPages: 0 },
    });
    expect(model).toEqual({ status: 'unavailable' });
    expect(logged).toHaveBeenCalledWith(expect.any(String), expect.any(RangeError));
  });
});
