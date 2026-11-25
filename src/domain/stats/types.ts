import type { VerseKey } from '@/domain/quran';
import type { LocalDate } from '@/domain/shared/local-date';

/** The periods the screen offers. A week starts on Monday; a month on its first day. */
export type StatsPeriod = 'today' | 'week' | 'month' | 'all-time';

/**
 * A verse that ends on a page: every page that holds a word of it, in ascending order. The last
 * one is the page where the verse ends. A verse counts as read once ALL these pages are read in
 * the same khatma.
 */
export interface EndingVerse {
  readonly verse: VerseKey;
  readonly pages: readonly number[];
}

/** What one page of the mushaf adds when it is read. Computed once, never from the text again. */
export interface PageStats {
  /** Mushaf page, 1-based. */
  readonly page: number;
  /** Words printed on the page (a verse cut by the page counts only its words here). */
  readonly words: number;
  /** Letters of those words, by the rule of `countLetters`. */
  readonly letters: number;
  /** The verses whose last word is on this page. */
  readonly endingVerses: readonly EndingVerse[];
}

/** The per-page table, index 0 being page 1. Built by `buildPageStatsTable`. */
export type PageStatsTable = readonly PageStats[];

/** The four numbers of the reading counters, plus the pages they come from. */
export interface ReadingCounts {
  /** Pages read, as the journal counts them (a re-read in the same khatma is not one). */
  readonly pages: number;
  readonly words: number;
  /** Verses whose words are all on pages read in the same khatma. */
  readonly verses: number;
  readonly letters: number;
  /** `letters x HASANAT_PER_LETTER`: an estimate, never a promise. */
  readonly hasanatEstimate: number;
}

/** The counts of one calendar day (the day a page was first read in its khatma). */
export interface DayReadingStats extends ReadingCounts {
  readonly date: LocalDate;
}

/** Seconds the app was in the foreground on one day: all of it, and inside the reader. */
export interface DaySeconds {
  readonly app: number;
  readonly reader: number;
}

/** Time spent by local day, as the store keeps it. A day without time has no key. */
export type SecondsByDay = Readonly<Record<LocalDate, DaySeconds>>;
