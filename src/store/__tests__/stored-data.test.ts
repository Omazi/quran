import { EMPTY_JOURNAL, recordPageRead, type ReadingJournal } from '@/domain/khatm';
import { parseLocalDate } from '@/domain/shared/local-date';

import { DEFAULT_REMINDERS, MAX_PAUSES, STORED_DATA_VERSION, STORED_DATE_RANGE } from '../config';
import { readStoredData, writeStoredData } from '../stored-data';
import type { AppData, AppSettings } from '../types';

const SETTINGS: AppSettings = {
  language: 'ar',
  dailyGoalPages: 12,
  onboardingCompleted: true,
  userSeed: 123_456_789,
  lastOpenedPage: 293,
  bookmarks: [18, 293, 604],
  pauses: [{ from: parseLocalDate('2026-03-01'), to: parseLocalDate('2026-03-04') }],
  reminders: {
    dailyEnabled: false,
    dailyTime: { hour: 6, minute: 5 },
    thirstyGardenEnabled: true,
    fridayKahfEnabled: false,
    fridayTime: { hour: 7, minute: 45 },
    quietHours: { from: { hour: 22, minute: 0 }, to: { hour: 7, minute: 0 } },
  },
};

const JOURNAL: ReadingJournal = [1, 2, 3].reduce(
  (journal, page) => recordPageRead(journal, { page, date: parseLocalDate('2026-11-24') }),
  EMPTY_JOURNAL,
);

const DATA: AppData = { settings: SETTINGS, journal: JOURNAL, timeSpent: {} };

/** The stored document with one part replaced, as text. */
function documentWith(change: Record<string, unknown>): string {
  return JSON.stringify({
    version: STORED_DATA_VERSION,
    settings: SETTINGS,
    journal: JOURNAL,
    ...change,
  });
}

function settingsWith(change: Record<string, unknown>): string {
  return documentWith({ settings: { ...SETTINGS, ...change } });
}

describe('stored document', () => {
  it('reads back exactly what was written', () => {
    expect(readStoredData(writeStoredData(DATA))).toEqual({
      ...DATA,
      discarded: [],
      wasUpgraded: false,
    });
  });

  it('writes the version, the settings, the journal and the time, and nothing else', () => {
    const state = { ...DATA, setLanguage: () => {}, somethingElse: 'x' };
    expect(JSON.parse(writeStoredData(state))).toEqual({
      version: STORED_DATA_VERSION,
      settings: SETTINGS,
      journal: JOURNAL,
      timeSpent: {},
    });
  });

  it('finds nothing, and discards nothing, at the first launch', () => {
    expect(readStoredData(null)).toEqual({
      settings: null,
      journal: null,
      timeSpent: null,
      discarded: [],
      wasUpgraded: false,
    });
  });

  it('keeps the language unset when the person follows the device', () => {
    expect(readStoredData(settingsWith({ language: null })).settings?.language).toBeNull();
  });

  it('accepts the bounds of every setting', () => {
    for (const change of [
      { dailyGoalPages: 1 },
      { dailyGoalPages: 60 },
      { userSeed: 0 },
      { userSeed: Number.MAX_SAFE_INTEGER },
      { pauses: [] },
      { reminders: { ...DEFAULT_REMINDERS, dailyTime: { hour: 0, minute: 0 } } },
      { reminders: { ...DEFAULT_REMINDERS, dailyTime: { hour: 23, minute: 59 } } },
      { reminders: { ...DEFAULT_REMINDERS, fridayTime: { hour: 0, minute: 0 } } },
      { reminders: { ...DEFAULT_REMINDERS, quietHours: null } },
      {
        reminders: {
          ...DEFAULT_REMINDERS,
          quietHours: { from: { hour: 23, minute: 59 }, to: { hour: 0, minute: 0 } },
        },
      },
    ]) {
      expect(readStoredData(settingsWith(change)).discarded).toEqual([]);
    }
  });

  it('drops what it does not know instead of keeping it', () => {
    const reading = readStoredData(
      documentWith({
        settings: { ...SETTINGS, unknownSetting: 'x' },
        journal: JOURNAL.map((entry) => ({ ...entry, unknownField: 'x' })),
      }),
    );
    expect(reading).toEqual({ ...DATA, discarded: [], wasUpgraded: false });
  });
});

describe('documents written by the two kinds of version 3', () => {
  const TIME = { [parseLocalDate('2026-11-24')]: { app: 600, reader: 300 } };
  const { lastOpenedPage: _lastOpenedPage, ...settingsWithoutPage } = SETTINGS;
  const reminders = SETTINGS.reminders;

  it('upgrades a version 3 that has the last opened page and no time, keeping the page', () => {
    const reading = readStoredData(
      JSON.stringify({ version: 3, settings: SETTINGS, journal: JOURNAL }),
    );
    expect(reading).toEqual({
      settings: SETTINGS,
      journal: JOURNAL,
      timeSpent: {},
      discarded: [],
      wasUpgraded: true,
    });
    expect(reading.settings?.lastOpenedPage).toBe(293);
  });

  it('upgrades a version 3 that has the time and no last opened page, keeping the time', () => {
    const reading = readStoredData(
      JSON.stringify({
        version: 3,
        settings: settingsWithoutPage,
        journal: JOURNAL,
        timeSpent: TIME,
      }),
    );
    expect(reading).toEqual({
      settings: { ...SETTINGS, lastOpenedPage: null },
      journal: JOURNAL,
      timeSpent: TIME,
      discarded: [],
      wasUpgraded: true,
    });
  });

  it('keeps both when a version 3 has both, and adds both when it has neither', () => {
    const both = readStoredData(
      JSON.stringify({ version: 3, settings: SETTINGS, journal: JOURNAL, timeSpent: TIME }),
    );
    expect(both).toMatchObject({ settings: SETTINGS, timeSpent: TIME, discarded: [] });
    const neither = readStoredData(
      JSON.stringify({ version: 3, settings: settingsWithoutPage, journal: JOURNAL }),
    );
    expect(neither).toMatchObject({
      settings: { ...SETTINGS, lastOpenedPage: null },
      timeSpent: {},
      discarded: [],
    });
    expect(reminders).toBe(SETTINGS.reminders);
  });

  it('never replaces a wrong part that is present: it is discarded by the checks', () => {
    const badPage = readStoredData(
      JSON.stringify({
        version: 3,
        settings: { ...SETTINGS, lastOpenedPage: 900 },
        journal: JOURNAL,
      }),
    );
    expect(badPage).toMatchObject({ settings: null, journal: JOURNAL, discarded: ['settings'] });
    const badTime = readStoredData(
      JSON.stringify({ version: 3, settings: SETTINGS, journal: JOURNAL, timeSpent: 5 }),
    );
    expect(badTime).toMatchObject({ settings: SETTINGS, timeSpent: null, discarded: ['time'] });
  });
});

describe('document written by version 1 of the app', () => {
  /** What version 1 wrote: reminders without a Friday time and without quiet hours. */
  const {
    fridayTime: _fridayTime,
    quietHours: _quietHours,
    ...remindersOfVersion1
  } = SETTINGS.reminders;
  const { lastOpenedPage: _lastOpenedPage, ...settingsOfVersion1 } = SETTINGS;
  const VERSION_1 = JSON.stringify({
    version: 1,
    settings: { ...settingsOfVersion1, reminders: remindersOfVersion1 },
    journal: JOURNAL,
  });

  it('keeps every setting and the journal, and gives the new fields their default values', () => {
    expect(readStoredData(VERSION_1)).toEqual({
      settings: {
        ...SETTINGS,
        lastOpenedPage: null,
        reminders: { ...remindersOfVersion1, fridayTime: { hour: 9, minute: 0 }, quietHours: null },
      },
      journal: JOURNAL,
      timeSpent: {},
      discarded: [],
      wasUpgraded: true,
    });
  });

  it('is still checked like any other document once upgraded', () => {
    const damaged = JSON.stringify({
      version: 1,
      settings: { ...SETTINGS, reminders: remindersOfVersion1, dailyGoalPages: 900 },
      journal: JOURNAL,
    });
    expect(readStoredData(damaged)).toMatchObject({ settings: null, discarded: ['settings'] });
    const withoutSettings = JSON.stringify({ version: 1, settings: 3, journal: JOURNAL });
    expect(readStoredData(withoutSettings)).toMatchObject({
      settings: null,
      journal: JOURNAL,
      discarded: ['settings'],
    });
  });
});

describe('corrupt stored document', () => {
  it.each([
    ['text that is not JSON', '{"version":1,'],
    ['an empty text', ''],
    ['a list', '[]'],
    ['a number', '42'],
    ['null', 'null'],
    ['a document without a version', JSON.stringify({ settings: SETTINGS, journal: JOURNAL })],
    ['a document of an unknown version', documentWith({ version: STORED_DATA_VERSION + 1 })],
    ['a document of version 0', documentWith({ version: 0 })],
    ['a version written as text', documentWith({ version: String(STORED_DATA_VERSION) })],
  ])('discards the whole document: %s', (_name, raw) => {
    expect(readStoredData(raw)).toEqual({
      settings: null,
      journal: null,
      timeSpent: null,
      discarded: ['document'],
      wasUpgraded: false,
    });
  });

  it.each([
    ['an unknown language', { language: 'de' }],
    ['a language that is not text', { language: 3 }],
    ['a goal below 1', { dailyGoalPages: 0 }],
    ['a goal above 60', { dailyGoalPages: 61 }],
    ['a goal that is not whole', { dailyGoalPages: 5.5 }],
    ['a goal written as text', { dailyGoalPages: '5' }],
    ['a completion flag that is not a boolean', { onboardingCompleted: 'yes' }],
    ['a negative seed', { userSeed: -1 }],
    ['a seed above 2^53 - 1', { userSeed: 2 ** 53 }],
    ['a seed that is not whole', { userSeed: 1.5 }],
    ['a missing seed', { userSeed: undefined }],
    ['pauses that are not a list', { pauses: {} }],
    ['a pause with an impossible date', { pauses: [{ from: '2026-02-30', to: '2026-03-01' }] }],
    ['a pause that ends before it starts', { pauses: [{ from: '2026-03-02', to: '2026-03-01' }] }],
    ['a pause without an end', { pauses: [{ from: '2026-03-02' }] }],
    ['missing reminders', { reminders: undefined }],
    [
      'a reminder switch that is not a boolean',
      { reminders: { ...DEFAULT_REMINDERS, dailyEnabled: 1 } },
    ],
    ['an hour of 24', { reminders: { ...DEFAULT_REMINDERS, dailyTime: { hour: 24, minute: 0 } } }],
    ['a minute of 60', { reminders: { ...DEFAULT_REMINDERS, dailyTime: { hour: 8, minute: 60 } } }],
    ['a time written as text', { reminders: { ...DEFAULT_REMINDERS, dailyTime: '20:30' } }],
    [
      'a Friday time of 24:00',
      { reminders: { ...DEFAULT_REMINDERS, fridayTime: { hour: 24, minute: 0 } } },
    ],
    ['a missing Friday time', { reminders: { ...DEFAULT_REMINDERS, fridayTime: undefined } }],
    ['missing quiet hours', { reminders: { ...DEFAULT_REMINDERS, quietHours: undefined } }],
    [
      'quiet hours without an end',
      { reminders: { ...DEFAULT_REMINDERS, quietHours: { from: { hour: 22, minute: 0 } } } },
    ],
    [
      'quiet hours that end at 07:60',
      {
        reminders: {
          ...DEFAULT_REMINDERS,
          quietHours: { from: { hour: 22, minute: 0 }, to: { hour: 7, minute: 60 } },
        },
      },
    ],
  ])('discards the settings, and keeps a sound journal: %s', (_name, change) => {
    expect(readStoredData(settingsWith(change))).toEqual({
      settings: null,
      journal: JOURNAL,
      timeSpent: {},
      discarded: ['settings'],
      wasUpgraded: false,
    });
  });

  it('discards settings that are not an object', () => {
    for (const settings of [null, 'settings', [], 7]) {
      expect(readStoredData(documentWith({ settings })).discarded).toEqual(['settings']);
    }
  });

  it.each([
    ['a journal that is not a list', { page: 1 }],
    ['an entry that is not an object', [null]],
    ['a page above 604', [{ khatm: 1, page: 605, date: '2026-11-24' }]],
    ['a page below 1', [{ khatm: 1, page: 0, date: '2026-11-24' }]],
    ['a page that is not whole', [{ khatm: 1, page: 1.5, date: '2026-11-24' }]],
    ['a page written as text', [{ khatm: 1, page: '1', date: '2026-11-24' }]],
    ['an impossible date', [{ khatm: 1, page: 1, date: '2026-13-01' }]],
    ['a date that is not text', [{ khatm: 1, page: 1, date: 20261124 }]],
    ['a khatma numbered 0', [{ khatm: 0, page: 1, date: '2026-11-24' }]],
    [
      'the same page twice in one khatma',
      [
        { khatm: 1, page: 1, date: '2026-11-23' },
        { khatm: 1, page: 1, date: '2026-11-24' },
      ],
    ],
    ['a page filed in a khatma that has not started', [{ khatm: 2, page: 1, date: '2026-11-24' }]],
  ])('discards the journal, and keeps sound settings: %s', (_name, journal) => {
    expect(readStoredData(documentWith({ journal }))).toEqual({
      settings: SETTINGS,
      journal: null,
      timeSpent: {},
      discarded: ['journal'],
      wasUpgraded: false,
    });
  });

  it('discards both parts when both are damaged', () => {
    const reading = readStoredData(documentWith({ settings: 3, journal: 'x' }));
    expect(reading).toMatchObject({
      settings: null,
      journal: null,
      discarded: ['settings', 'journal'],
    });
  });
});

describe('bounds of the stored data', () => {
  const PAUSE = { from: '2026-03-01', to: '2026-03-04' };
  const pauses = (count: number) => Array.from({ length: count }, () => PAUSE);

  it('names a window of days no reading can leave, and a number of pauses', () => {
    expect(STORED_DATE_RANGE).toEqual({ earliest: '2020-01-01', latest: '2099-12-31' });
    expect(MAX_PAUSES).toBe(50);
  });

  it('accepts dates and pauses at the very edge of the bounds', () => {
    const journal = [
      { khatm: 1, page: 1, date: STORED_DATE_RANGE.earliest },
      { khatm: 1, page: 2, date: STORED_DATE_RANGE.latest },
    ];
    const edge = [{ from: STORED_DATE_RANGE.earliest, to: STORED_DATE_RANGE.latest }];
    expect(readStoredData(documentWith({ journal })).discarded).toEqual([]);
    expect(readStoredData(settingsWith({ pauses: edge })).discarded).toEqual([]);
    expect(readStoredData(settingsWith({ pauses: pauses(MAX_PAUSES) })).discarded).toEqual([]);
  });

  it.each([
    ['a pause that starts in year 100', { pauses: [{ from: '0100-01-01', to: '2026-03-01' }] }],
    ['a pause that starts in 2019', { pauses: [{ from: '2019-12-31', to: '2026-03-01' }] }],
    ['a pause that ends in 2100', { pauses: [{ from: '2026-03-01', to: '2100-01-01' }] }],
    ['a pause that ends in year 9999', { pauses: [{ from: '2026-03-01', to: '9999-12-31' }] }],
    ['one pause too many', { pauses: pauses(MAX_PAUSES + 1) }],
    ['two hundred pauses', { pauses: pauses(200) }],
  ])('discards the settings: %s', (_name, change) => {
    expect(readStoredData(settingsWith(change))).toMatchObject({
      settings: null,
      journal: JOURNAL,
      discarded: ['settings'],
    });
  });

  it.each([
    ['year 100', '0100-01-01'],
    ['the day before the window', '2019-12-31'],
    ['the day after the window', '2100-01-01'],
    ['year 9999', '9999-12-31'],
  ])('discards the journal for a page read in %s', (_name, date) => {
    const journal = [{ khatm: 1, page: 1, date }];
    expect(readStoredData(documentWith({ journal }))).toMatchObject({
      settings: SETTINGS,
      journal: null,
      discarded: ['journal'],
    });
  });

  it('discards at once the document that blocked the home screen', () => {
    // Two hundred century-long pauses and readings from year 100: about 9 KB of valid JSON.
    const raw = documentWith({
      settings: {
        ...SETTINGS,
        pauses: Array.from({ length: 200 }, (_, index) => ({
          from: `${String(100 + index * 9).padStart(4, '0')}-01-01`,
          to: `${String(200 + index * 9).padStart(4, '0')}-01-01`,
        })),
      },
      journal: [{ khatm: 1, page: 1, date: '0100-01-01' }],
    });
    const before = Date.now();
    const reading = readStoredData(raw);
    expect(Date.now() - before).toBeLessThan(100);
    expect(reading).toMatchObject({ settings: null, journal: null });
    expect(reading.discarded).toEqual(['settings', 'journal']);
  });
});

describe('the last page opened in the reader', () => {
  it('is written and read back, as a page from 1 to 604 or as null', () => {
    for (const lastOpenedPage of [1, 293, 604, null]) {
      const settings = { ...SETTINGS, lastOpenedPage };
      const reading = readStoredData(writeStoredData({ settings, journal: JOURNAL }));
      expect(reading.settings?.lastOpenedPage).toBe(lastOpenedPage);
      expect(reading.discarded).toEqual([]);
    }
  });

  it('is null in a document of version 2, which had no such field, and nothing else changes', () => {
    const { lastOpenedPage: _lastOpenedPage, ...settingsOfVersion2 } = SETTINGS;
    const reading = readStoredData(
      JSON.stringify({ version: 2, settings: settingsOfVersion2, journal: JOURNAL }),
    );
    expect(reading).toEqual({
      settings: { ...SETTINGS, lastOpenedPage: null },
      journal: JOURNAL,
      timeSpent: {},
      discarded: [],
      wasUpgraded: true,
    });
  });

  it.each([
    ['page 0', 0],
    ['page 605', 605],
    ['a page that is not whole', 1.5],
    ['a negative page', -3],
    ['text', '293'],
    ['a boolean', true],
  ])('discards the settings, and keeps the journal, for %s', (_name, lastOpenedPage) => {
    expect(readStoredData(settingsWith({ lastOpenedPage }))).toMatchObject({
      settings: null,
      journal: JOURNAL,
      discarded: ['settings'],
    });
  });
});

describe('the bookmarks of the reader', () => {
  it('is version 5 of the document', () => {
    expect(STORED_DATA_VERSION).toBe(5);
  });

  it('are written and read back, in the order of the pages', () => {
    for (const bookmarks of [[], [1], [2, 293, 604]]) {
      const settings = { ...SETTINGS, bookmarks };
      const reading = readStoredData(writeStoredData({ settings, journal: JOURNAL }));
      expect(reading.settings?.bookmarks).toEqual(bookmarks);
      expect(reading.discarded).toEqual([]);
    }
  });

  it('are none in a document of version 4, which had no such field, and nothing else changes', () => {
    const { bookmarks: _bookmarks, ...settingsOfVersion4 } = SETTINGS;
    const reading = readStoredData(
      JSON.stringify({ version: 4, settings: settingsOfVersion4, journal: JOURNAL, timeSpent: {} }),
    );
    expect(reading).toEqual({
      settings: { ...SETTINGS, bookmarks: [] },
      journal: JOURNAL,
      timeSpent: {},
      discarded: [],
      wasUpgraded: true,
    });
  });

  it('are none after the upgrade of the oldest documents too', () => {
    const { bookmarks: _bookmarks, lastOpenedPage: _page, ...settingsOfVersion2 } = SETTINGS;
    const reading = readStoredData(
      JSON.stringify({ version: 2, settings: settingsOfVersion2, journal: JOURNAL }),
    );
    expect(reading.settings).toEqual({ ...SETTINGS, lastOpenedPage: null, bookmarks: [] });
  });

  it.each([
    ['a page 0', [0]],
    ['a page 605', [605]],
    ['a page that is not whole', [1.5]],
    ['a page written as text', ['293']],
    ['the same page twice', [18, 18]],
    ['pages out of order', [293, 18]],
    ['something that is not a list', 293],
    ['null', null],
  ])('discards the settings, and keeps the journal, for %s', (_name, bookmarks) => {
    expect(readStoredData(settingsWith({ bookmarks }))).toMatchObject({
      settings: null,
      journal: JOURNAL,
      discarded: ['settings'],
    });
  });
});
