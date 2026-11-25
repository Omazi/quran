/**
 * The promises the public types make, checked by the compiler (`npx tsc --noEmit`): each
 * `@ts-expect-error` line fails the type check if the mistake it shows becomes possible.
 * docs/specs/khatm.md: "journal immuable", "on n'écrit jamais un numéro de khatma à la main",
 * "l'objectif est ... toujours passé en paramètre".
 */
import {
  DEFAULT_KHATM_CONFIG,
  EMPTY_JOURNAL,
  estimateFinishDate,
  getBadges,
  getGardenFeed,
  getReadPages,
  getTodayProgress,
  getWateredDays,
  recordPageRead,
  type ReadingJournal,
} from '@/domain/khatm';
import * as publicApi from '@/domain/khatm';

import { day, TESTER_HIZB_RANGES } from './acceptance-kit';

const TODAY = day('2026-03-15');

/** Never called: the body only has to compile, or rather to fail to compile where marked. */
function mistakesTheTypesMustRefuse(journal: ReadingJournal): void {
  // @ts-expect-error the journal is immutable: no push
  journal.push({ khatm: 1, page: 1, date: TODAY });
  // @ts-expect-error the journal is immutable: no assignment of an entry
  journal[0] = { khatm: 1, page: 1, date: TODAY };
  const first = journal[0];
  if (first) {
    // @ts-expect-error an entry is immutable
    first.page = 2;
    // @ts-expect-error an entry is immutable, its khatma number above all
    first.khatm = 2;
  }
  // @ts-expect-error a khatma number is never written by hand
  recordPageRead(journal, { khatm: 1, page: 1, date: TODAY });
  // @ts-expect-error a date is a LocalDate, not any text
  recordPageRead(journal, { page: 1, date: '2026-03-15' });
  // @ts-expect-error the daily goal has no default value: it is always passed
  getTodayProgress(journal, TODAY);
  // @ts-expect-error the pace of a daily goal needs the goal
  estimateFinishDate(journal, 1, TODAY, { kind: 'daily-goal' });
  // @ts-expect-error the hizb ranges are injected: there is no default
  getGardenFeed(journal);
  // @ts-expect-error the default configuration is read-only
  DEFAULT_KHATM_CONFIG.minPagesPerWateredDay = 2;
  // @ts-expect-error the set of read pages is read-only
  getReadPages(journal, 1).add(1);
  // @ts-expect-error the set of watered days is read-only
  getWateredDays(journal).clear();
  // @ts-expect-error the list of badges is read-only
  getBadges(journal).pop();
  const badge = getBadges(journal)[0];
  if (badge) {
    // @ts-expect-error a badge is read-only
    badge.daysTaken = 1;
  }
  // @ts-expect-error the garden feed is read-only
  getGardenFeed(journal, TESTER_HIZB_RANGES).hizbCompleted = 60;
}

describe('API attendue — the names the specification lists are exported', () => {
  it.each([
    'recordPageRead',
    'getCurrentKhatm',
    'getReadPages',
    'isPageRead',
    'getGardenFeed',
    'getKhatmProgress',
    'getTodayProgress',
    'getWateredDays',
    'getStreak',
    'estimateFinishDate',
    'getBadges',
  ])('%s is a function of the public API', (name) => {
    expect(typeof Reflect.get(publicApi, name)).toBe('function');
  });

  it('nothing else is exported than these functions and the two constants', () => {
    expect(Object.keys(publicApi).sort()).toEqual(
      [
        'DEFAULT_KHATM_CONFIG',
        'EMPTY_JOURNAL',
        'estimateFinishDate',
        'getBadges',
        'getCurrentKhatm',
        'getGardenFeed',
        'getKhatmProgress',
        'getReadPages',
        'getStreak',
        'getTodayProgress',
        'getWateredDays',
        'isPageRead',
        'recordPageRead',
        // The time a page asks in the reader (docs/specs/khatm.md, rule 11; D41).
        'requiredReadingSeconds',
      ].sort(),
    );
  });
});

describe('Type contract of the public API', () => {
  it('the mistakes above are refused by the compiler (checked by tsc, listed here)', () => {
    expect(typeof mistakesTheTypesMustRefuse).toBe('function');
  });

  it('the constants are frozen at run time as well', () => {
    expect(Object.isFrozen(EMPTY_JOURNAL)).toBe(true);
    expect(Object.isFrozen(DEFAULT_KHATM_CONFIG)).toBe(true);
    expect(DEFAULT_KHATM_CONFIG).toStrictEqual({
      minPagesPerWateredDay: 1,
      averagePaceWindowDays: 7,
    });
  });
});
