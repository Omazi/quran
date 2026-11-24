/**
 * Shared fixtures and helpers of the khatm acceptance tests. They are written by the
 * independent tester from docs/specs/khatm.md and the public API only: nothing here comes
 * from the developer's fixtures.
 *
 * Jest runs every file under `__tests__` as a suite and the tester may only write in this
 * folder, so the self-check at the bottom is registered only when this file is the suite.
 */
import {
  recordPageRead,
  type HizbPageRange,
  type ReadingEntry,
  type ReadingJournal,
} from '@/domain/khatm';
import { parseLocalDate, type LocalDate } from '@/domain/shared/local-date';

export const FIRST_PAGE = 1;
export const LAST_PAGE = 604;
export const HIZB_TOTAL = 60;

/**
 * The tester's own hizb ranges: `[hizb, firstPage, lastPage]`. Hizb 1 to 10 have 11 pages,
 * the others 10. Six hizb start on the last page of the previous one (shared page):
 * hizb 2 (page 11), 7 (65), 20 (198), 33 (327), 46 (456) and 60 (595).
 */
const TESTER_HIZB_TABLE: readonly (readonly [number, number, number])[] = [
  [1, 1, 11],
  [2, 11, 21],
  [3, 22, 32],
  [4, 33, 43],
  [5, 44, 54],
  [6, 55, 65],
  [7, 65, 75],
  [8, 76, 86],
  [9, 87, 97],
  [10, 98, 108],
  [11, 109, 118],
  [12, 119, 128],
  [13, 129, 138],
  [14, 139, 148],
  [15, 149, 158],
  [16, 159, 168],
  [17, 169, 178],
  [18, 179, 188],
  [19, 189, 198],
  [20, 198, 207],
  [21, 208, 217],
  [22, 218, 227],
  [23, 228, 237],
  [24, 238, 247],
  [25, 248, 257],
  [26, 258, 267],
  [27, 268, 277],
  [28, 278, 287],
  [29, 288, 297],
  [30, 298, 307],
  [31, 308, 317],
  [32, 318, 327],
  [33, 327, 336],
  [34, 337, 346],
  [35, 347, 356],
  [36, 357, 366],
  [37, 367, 376],
  [38, 377, 386],
  [39, 387, 396],
  [40, 397, 406],
  [41, 407, 416],
  [42, 417, 426],
  [43, 427, 436],
  [44, 437, 446],
  [45, 447, 456],
  [46, 456, 465],
  [47, 466, 475],
  [48, 476, 485],
  [49, 486, 495],
  [50, 496, 505],
  [51, 506, 515],
  [52, 516, 525],
  [53, 526, 535],
  [54, 536, 545],
  [55, 546, 555],
  [56, 556, 565],
  [57, 566, 575],
  [58, 576, 585],
  [59, 586, 595],
  [60, 595, 604],
];

export const SHARED_PAGES: readonly number[] = [11, 65, 198, 327, 456, 595];

export const TESTER_HIZB_RANGES: readonly HizbPageRange[] = TESTER_HIZB_TABLE.map(
  ([hizb, firstPage, lastPage]) => ({ hizb, firstPage, lastPage }),
);

/**
 * A second, different set of ranges without any shared page: hizb 1 to 59 have 10 pages and
 * hizb 60 takes pages 591 to 604. It proves that the module uses the injected ranges.
 */
export const EVEN_HIZB_RANGES: readonly HizbPageRange[] = Array.from(
  { length: HIZB_TOTAL },
  (_, index) => {
    const hizb = index + 1;
    return {
      hizb,
      firstPage: index * 10 + 1,
      lastPage: hizb === HIZB_TOTAL ? LAST_PAGE : hizb * 10,
    };
  },
);

/**
 * A third set where every hizb shares its first page with the previous one and its last
 * page with the next one: hizb h is pages 10(h − 1) + 1 to 10h + 1, hizb 60 is 591 to 604.
 */
export const CHAINED_HIZB_RANGES: readonly HizbPageRange[] = Array.from(
  { length: HIZB_TOTAL },
  (_, index) => {
    const hizb = index + 1;
    return {
      hizb,
      firstPage: index * 10 + 1,
      lastPage: hizb === HIZB_TOTAL ? LAST_PAGE : hizb * 10 + 1,
    };
  },
);

/** A real calendar day; throws when the test itself is wrong. */
export function day(value: string): LocalDate {
  return parseLocalDate(value);
}

/**
 * A value typed as a date without any check, to hand invalid dates to the module the way a
 * damaged storage or a careless caller would.
 */
export function uncheckedDate(value: string): LocalDate {
  // `as` on purpose: the whole point is to bypass the brand and test the runtime validation.
  return value as LocalDate;
}

/** The pages from `first` to `last`, both included, in mushaf order. */
export function pagesFrom(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

/** Records the given pages, in the given order, all on the same day. */
export function readPages(
  journal: ReadingJournal,
  pages: readonly number[],
  date: LocalDate,
): ReadingJournal {
  return pages.reduce<ReadingJournal>(
    (current, page) => recordPageRead(current, { page, date }),
    journal,
  );
}

/** Records the 604 pages in mushaf order, all on the same day. */
export function readWholeKhatma(journal: ReadingJournal, date: LocalDate): ReadingJournal {
  return readPages(journal, pagesFrom(FIRST_PAGE, LAST_PAGE), date);
}

/**
 * Builds a journal from scratch by reading `count` new pages on each listed day. Pages are
 * taken in mushaf order (1, 2, 3...) and wrap to page 1 when a khatma is complete, so every
 * recorded page is a new page of the khatma in progress.
 */
export function journalOfDailyCounts(
  dailyCounts: readonly (readonly [LocalDate, number])[],
): ReadingJournal {
  let journal: ReadingJournal = [];
  let pagesRecorded = 0;
  for (const [date, count] of dailyCounts) {
    for (let read = 0; read < count; read += 1) {
      const page = (pagesRecorded % LAST_PAGE) + 1;
      journal = recordPageRead(journal, { page, date });
      pagesRecorded += 1;
    }
  }
  return journal;
}

/**
 * The entries of a complete khatma written directly, without `recordPageRead`: this is what
 * a journal loaded from storage looks like, and it lets a test build a very long journal
 * quickly.
 */
export function storedKhatmaEntries(khatm: number, date: LocalDate): ReadingEntry[] {
  return pagesFrom(FIRST_PAGE, LAST_PAGE).map((page) => ({ khatm, page, date }));
}

/** Deterministic pseudo-random numbers in [0, 1) (mulberry32), so a failure can be replayed. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** A whole number from `min` to `max`, both included. */
export function randomInteger(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/** A shuffled copy (Fisher-Yates); the input is left untouched. */
export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = randomInteger(random, 0, index);
    const moved = copy[index];
    const swapped = copy[other];
    if (moved === undefined || swapped === undefined) continue;
    copy[index] = swapped;
    copy[other] = moved;
  }
  return copy;
}

/** Freezes a value and everything it holds, so any attempt to mutate it throws. */
export function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

/**
 * Messages of errors that the JavaScript engine throws by accident. The spec asks for an
 * explicit error: one of these means the invalid input was not checked.
 */
const ACCIDENTAL_ERROR_PATTERN =
  /cannot read prop|of undefined|of null|is not a function|is not iterable|invalid time value|maximum call stack|invalid array length/i;

const MAX_DESCRIPTION_LENGTH = 200;

/** A short, readable form of a returned value, for the message of a failed expectation. */
function describeValue(value: unknown): string {
  const text = JSON.stringify(value, (_key, nested: unknown) =>
    nested instanceof Set ? [...nested] : nested,
  );
  return String(text).slice(0, MAX_DESCRIPTION_LENGTH);
}

/**
 * Spec "Entrées invalides": an explicit error. docs/CONTRIBUTING.md names the kinds:
 * `RangeError` or `TypeError`, with a message that says what is wrong.
 */
export function expectExplicitError(action: () => unknown): void {
  let outcome: string;
  try {
    outcome = `returned ${describeValue(action())}`;
  } catch (error) {
    if (error instanceof RangeError || error instanceof TypeError) {
      expect(error.message).not.toBe('');
      expect(error.message).not.toMatch(ACCIDENTAL_ERROR_PATTERN);
      return;
    }
    outcome = `threw ${String(error)}`;
  }
  throw new Error(`Expected an explicit RangeError or TypeError, but the call ${outcome}`);
}

if (expect.getState().testPath?.endsWith('acceptance-kit.ts')) {
  describe('acceptance kit — the tester’s own hizb ranges are valid', () => {
    it.each([
      ['tester ranges', TESTER_HIZB_RANGES, SHARED_PAGES],
      ['even ranges', EVEN_HIZB_RANGES, []],
      ['chained ranges', CHAINED_HIZB_RANGES, pagesFrom(1, 59).map((hizb) => hizb * 10 + 1)],
    ])('%s: 60 hizb covering pages 1 to 604', (_name, ranges, expectedSharedPages) => {
      expect(ranges.map((range) => range.hizb)).toEqual(pagesFrom(1, HIZB_TOTAL));
      expect(ranges[0]?.firstPage).toBe(FIRST_PAGE);
      expect(ranges[HIZB_TOTAL - 1]?.lastPage).toBe(LAST_PAGE);

      const sharedPages: number[] = [];
      ranges.forEach((range, index) => {
        expect(range.firstPage).toBeLessThanOrEqual(range.lastPage);
        const previous = ranges[index - 1];
        if (previous === undefined) return;
        if (range.firstPage === previous.lastPage) sharedPages.push(range.firstPage);
        else expect(range.firstPage).toBe(previous.lastPage + 1);
      });
      expect(sharedPages).toEqual(expectedSharedPages);
    });

    it('seededRandom is deterministic and shuffled keeps every item', () => {
      expect(seededRandom(7)()).toBe(seededRandom(7)());
      const items = pagesFrom(1, 50);
      const mixed = shuffled(items, seededRandom(3));
      expect(mixed).not.toEqual(items);
      expect([...mixed].sort((a, b) => a - b)).toEqual(items);
    });
  });
}
