/**
 * Acceptance tests of the reading journal (docs/specs/khatm.md, "Modèle", rules 1 and 4).
 * Expected values are worked out by hand from the specification.
 */
import {
  EMPTY_JOURNAL,
  getCurrentKhatm,
  getReadPages,
  isPageRead,
  recordPageRead,
  type ReadingJournal,
} from '@/domain/khatm';

import {
  day,
  deepFreeze,
  FIRST_PAGE,
  LAST_PAGE,
  pagesFrom,
  readPages,
  readWholeKhatma,
  seededRandom,
  shuffled,
} from './acceptance-kit';

const MARCH_1 = day('2026-03-01');
const MARCH_5 = day('2026-03-05');
const MARCH_9 = day('2026-03-09');

describe('Modèle — the journal is the single source of truth', () => {
  it('empty journal: no entry, khatma 1 in progress, no page read', () => {
    expect(EMPTY_JOURNAL).toEqual([]);
    expect(getCurrentKhatm(EMPTY_JOURNAL)).toBe(1);
    expect(getReadPages(EMPTY_JOURNAL, 1).size).toBe(0);
    expect(isPageRead(EMPTY_JOURNAL, 1, FIRST_PAGE)).toBe(false);
  });

  it('an entry is exactly { khatm, page, date }', () => {
    const journal = recordPageRead(EMPTY_JOURNAL, { page: 5, date: MARCH_1 });

    expect(journal).toStrictEqual([{ khatm: 1, page: 5, date: MARCH_1 }]);
  });

  it('nothing but page and date reaches the journal', () => {
    // The object satisfies PageRead structurally; the extra field must not be stored.
    const readWithNote = { page: 5, date: MARCH_1, note: 'not part of the model' };

    const journal = recordPageRead(EMPTY_JOURNAL, readWithNote);

    expect(journal).toStrictEqual([{ khatm: 1, page: 5, date: MARCH_1 }]);
  });

  it('pages can be read in any order', () => {
    const journal = readPages(EMPTY_JOURNAL, [LAST_PAGE, FIRST_PAGE, 300], MARCH_1);

    expect(journal).toHaveLength(3);
    expect([...getReadPages(journal, 1)].sort((a, b) => a - b)).toEqual([1, 300, 604]);
  });

  it('boundaries: pages 1 and 604 can be recorded and are the only ones read', () => {
    const journal = readPages(EMPTY_JOURNAL, [FIRST_PAGE, LAST_PAGE], MARCH_1);

    expect(isPageRead(journal, 1, FIRST_PAGE)).toBe(true);
    expect(isPageRead(journal, 1, LAST_PAGE)).toBe(true);
    expect(isPageRead(journal, 1, FIRST_PAGE + 1)).toBe(false);
    expect(isPageRead(journal, 1, LAST_PAGE - 1)).toBe(false);
  });
});

describe('Règle 1 — page lue: a page is read for a khatma as soon as an entry exists', () => {
  it('a recorded page is read, the others are not', () => {
    const journal = recordPageRead(EMPTY_JOURNAL, { page: 42, date: MARCH_1 });

    expect(isPageRead(journal, 1, 42)).toBe(true);
    expect(isPageRead(journal, 1, 41)).toBe(false);
    expect(getReadPages(journal, 1)).toEqual(new Set([42]));
  });

  it('getReadPages hands out a set the caller cannot use to corrupt later answers', () => {
    const journal = recordPageRead(EMPTY_JOURNAL, { page: 42, date: MARCH_1 });
    // `as` on purpose: a JavaScript caller can ignore the ReadonlySet type and mutate it.
    const leaked = getReadPages(journal, 1) as Set<number>;
    leaked.add(43);
    leaked.delete(42);

    expect(getReadPages(journal, 1)).toEqual(new Set([42]));
    expect(isPageRead(journal, 1, 42)).toBe(true);
    expect(isPageRead(journal, 1, 43)).toBe(false);
  });
});

describe('Modèle — relire une page déjà lue dans la même khatma ne compte pas', () => {
  const journal = readPages(EMPTY_JOURNAL, [10, 11], MARCH_5);

  it('cas à tester: page relue le même jour → journal inchangé', () => {
    const after = recordPageRead(journal, { page: 10, date: MARCH_5 });

    expect(after).toStrictEqual(journal);
  });

  it('cas à tester: page relue un autre jour → aucun effet, the first date is kept', () => {
    const after = recordPageRead(journal, { page: 10, date: MARCH_9 });

    expect(after).toStrictEqual([
      { khatm: 1, page: 10, date: MARCH_5 },
      { khatm: 1, page: 11, date: MARCH_5 },
    ]);
  });

  it('a back-dated re-read leaves the journal unchanged too', () => {
    // Spec: "recordPageRead sur une page déjà lue renvoie le journal inchangé", whatever the date.
    const after = recordPageRead(journal, { page: 10, date: MARCH_1 });

    expect(after).toStrictEqual(journal);
  });

  it('"renvoie le journal inchangé": the very same journal is returned', () => {
    expect(recordPageRead(journal, { page: 11, date: MARCH_9 })).toBe(journal);
  });

  it('a back-dated new page is recorded with its own date', () => {
    const after = recordPageRead(journal, { page: 12, date: MARCH_1 });

    expect(after).toHaveLength(3);
    expect(after).toContainEqual({ khatm: 1, page: 12, date: MARCH_1 });
  });

  it('property: re-reading any already read page, on any day, never changes anything', () => {
    const random = seededRandom(20260301);
    const pages = shuffled(pagesFrom(FIRST_PAGE, LAST_PAGE), random).slice(0, 120);
    const read = readPages(EMPTY_JOURNAL, pages, MARCH_5);

    const reread = [MARCH_1, MARCH_5, MARCH_9].reduce<ReadingJournal>(
      (current, date) => readPages(current, shuffled(pages, random), date),
      read,
    );

    expect(reread).toStrictEqual(read);
  });
});

describe('Modèle — journal immuable', () => {
  it('recordPageRead returns a new journal and leaves the given one untouched', () => {
    const before = deepFreeze([...readPages(EMPTY_JOURNAL, [1, 2, 3], MARCH_1)]);
    const snapshot = JSON.stringify(before);

    const after = recordPageRead(before, { page: 4, date: MARCH_5 });

    expect(after).not.toBe(before);
    expect(after).toHaveLength(4);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('a re-read does not mutate a frozen journal either', () => {
    const before = deepFreeze([...readPages(EMPTY_JOURNAL, [1, 2, 3], MARCH_1)]);

    expect(() => recordPageRead(before, { page: 2, date: MARCH_5 })).not.toThrow();
    expect(before).toHaveLength(3);
  });

  it('EMPTY_JOURNAL stays empty after pages were recorded from it', () => {
    readPages(EMPTY_JOURNAL, [1, 2, 3], MARCH_1);

    expect(EMPTY_JOURNAL).toHaveLength(0);
  });

  it('the page read handed in is not kept by reference', () => {
    const pageRead = { page: 8, date: MARCH_1 };
    const journal = recordPageRead(EMPTY_JOURNAL, pageRead);
    pageRead.page = 9;

    expect(journal).toStrictEqual([{ khatm: 1, page: 8, date: MARCH_1 }]);
  });
});

describe('Règle 4 — khatma terminée: 604 pages, then khatma n + 1 from zero', () => {
  const almostComplete = readPages(EMPTY_JOURNAL, pagesFrom(FIRST_PAGE, LAST_PAGE - 1), MARCH_1);
  const complete = recordPageRead(almostComplete, { page: LAST_PAGE, date: MARCH_5 });

  it('603 pages: khatma 1 is still in progress', () => {
    expect(getCurrentKhatm(almostComplete)).toBe(1);
    expect(getReadPages(almostComplete, 1).size).toBe(603);
  });

  it('604 pages: the khatma in progress is the first unfinished one, khatma 2', () => {
    expect(getCurrentKhatm(complete)).toBe(2);
    expect(getReadPages(complete, 1).size).toBe(604);
    expect(getReadPages(complete, 2).size).toBe(0);
  });

  it('cas à tester: 604 pages lues en désordre complete the khatma', () => {
    const order = shuffled(pagesFrom(FIRST_PAGE, LAST_PAGE), seededRandom(604));

    const journal = readPages(EMPTY_JOURNAL, order, MARCH_1);

    expect(journal).toHaveLength(604);
    expect(getCurrentKhatm(journal)).toBe(2);
    expect(journal.every((entry) => entry.khatm === 1)).toBe(true);
  });

  it('the first page recorded after the end starts khatma 2, even a page of khatma 1', () => {
    const next = recordPageRead(complete, { page: 7, date: MARCH_9 });

    expect(next).toHaveLength(605);
    expect(next).toContainEqual({ khatm: 2, page: 7, date: MARCH_9 });
    expect(getCurrentKhatm(next)).toBe(2);
    expect(getReadPages(next, 2)).toEqual(new Set([7]));
    expect(isPageRead(next, 2, 8)).toBe(false);
  });

  it('the pages of the completed khatma are never removed', () => {
    const next = readPages(complete, [7, 8, 9], MARCH_9);

    expect(getReadPages(next, 1).size).toBe(604);
    expect(isPageRead(next, 1, LAST_PAGE)).toBe(true);
  });

  it('a re-read inside khatma 2 does not count and does not touch khatma 1', () => {
    const next = recordPageRead(complete, { page: 7, date: MARCH_5 });

    const reread = recordPageRead(next, { page: 7, date: MARCH_9 });

    expect(reread).toStrictEqual(next);
  });

  it('an app holding an outdated khatma number cannot misfile a read', () => {
    // "On n'écrit jamais un numéro de khatma à la main": the caller's number is ignored.
    const staleRead = { khatm: 1, page: 7, date: MARCH_9 };

    const next = recordPageRead(complete, staleRead);

    expect(next).toHaveLength(605);
    expect(next).toContainEqual({ khatm: 2, page: 7, date: MARCH_9 });
  });

  it('a back-dated page recorded after the end still belongs to khatma 2', () => {
    // Khatma 1 ended on March 5; the read is dated March 1 but recorded afterwards.
    const next = recordPageRead(complete, { page: 300, date: MARCH_1 });

    expect(next).toContainEqual({ khatm: 2, page: 300, date: MARCH_1 });
    expect(getReadPages(next, 1).size).toBe(604);
  });

  it('cas à tester: several khatmas in a row, one in progress at a time', () => {
    const twoKhatmas = readWholeKhatma(readWholeKhatma(EMPTY_JOURNAL, MARCH_1), MARCH_5);
    const third = readPages(twoKhatmas, [1, 2, 3, 4, 5], MARCH_9);

    expect(getCurrentKhatm(twoKhatmas)).toBe(3);
    expect(third).toHaveLength(2 * 604 + 5);
    expect(getCurrentKhatm(third)).toBe(3);
    expect(getReadPages(third, 1).size).toBe(604);
    expect(getReadPages(third, 2).size).toBe(604);
    expect(getReadPages(third, 3)).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(third.filter((entry) => entry.khatm === 2).every((e) => e.date === MARCH_5)).toBe(true);
  });
});
