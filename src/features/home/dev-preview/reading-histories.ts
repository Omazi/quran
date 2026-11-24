/**
 * DEVELOPMENT ONLY: made-up reading histories that put the garden in each of its states.
 *
 * Used by the tests and by the developer preview of the home screen (`dev-preview.tsx`). The
 * app itself only shows what the store holds: this folder is loaded only when `__DEV__` is true
 * and is absent from a production bundle.
 *
 * Each history is a real reading journal, written page by page through the khatm module
 * (`recordPageRead`): the garden and the numbers on screen are then computed by the same code as
 * for a real person. Nothing here is saved anywhere.
 */

import { DEFAULT_GARDEN_CONFIG } from '@/domain/garden';
import {
  EMPTY_JOURNAL,
  recordPageRead,
  type HizbPageRange,
  type ReadingJournal,
} from '@/domain/khatm';
import { addDays, type LocalDate } from '@/domain/shared/local-date';

import type { HomeSource } from '../home-model';

export const READING_HISTORIES = [
  /** The first day: nothing read yet. */
  'bare-earth',
  /** Hizb 24, read every day, three pages already read today. */
  'thriving',
  /** The same garden after 3 days without reading. */
  'thirsty',
  /** After 6 days. */
  'wilting',
  /** After 10 days. */
  'dying',
  /** After 14 days. */
  'dead',
  /** After 14 days, on the day one page is read again. */
  'recovering',
  /** The 604 pages read, the last ones today. */
  'khatma-complete',
] as const;

export type ReadingHistoryName = (typeof READING_HISTORIES)[number];

/** The numbers of the histories. They are examples, not rules of the app. */
export const READING_HISTORY_CONFIG = {
  /** The goal of the example in the specification: "3 pages sur 5". */
  dailyGoalPages: 5,
  /** Any seed gives a valid garden; this one is fixed so that the histories never change. */
  userSeed: 2026,
  /** The hizb the garden of the histories has reached. */
  gardenHizb: 24,
  /** Pages read on each day of the made-up history of the garden. */
  gardenPagesPerDay: 10,
  /** Pages already read today in the thriving history. */
  pagesReadToday: 3,
  /** Pages read on each day of the made-up complete khatma. */
  khatmaPagesPerDay: 20,
} as const;

/**
 * Days without reading of each history of a drying garden: the days on which the garden module
 * gives a new phase to a garden that was in full health. Read from its settings, not copied.
 */
const DAYS_WITHOUT_READING = {
  thirsty: DEFAULT_GARDEN_CONFIG.thirstyMinDroughtDays,
  wilting: DEFAULT_GARDEN_CONFIG.wiltingMinDroughtDays,
  dying: DEFAULT_GARDEN_CONFIG.dyingMinDroughtDays,
  dead: DEFAULT_GARDEN_CONFIG.droughtDaysToDeath,
} as const;

/**
 * Reads the pages from `firstPage` to `lastPage` in order, `pagesPerDay` a day, without missing
 * a day, the last ones on `lastDay`.
 */
function readPages(
  journal: ReadingJournal,
  firstPage: number,
  lastPage: number,
  pagesPerDay: number,
  lastDay: LocalDate,
): ReadingJournal {
  const pageCount = lastPage - firstPage + 1;
  const lastDayIndex = Math.ceil(pageCount / pagesPerDay) - 1;
  let next = journal;
  for (let index = 0; index < pageCount; index += 1) {
    const dayIndex = Math.floor(index / pagesPerDay);
    next = recordPageRead(next, {
      page: firstPage + index,
      date: addDays(lastDay, dayIndex - lastDayIndex),
    });
  }
  return next;
}

/** The last page of a hizb, from the structure of the mushaf. */
function lastPageOfHizb(hizb: number, hizbPageRanges: readonly HizbPageRange[]): number {
  const range = hizbPageRanges.find((candidate) => candidate.hizb === hizb);
  if (range === undefined) throw new RangeError(`There is no hizb ${hizb} in the page ranges.`);
  return range.lastPage;
}

/** A garden at the hizb of the histories, last watered `daysWithoutReading` full days ago. */
function gardenJournal(
  daysWithoutReading: number,
  today: LocalDate,
  hizbPageRanges: readonly HizbPageRange[],
): ReadingJournal {
  const firstPage = hizbPageRanges[0]?.firstPage;
  if (firstPage === undefined) throw new RangeError('The hizb page ranges are empty.');
  return readPages(
    EMPTY_JOURNAL,
    firstPage,
    lastPageOfHizb(READING_HISTORY_CONFIG.gardenHizb, hizbPageRanges),
    READING_HISTORY_CONFIG.gardenPagesPerDay,
    // Today is still open: the days without reading end yesterday.
    addDays(today, -(daysWithoutReading + 1)),
  );
}

function buildJournal(
  name: ReadingHistoryName,
  today: LocalDate,
  hizbPageRanges: readonly HizbPageRange[],
): ReadingJournal {
  switch (name) {
    case 'bare-earth':
      return EMPTY_JOURNAL;
    case 'thriving': {
      const untilYesterday = gardenJournal(0, today, hizbPageRanges);
      const nextPage = lastPageOfHizb(READING_HISTORY_CONFIG.gardenHizb, hizbPageRanges) + 1;
      return readPages(
        untilYesterday,
        nextPage,
        nextPage + READING_HISTORY_CONFIG.pagesReadToday - 1,
        READING_HISTORY_CONFIG.pagesReadToday,
        today,
      );
    }
    case 'thirsty':
    case 'wilting':
    case 'dying':
    case 'dead':
      return gardenJournal(DAYS_WITHOUT_READING[name], today, hizbPageRanges);
    case 'recovering': {
      const dead = gardenJournal(DAYS_WITHOUT_READING.dead, today, hizbPageRanges);
      const nextPage = lastPageOfHizb(READING_HISTORY_CONFIG.gardenHizb, hizbPageRanges) + 1;
      return recordPageRead(dead, { page: nextPage, date: today });
    }
    case 'khatma-complete': {
      const firstPage = hizbPageRanges[0]?.firstPage;
      const lastPage = hizbPageRanges[hizbPageRanges.length - 1]?.lastPage;
      if (firstPage === undefined || lastPage === undefined) {
        throw new RangeError('The hizb page ranges are empty.');
      }
      return readPages(
        EMPTY_JOURNAL,
        firstPage,
        lastPage,
        READING_HISTORY_CONFIG.khatmaPagesPerDay,
        today,
      );
    }
  }
}

/** The journal and settings of a history, as they would be on `today`. Pure. */
export function buildReadingHistory(
  name: ReadingHistoryName,
  today: LocalDate,
  hizbPageRanges: readonly HizbPageRange[],
): HomeSource {
  return {
    journal: buildJournal(name, today, hizbPageRanges),
    settings: {
      dailyGoalPages: READING_HISTORY_CONFIG.dailyGoalPages,
      userSeed: READING_HISTORY_CONFIG.userSeed,
      pauses: [],
    },
  };
}
