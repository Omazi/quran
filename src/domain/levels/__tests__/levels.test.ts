/**
 * Levels, gardens and badges (owner's decisions of 24 and 26 November 2026, D23 and D46): one
 * level per completed khatma, one garden style per level, the same for everyone, seven styles in
 * the first version, and one badge per completed khatma.
 */
import {
  buildCompletedKhatmas,
  day,
  pageRange,
  readPages,
} from '@/domain/khatm/__fixtures__/journal-builders';
import { HIZB_PAGE_RANGES } from '@/domain/khatm/__fixtures__/hizb-page-ranges';
import { EMPTY_JOURNAL, type ReadingJournal } from '@/domain/khatm';
import { addDays } from '@/domain/shared/local-date';
import { normalizeJournal } from '@/domain/sync';

import {
  badgeShelf,
  DEFAULT_LEVELS_CONFIG,
  GARDEN_STYLES,
  getProgression,
  khatmaToCelebrate,
  levelOfKhatma,
  levelOfCompletedKhatmas,
  levelPath,
  styleOfLevel,
} from '..';

const START = day('2026-01-01');

describe('the garden styles', () => {
  it('are the seven gardens of the first version, in the order the owner chose', () => {
    expect(GARDEN_STYLES).toEqual([
      'fountain-courtyard',
      'oasis',
      'waterside-orchard',
      'mountain-garden',
      'cherry-blossoms',
      'pine-clearing',
      'night-garden',
    ]);
  });

  it('cannot be changed by a caller', () => {
    expect(Object.isFrozen(GARDEN_STYLES)).toBe(true);
  });

  it('give each level its own style, the same for everyone', () => {
    expect(styleOfLevel(1)).toBe('fountain-courtyard');
    expect(styleOfLevel(2)).toBe('oasis');
    expect(styleOfLevel(7)).toBe('night-garden');
  });

  it('refuse a level that does not exist', () => {
    for (const level of [0, -1, 1.5, 8, Number.NaN]) {
      expect(() => styleOfLevel(level)).toThrow(RangeError);
    }
  });
});

describe('levelOfKhatma', () => {
  it('is the number of the khatma: khatma 1 grows the level-1 garden', () => {
    expect(levelOfKhatma(1)).toBe(1);
    expect(levelOfKhatma(4)).toBe(4);
    expect(levelOfKhatma(7)).toBe(7);
  });

  it('stays on the last style beyond the seventh khatma, until updates add gardens', () => {
    expect(levelOfKhatma(8)).toBe(7);
    expect(levelOfKhatma(500)).toBe(7);
    expect(levelOfKhatma(Number.MAX_SAFE_INTEGER)).toBe(7);
  });

  it('refuses anything but a khatma number', () => {
    for (const khatm of [0, -3, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => levelOfKhatma(khatm)).toThrow(RangeError);
    }
  });

  it('gives the level of a person from their completed khatmas: completed + 1', () => {
    expect(levelOfCompletedKhatmas(0)).toBe(1);
    expect(levelOfCompletedKhatmas(1)).toBe(2);
    expect(levelOfCompletedKhatmas(6)).toBe(7);
    expect(levelOfCompletedKhatmas(40)).toBe(7);
    expect(() => levelOfCompletedKhatmas(-1)).toThrow(RangeError);
  });
});

describe('getProgression', () => {
  it('starts everyone, existing users included, at level 1 with their current progress', () => {
    const journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 31), START);
    const progression = getProgression(journal, HIZB_PAGE_RANGES);
    expect(progression).toEqual({
      completed: [],
      currentKhatm: 1,
      level: 1,
      styleId: 'fountain-courtyard',
      hasStarted: true,
      hizbCompleted: 3,
      maxLevel: 7,
    });
  });

  it('describes a first launch: level 1, nothing read', () => {
    expect(getProgression(EMPTY_JOURNAL, HIZB_PAGE_RANGES)).toMatchObject({
      completed: [],
      currentKhatm: 1,
      level: 1,
      hasStarted: false,
      hizbCompleted: 0,
    });
  });

  it('moves to the next level with the last page of a khatma, before the next garden starts', () => {
    const journal = buildCompletedKhatmas(1, START, 10);
    const progression = getProgression(journal, HIZB_PAGE_RANGES);
    expect(progression).toMatchObject({
      currentKhatm: 2,
      level: 2,
      styleId: 'oasis',
      hasStarted: false,
      hizbCompleted: 0,
    });
    expect(progression.completed).toEqual([
      {
        khatm: 1,
        level: 1,
        styleId: 'fountain-courtyard',
        startedOn: START,
        completedOn: day('2026-01-07'),
        daysTaken: 7,
      },
    ]);
  });

  it('starts the new garden with the first page read after a completed khatma', () => {
    const completed = buildCompletedKhatmas(1, START, 10);
    const journal = readPages(completed, 2, [300], day('2026-01-20'));
    expect(getProgression(journal, HIZB_PAGE_RANGES)).toMatchObject({
      currentKhatm: 2,
      level: 2,
      hasStarted: true,
      hizbCompleted: 0,
    });
  });

  it('keeps the history of every completed khatma, with its level and garden', () => {
    const journal = buildCompletedKhatmas(9, START, 30);
    const { completed, level, styleId } = getProgression(journal, HIZB_PAGE_RANGES);
    expect(completed.map((khatma) => [khatma.khatm, khatma.level, khatma.styleId])).toEqual([
      [1, 1, 'fountain-courtyard'],
      [2, 2, 'oasis'],
      [3, 3, 'waterside-orchard'],
      [4, 4, 'mountain-garden'],
      [5, 5, 'cherry-blossoms'],
      [6, 6, 'pine-clearing'],
      [7, 7, 'night-garden'],
      [8, 7, 'night-garden'],
      [9, 7, 'night-garden'],
    ]);
    expect([level, styleId]).toEqual([7, 'night-garden']);
  });

  it('dates a khatma completed offline by the day its last page was read, not when it syncs', () => {
    // The last pages are recorded later, for a day in the past (a phone offline for a week).
    let journal = readPages(EMPTY_JOURNAL, 1, pageRange(1, 600), START);
    journal = readPages(journal, 1, pageRange(601, 604), day('2026-02-03'));
    journal = readPages(journal, 2, [1], day('2026-02-10'));
    const { completed } = getProgression(journal, HIZB_PAGE_RANGES);
    expect(completed[0]).toMatchObject({ khatm: 1, completedOn: day('2026-02-03') });
  });

  it('gives two phones the same history, whatever the order their pages were merged in', () => {
    // Phone A finished the khatma and started the next; phone B read other pages of it offline.
    const phoneA = readPages(buildCompletedKhatmas(1, START, 10), 2, [1, 2, 3], day('2026-01-20'));
    const phoneB = readPages(EMPTY_JOURNAL, 1, pageRange(1, 50), day('2026-01-02'));
    const merged = (first: ReadingJournal, second: ReadingJournal) => {
      const byKey = new Map<string, ReadingJournal[number]>();
      for (const entry of [...first, ...second]) {
        const key = `${entry.khatm}:${entry.page}`;
        const known = byKey.get(key);
        if (known === undefined || entry.date < known.date) byKey.set(key, entry);
      }
      return normalizeJournal([...byKey.values()]);
    };
    const one = getProgression(merged(phoneA, phoneB), HIZB_PAGE_RANGES);
    const other = getProgression(merged(phoneB, phoneA), HIZB_PAGE_RANGES);
    expect(one).toEqual(other);
    expect(one).toMatchObject({ level: 2, hasStarted: true });
    expect(one.completed).toHaveLength(1);
  });

  it('rejects a damaged journal, as the khatm module does', () => {
    const broken: ReadingJournal = [{ khatm: 2, page: 1, date: START }];
    expect(() => getProgression(broken, HIZB_PAGE_RANGES)).toThrow(RangeError);
  });
});

describe('levelPath: the path of "Mes jardins"', () => {
  it('shows the completed levels, the current one, and keeps the others a surprise', () => {
    const journal = readPages(buildCompletedKhatmas(1, START, 10), 2, pageRange(1, 91), START);
    const path = levelPath(getProgression(journal, HIZB_PAGE_RANGES));
    expect(path).toHaveLength(7);
    expect(path[0]).toEqual({
      level: 1,
      status: 'completed',
      styleId: 'fountain-courtyard',
      khatm: 1,
      completedOn: day('2026-01-07'),
    });
    expect(path[1]).toEqual({
      level: 2,
      status: 'current',
      styleId: 'oasis',
      khatm: 2,
      completedOn: null,
    });
    // A locked garden has no name and no picture: nothing of its style leaves the domain.
    for (const step of path.slice(2)) {
      expect(step).toEqual({
        level: step.level,
        status: 'locked',
        styleId: null,
        khatm: null,
        completedOn: null,
      });
    }
  });

  it('keeps the last level current beyond the seventh khatma, with the first date it was reached', () => {
    const path = levelPath(getProgression(buildCompletedKhatmas(8, START, 30), HIZB_PAGE_RANGES));
    expect(path.map((step) => step.status)).toEqual([
      'completed',
      'completed',
      'completed',
      'completed',
      'completed',
      'completed',
      'current',
    ]);
    expect(path[6]).toMatchObject({ khatm: 9, styleId: 'night-garden' });
  });
});

describe('badgeShelf: the badges of the profile', () => {
  it('lists the earned badges, the garden in progress, then the next level to come', () => {
    const journal = readPages(buildCompletedKhatmas(1, START, 10), 2, pageRange(1, 91), START);
    const shelf = badgeShelf(getProgression(journal, HIZB_PAGE_RANGES));
    expect(shelf.map((item) => item.kind)).toEqual(['earned', 'in-progress', 'locked']);
    expect(shelf[1]).toEqual({
      kind: 'in-progress',
      khatm: 2,
      level: 2,
      styleId: 'oasis',
      hizbCompleted: 9,
    });
    expect(shelf[2]).toEqual({ kind: 'locked', level: 3 });
  });

  it('shows a first garden in progress and the level to come, with no badge yet', () => {
    const shelf = badgeShelf(getProgression(EMPTY_JOURNAL, HIZB_PAGE_RANGES));
    expect(shelf.map((item) => item.kind)).toEqual(['in-progress', 'locked']);
  });

  it('has nothing locked once the last garden is reached', () => {
    const shelf = badgeShelf(getProgression(buildCompletedKhatmas(7, START, 30), HIZB_PAGE_RANGES));
    expect(shelf.filter((item) => item.kind === 'earned')).toHaveLength(7);
    expect(shelf.at(-1)).toMatchObject({ kind: 'in-progress', level: 7, khatm: 8 });
  });
});

describe('khatmaToCelebrate: the celebration, shown once', () => {
  const journal = buildCompletedKhatmas(1, START, 10);
  const { completed } = getProgression(journal, HIZB_PAGE_RANGES);
  const completedOn = day('2026-01-07');

  it('names the khatma just completed until it is marked celebrated', () => {
    expect(khatmaToCelebrate({ completed, celebratedKhatm: 0, today: completedOn })).toMatchObject({
      khatm: 1,
      level: 1,
    });
    expect(khatmaToCelebrate({ completed, celebratedKhatm: 1, today: completedOn })).toBeNull();
  });

  it('celebrates only the latest khatma when several were completed unseen', () => {
    const many = getProgression(buildCompletedKhatmas(3, START, 10), HIZB_PAGE_RANGES).completed;
    const today = many[2]!.completedOn;
    expect(khatmaToCelebrate({ completed: many, celebratedKhatm: 0, today })?.khatm).toBe(3);
  });

  it('does not celebrate an old khatma that comes back with a restored or merged journal', () => {
    const window = DEFAULT_LEVELS_CONFIG.celebrationWindowDays;
    const lastDay = addDays(completedOn, window);
    expect(khatmaToCelebrate({ completed, celebratedKhatm: 0, today: lastDay })).not.toBeNull();
    const dayAfter = addDays(completedOn, window + 1);
    expect(khatmaToCelebrate({ completed, celebratedKhatm: 0, today: dayAfter })).toBeNull();
  });

  it('celebrates a khatma dated after today (another time zone) as one completed today', () => {
    expect(
      khatmaToCelebrate({ completed, celebratedKhatm: 0, today: day('2026-01-06') }),
    ).not.toBeNull();
  });

  it('has nothing to celebrate before the first khatma', () => {
    expect(khatmaToCelebrate({ completed: [], celebratedKhatm: 0, today: START })).toBeNull();
  });

  it('refuses a celebrated khatma that is not a whole number from 0', () => {
    expect(() => khatmaToCelebrate({ completed, celebratedKhatm: -1, today: START })).toThrow(
      RangeError,
    );
  });
});
