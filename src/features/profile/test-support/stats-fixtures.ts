import { EMPTY_JOURNAL, recordPageRead, type ReadingJournal } from '@/domain/khatm';
import type { VerseKey } from '@/domain/quran';
import { parseLocalDate, type LocalDate } from '@/domain/shared/local-date';
import type { PageStatsTable } from '@/domain/stats';

/** Words, letters and verses of every page of the made-up mushaf: round numbers to count by hand. */
export const FIXTURE_PAGE = { words: 100, letters: 400, verses: 10 } as const;

/** 604 pages, like the real mushaf, each worth `FIXTURE_PAGE`. Verses never cross a page. */
export function buildFixtureTable(pageCount = 604): PageStatsTable {
  return Array.from({ length: pageCount }, (_, index) => {
    const page = index + 1;
    return {
      page,
      words: FIXTURE_PAGE.words,
      letters: FIXTURE_PAGE.letters,
      endingVerses: Array.from({ length: FIXTURE_PAGE.verses }, (__, verse) => ({
        verse: `${page}:${verse + 1}` as VerseKey,
        pages: [page],
      })),
    };
  });
}

/** A journal written through the khatm module: `pages` pages read on each listed day, in order. */
export function journalOf(
  days: readonly (readonly [date: string, pages: number])[],
): ReadingJournal {
  let journal = EMPTY_JOURNAL;
  let next = 1;
  for (const [date, pages] of days) {
    for (let count = 0; count < pages; count += 1) {
      journal = recordPageRead(journal, { page: next, date: parseLocalDate(date) });
      next = next === 604 ? 1 : next + 1;
    }
  }
  return journal;
}

export const day = (value: string): LocalDate => parseLocalDate(value);
