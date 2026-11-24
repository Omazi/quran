/**
 * Acceptance tests of invalid input (docs/specs/khatm.md, "Entrées invalides": page outside
 * 1..604, khatma < 1, invalid date, goal < 1, incomplete hizb ranges → explicit error;
 * docs/CONTRIBUTING.md: RangeError or TypeError, never a silently corrected value).
 */
import {
  DEFAULT_KHATM_CONFIG,
  EMPTY_JOURNAL,
  estimateFinishDate,
  getBadges,
  getCurrentKhatm,
  getGardenFeed,
  getKhatmProgress,
  getReadPages,
  getStreak,
  getTodayProgress,
  getWateredDays,
  isPageRead,
  recordPageRead,
  type HizbPageRange,
  type KhatmConfig,
  type ReadingEntry,
  type ReadingJournal,
} from '@/domain/khatm';

import {
  day,
  expectExplicitError,
  journalOfDailyCounts,
  seededRandom,
  shuffled,
  storedKhatmaEntries,
  TESTER_HIZB_RANGES,
  uncheckedDate,
} from './acceptance-kit';

const TODAY = day('2026-03-15');
const YESTERDAY = day('2026-03-14');
const SOME_JOURNAL = journalOfDailyCounts([
  [YESTERDAY, 3],
  [TODAY, 2],
]);

const INVALID_PAGES = [0, 605, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY];
const INVALID_KHATMAS = [0, -1, 1.5, Number.NaN];
const INVALID_GOALS = [0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY];
const INVALID_DATES = [
  '2026-02-30', // no such day
  '2026-02-29', // 2026 is not a leap year
  '2100-02-29', // nor is 2100, although it can be divided by 4
  '2026-13-01',
  '2026-00-10',
  '2026-04-31',
  '2026-3-5',
  '2026-03-15T10:00:00',
  '15/03/2026',
  ' 2026-03-15',
  '2026-03-15\n',
  '２０２６-03-15', // full-width digits
  'today',
  '',
];

/** The tester's ranges with one of them replaced. */
function rangesWith(replacement: HizbPageRange, index: number): HizbPageRange[] {
  return TESTER_HIZB_RANGES.map((range, position) => (position === index ? replacement : range));
}

const INVALID_HIZB_RANGES: readonly (readonly [string, readonly HizbPageRange[]])[] = [
  ['no range at all', []],
  ['59 ranges (hizb 60 is missing)', TESTER_HIZB_RANGES.slice(0, 59)],
  ['59 ranges (hizb 1 is missing)', TESTER_HIZB_RANGES.slice(1)],
  ['61 ranges', [...TESTER_HIZB_RANGES, { hizb: 61, firstPage: 604, lastPage: 604 }]],
  ['a page covered by no hizb (22)', rangesWith({ hizb: 3, firstPage: 23, lastPage: 32 }, 2)],
  ['ranges that do not start at page 1', rangesWith({ hizb: 1, firstPage: 2, lastPage: 11 }, 0)],
  ['ranges that start at page 0', rangesWith({ hizb: 1, firstPage: 0, lastPage: 11 }, 0)],
  ['ranges that stop at page 603', rangesWith({ hizb: 60, firstPage: 595, lastPage: 603 }, 59)],
  ['ranges that go to page 605', rangesWith({ hizb: 60, firstPage: 595, lastPage: 605 }, 59)],
  ['a range written backwards', rangesWith({ hizb: 4, firstPage: 43, lastPage: 33 }, 3)],
  ['a hizb number used twice', rangesWith({ hizb: 5, firstPage: 55, lastPage: 65 }, 5)],
  ['a hizb numbered 0', rangesWith({ hizb: 0, firstPage: 1, lastPage: 11 }, 0)],
  ['a hizb numbered 61', rangesWith({ hizb: 61, firstPage: 595, lastPage: 604 }, 59)],
  ['a page that is not a whole number', rangesWith({ hizb: 3, firstPage: 22.5, lastPage: 32 }, 2)],
  [
    'a first page that is not a number',
    rangesWith({ hizb: 3, firstPage: Number.NaN, lastPage: 32 }, 2),
  ],
  ['a hizb number that is not whole', rangesWith({ hizb: 3.5, firstPage: 22, lastPage: 32 }, 2)],
  [
    'two hizb sharing two pages (10 and 11)',
    rangesWith({ hizb: 2, firstPage: 10, lastPage: 21 }, 1),
  ],
  ['a negative page', rangesWith({ hizb: 1, firstPage: -1, lastPage: 11 }, 0)],
];

describe('Entrées invalides — page hors de 1..604', () => {
  it.each(INVALID_PAGES)('recordPageRead rejects page %p', (page) => {
    expectExplicitError(() => recordPageRead(EMPTY_JOURNAL, { page, date: TODAY }));
  });

  it.each(INVALID_PAGES)('isPageRead rejects page %p', (page) => {
    expectExplicitError(() => isPageRead(SOME_JOURNAL, 1, page));
  });

  it('a rejected page leaves no trace: the journal can still be used', () => {
    expectExplicitError(() => recordPageRead(SOME_JOURNAL, { page: 605, date: TODAY }));

    expect(SOME_JOURNAL).toHaveLength(5);
    expect(recordPageRead(SOME_JOURNAL, { page: 604, date: TODAY })).toHaveLength(6);
  });
});

describe('Entrées invalides — khatma < 1', () => {
  it.each(INVALID_KHATMAS)('getReadPages rejects khatma %p', (khatm) => {
    expectExplicitError(() => getReadPages(SOME_JOURNAL, khatm));
  });

  it.each(INVALID_KHATMAS)('isPageRead rejects khatma %p', (khatm) => {
    expectExplicitError(() => isPageRead(SOME_JOURNAL, khatm, 1));
  });

  it.each(INVALID_KHATMAS)('getKhatmProgress rejects khatma %p', (khatm) => {
    expectExplicitError(() => getKhatmProgress(SOME_JOURNAL, khatm, TESTER_HIZB_RANGES));
  });

  it.each(INVALID_KHATMAS)('estimateFinishDate rejects khatma %p', (khatm) => {
    expectExplicitError(() =>
      estimateFinishDate(SOME_JOURNAL, khatm, TODAY, { kind: 'daily-goal', dailyGoalPages: 5 }),
    );
  });
});

describe('Entrées invalides — date invalide', () => {
  it.each(INVALID_DATES)('recordPageRead rejects the date %p', (value) => {
    expectExplicitError(() =>
      recordPageRead(EMPTY_JOURNAL, { page: 1, date: uncheckedDate(value) }),
    );
  });

  it.each(INVALID_DATES)('getTodayProgress rejects today = %p', (value) => {
    expectExplicitError(() => getTodayProgress(SOME_JOURNAL, uncheckedDate(value), 5));
  });

  it.each(INVALID_DATES)('getStreak rejects today = %p', (value) => {
    expectExplicitError(() => getStreak(SOME_JOURNAL, uncheckedDate(value)));
  });

  it.each(INVALID_DATES)('estimateFinishDate rejects today = %p', (value) => {
    expectExplicitError(() =>
      estimateFinishDate(SOME_JOURNAL, 1, uncheckedDate(value), {
        kind: 'daily-goal',
        dailyGoalPages: 5,
      }),
    );
  });

  it.each(['2026-02-30', 'today', ''])('getStreak rejects a pause starting on %p', (value) => {
    expectExplicitError(() =>
      getStreak(SOME_JOURNAL, TODAY, [{ from: uncheckedDate(value), to: TODAY }]),
    );
  });

  it.each(['2026-02-30', 'today', ''])('getStreak rejects a pause ending on %p', (value) => {
    expectExplicitError(() =>
      getStreak(SOME_JOURNAL, TODAY, [{ from: YESTERDAY, to: uncheckedDate(value) }]),
    );
  });

  it('getStreak rejects an invalid pause even when it comes after a valid one', () => {
    expectExplicitError(() =>
      getStreak(SOME_JOURNAL, TODAY, [
        { from: YESTERDAY, to: YESTERDAY },
        { from: uncheckedDate('2026-02-30'), to: uncheckedDate('2026-02-31') },
      ]),
    );
  });

  it('a pause written backwards (from after to) is not silently accepted as a real pause', () => {
    // Not in the spec's list; docs/CONTRIBUTING.md forbids a silently corrected value. An
    // explicit error is fine, and so is ignoring the empty period; treating the 13th and
    // the 14th as paused is not.
    const journal = journalOfDailyCounts([
      [day('2026-03-12'), 1],
      [TODAY, 1],
    ]);
    const backwards = [{ from: YESTERDAY, to: day('2026-03-13') }];

    let streak: number | null = null;
    try {
      streak = getStreak(journal, TODAY, backwards);
    } catch (error) {
      expect(error instanceof RangeError || error instanceof TypeError).toBe(true);
    }
    expect([null, 1]).toContain(streak);
  });
});

describe('Entrées invalides — objectif < 1', () => {
  it.each(INVALID_GOALS)('getTodayProgress rejects a goal of %p pages', (goal) => {
    expectExplicitError(() => getTodayProgress(SOME_JOURNAL, TODAY, goal));
  });

  it.each(INVALID_GOALS)('estimateFinishDate rejects a daily goal of %p pages', (goal) => {
    expectExplicitError(() =>
      estimateFinishDate(SOME_JOURNAL, 1, TODAY, { kind: 'daily-goal', dailyGoalPages: goal }),
    );
  });
});

describe('Entrées invalides — plages de hizb incomplètes', () => {
  it.each(INVALID_HIZB_RANGES)('getKhatmProgress rejects %s', (_name, ranges) => {
    expectExplicitError(() => getKhatmProgress(SOME_JOURNAL, 1, ranges));
  });

  it.each(INVALID_HIZB_RANGES)('getGardenFeed rejects %s', (_name, ranges) => {
    expectExplicitError(() => getGardenFeed(SOME_JOURNAL, ranges));
  });

  it.each(INVALID_HIZB_RANGES)(
    'getGardenFeed rejects %s, even on an empty journal',
    (_n, ranges) => {
      expectExplicitError(() => getGardenFeed(EMPTY_JOURNAL, ranges));
    },
  );

  it('the 60 valid ranges handed in another order: an explicit error or the same answer', () => {
    // The spec does not say whether the order matters. A wrong answer is the only failure.
    const mixed = shuffled(TESTER_HIZB_RANGES, seededRandom(60));
    const expected = getKhatmProgress(SOME_JOURNAL, 1, TESTER_HIZB_RANGES);

    let answer: unknown = 'rejected';
    try {
      answer = getKhatmProgress(SOME_JOURNAL, 1, mixed);
    } catch (error) {
      expect(error instanceof RangeError || error instanceof TypeError).toBe(true);
    }
    expect(['rejected', expected]).toContainEqual(answer);
  });
});

describe('Entrées invalides — configuration', () => {
  const INVALID_SETTINGS = [0, -1, 1.5, Number.NaN];

  function configWith(change: Partial<KhatmConfig>): KhatmConfig {
    return { ...DEFAULT_KHATM_CONFIG, ...change };
  }

  it.each(INVALID_SETTINGS)('getWateredDays rejects minPagesPerWateredDay = %p', (value) => {
    expectExplicitError(() =>
      getWateredDays(SOME_JOURNAL, configWith({ minPagesPerWateredDay: value })),
    );
  });

  it.each(INVALID_SETTINGS)('getStreak rejects minPagesPerWateredDay = %p', (value) => {
    expectExplicitError(() =>
      getStreak(SOME_JOURNAL, TODAY, [], configWith({ minPagesPerWateredDay: value })),
    );
  });

  it.each(INVALID_SETTINGS)('getGardenFeed rejects minPagesPerWateredDay = %p', (value) => {
    expectExplicitError(() =>
      getGardenFeed(SOME_JOURNAL, TESTER_HIZB_RANGES, configWith({ minPagesPerWateredDay: value })),
    );
  });

  it.each(INVALID_SETTINGS)('estimateFinishDate rejects averagePaceWindowDays = %p', (value) => {
    expectExplicitError(() =>
      estimateFinishDate(
        SOME_JOURNAL,
        1,
        TODAY,
        { kind: 'recent-average' },
        configWith({ averagePaceWindowDays: value }),
      ),
    );
  });
});

describe('Entrées invalides — a damaged journal is rejected by every function', () => {
  const entry = (khatm: number, page: number, date: string): ReadingEntry => ({
    khatm,
    page,
    date: uncheckedDate(date),
  });

  const DAMAGED_JOURNALS: readonly (readonly [string, ReadingJournal])[] = [
    ['the same (khatm, page) twice', [entry(1, 5, '2026-03-01'), entry(1, 5, '2026-03-02')]],
    ['a page 605', [entry(1, 605, '2026-03-01')]],
    ['a page 0', [entry(1, 0, '2026-03-01')]],
    ['a page 1.5', [entry(1, 1.5, '2026-03-01')]],
    ['a khatma 0', [entry(0, 1, '2026-03-01')]],
    ['a khatma 1.5', [entry(1.5, 1, '2026-03-01')]],
    ['the impossible date 2026-02-30', [entry(1, 1, '2026-02-30')]],
    ['a date that is not a date', [entry(1, 1, 'yesterday')]],
    ['a khatma 2 without khatma 1', [entry(2, 1, '2026-03-01')]],
    [
      'a khatma 2 started while khatma 1 is unfinished',
      [entry(1, 1, '2026-03-01'), entry(2, 1, '2026-03-02')],
    ],
    [
      'a gap in the khatma numbers (1 complete, then 3)',
      [...storedKhatmaEntries(1, day('2026-03-01')), entry(3, 1, '2026-03-02')],
    ],
    [
      '604 entries in khatma 1 but only 603 pages (one twice), then khatma 2',
      [
        ...storedKhatmaEntries(1, day('2026-03-01')).slice(1),
        entry(1, 604, '2026-03-02'),
        entry(2, 1, '2026-03-03'),
      ],
    ],
  ];

  const FUNCTIONS: readonly (readonly [string, (journal: ReadingJournal) => unknown])[] = [
    ['recordPageRead', (journal) => recordPageRead(journal, { page: 9, date: TODAY })],
    ['getCurrentKhatm', (journal) => getCurrentKhatm(journal)],
    ['getReadPages', (journal) => getReadPages(journal, 1)],
    ['isPageRead', (journal) => isPageRead(journal, 1, 9)],
    ['getKhatmProgress', (journal) => getKhatmProgress(journal, 1, TESTER_HIZB_RANGES)],
    ['getTodayProgress', (journal) => getTodayProgress(journal, TODAY, 5)],
    ['getWateredDays', (journal) => getWateredDays(journal)],
    ['getStreak', (journal) => getStreak(journal, TODAY)],
    [
      'estimateFinishDate',
      (journal) => estimateFinishDate(journal, 1, TODAY, { kind: 'daily-goal', dailyGoalPages: 5 }),
    ],
    ['getBadges', (journal) => getBadges(journal)],
    ['getGardenFeed', (journal) => getGardenFeed(journal, TESTER_HIZB_RANGES)],
  ];

  describe.each(DAMAGED_JOURNALS)('journal with %s', (_name, journal) => {
    it.each(FUNCTIONS)('%s throws an explicit error', (_functionName, call) => {
      expectExplicitError(() => call(journal));
    });
  });
});

describe('Entrées invalides — a journal that storage handed back in the wrong shape', () => {
  // The journal is the only input that comes back from storage. A value of the wrong shape
  // can only reach the module untyped, hence the casts: `as` on purpose in this block.
  const NOT_A_JOURNAL = null as unknown as ReadingJournal;
  const JOURNAL_WITH_A_HOLE = [null] as unknown as ReadingJournal;
  const JOURNAL_OF_TEXT = ['1:5:2026-03-01'] as unknown as ReadingJournal;

  it.each([
    ['null instead of a journal', NOT_A_JOURNAL],
    ['a null entry', JOURNAL_WITH_A_HOLE],
    ['an entry that is a text', JOURNAL_OF_TEXT],
  ])('%s is rejected with an explicit error, not an engine error', (_name, journal) => {
    expectExplicitError(() => getCurrentKhatm(journal));
    expectExplicitError(() => recordPageRead(journal, { page: 1, date: TODAY }));
    expectExplicitError(() => getBadges(journal));
  });

  it('an entry without a date is rejected', () => {
    const withoutDate = [{ khatm: 1, page: 5 }] as unknown as ReadingJournal;

    expectExplicitError(() => getWateredDays(withoutDate));
  });

  it('an entry whose numbers are texts is rejected', () => {
    const texts = [{ khatm: '1', page: '5', date: '2026-03-01' }] as unknown as ReadingJournal;

    expectExplicitError(() => getCurrentKhatm(texts));
  });
});
