/**
 * Where a recognised passage is in the mushaf: its verses, and the page to open.
 */
import type { QuranStructure, VerseRef } from '../quran';
import type { PassageCandidate } from '../recognition';

export interface PassageLocation {
  /** First and last verse of the passage. They may be in different surahs. */
  readonly firstVerse: VerseRef;
  readonly lastVerse: VerseRef;
  /** The mushaf page on which the passage starts: the one the reader opens. */
  readonly page: number;
}

/**
 * The verses of a passage and the page where it starts. The structure refuses a verse that does
 * not exist (`RangeError`): no page is ever made up.
 */
export function locatePassage(
  passage: PassageCandidate,
  structure: Pick<QuranStructure, 'pageOfVerse'>,
): PassageLocation {
  const firstVerse: VerseRef = { surah: passage.start.surah, verse: passage.start.verse };
  const lastVerse: VerseRef = { surah: passage.end.surah, verse: passage.end.verse };
  return { firstVerse, lastVerse, page: structure.pageOfVerse(firstVerse) };
}
