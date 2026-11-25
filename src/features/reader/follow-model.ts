/**
 * Following a recitation in the vertical reader (docs/specs/reader.md, section 3b; owner's
 * decision of 25 November 2026). Pure functions: the track of words the voice is followed on, how
 * each verse looks as it goes, the pages it has fully followed, and where the scroll goes.
 *
 * The voice is always matched on the Uthmani words, the text of the mushaf (`followRecitation`,
 * `isSameWordHeard`). In the simple script, a verse whose words are as many as in the Uthmani text
 * is lit word by word, by position; a verse whose two spellings count their words differently
 * (61 verses) is lit as a whole, because a word of one is not always a word of the other.
 */

import { quranStructure } from '@/data/quran';
import type { FollowState } from '@/domain/listening';
import { splitVerseWords, type VerseRef } from '@/domain/quran';
import type { ReaderScript } from '@/store';

import { READER_CONFIG } from './config';

/** One word of the track, in reading order. */
export interface TrackWord extends VerseRef {
  /** Position of the word in its verse, from 0. */
  readonly word: number;
  readonly page: number;
  /** The word exactly as the Uthmani text writes it. */
  readonly text: string;
}

export type WordLook = 'read' | 'current' | 'reread' | 'upcoming';

export type VerseLook =
  | { readonly kind: 'words'; readonly looks: readonly WordLook[] }
  | { readonly kind: 'verse'; readonly look: Exclude<WordLook, 'upcoming'> };

/** The words of `pageCount` pages from the verse `start`, never past the end of the Quran. */
export function buildFollowTrack(
  start: VerseRef,
  uthmaniTextOf: (ref: VerseRef) => string,
  pageCount: number,
): readonly TrackWord[] {
  quranStructure.assertVerse(start);
  const firstPage = quranStructure.pageOfVerse(start);
  const lastPage = firstPage + pageCount - 1;
  const track: TrackWord[] = [];
  let ref: VerseRef | null = start;
  while (ref !== null) {
    const page = quranStructure.pageOfVerse(ref);
    if (page > lastPage) break;
    splitVerseWords(uthmaniTextOf(ref)).forEach((text, word) => {
      track.push({ surah: ref!.surah, verse: ref!.verse, word, page, text });
    });
    ref = nextVerse(ref);
  }
  return track;
}

/** The verse after this one, or null after the last verse of the Quran. */
export function nextVerse({ surah, verse }: VerseRef): VerseRef | null {
  if (verse < quranStructure.surah(surah).verseCount) return { surah, verse: verse + 1 };
  return surah < quranStructure.surahs.length ? { surah: surah + 1, verse: 1 } : null;
}

function lookAt(index: number, state: FollowState): WordLook {
  if (index === state.reread) return 'reread';
  if (index === state.current) return 'current';
  return index < state.next ? 'read' : 'upcoming';
}

/**
 * How a verse looks: null when the voice has not reached it (it is drawn as usual). In the simple
 * script, `simpleWordCount` is the number of words of the verse in that script.
 */
export function verseLook(
  track: readonly TrackWord[],
  state: FollowState,
  ref: VerseRef,
  script: ReaderScript,
  simpleWordCount: number,
): VerseLook | null {
  const first = track.findIndex((word) => word.surah === ref.surah && word.verse === ref.verse);
  if (first === -1) return null;
  let last = first;
  while (track[last + 1]?.surah === ref.surah && track[last + 1]?.verse === ref.verse) last += 1;
  const looks: WordLook[] = [];
  for (let index = first; index <= last; index += 1) looks.push(lookAt(index, state));
  if (looks.every((look) => look === 'upcoming')) return null;
  if (script === 'uthmani' || simpleWordCount === looks.length) return { kind: 'words', looks };
  const look = looks.includes('reread')
    ? 'reread'
    : looks.includes('current') || looks.includes('upcoming')
      ? 'current'
      : 'read';
  return { kind: 'verse', look };
}

/**
 * The pages whose every word the voice recited in this following: the track holds the page from
 * its first verse, and the recitation went past its last word. A page the following started in
 * the middle of is not one of them (its first lines were not recited).
 */
export function pagesFollowedByVoice(
  track: readonly TrackWord[],
  state: FollowState,
): readonly number[] {
  const pages: number[] = [];
  let index = 0;
  while (index < track.length) {
    const page = track[index]!.page;
    let end = index;
    while (track[end + 1]?.page === page) end += 1;
    const pageStart = quranStructure.firstVerseOfPage(page);
    const trackStart = track[0]!;
    // Only the first page of the track can begin in its middle.
    const startsAtPageStart =
      index > 0 || (pageStart.surah === trackStart.surah && pageStart.verse === trackStart.verse);
    if (startsAtPageStart && state.next > end) pages.push(page);
    index = end + 1;
  }
  return pages;
}

export interface FollowScrollInput {
  /** Where the paragraph of the current verse lies in the scroll's content, and its height. */
  readonly paragraphTop: number;
  readonly paragraphHeight: number;
  /** The line height of the text, before the person's text size: lines are counted with it. */
  readonly lineHeight: number;
  /** Characters of the paragraph before the current word, and in all. */
  readonly charsBefore: number;
  readonly totalChars: number;
  readonly viewportHeight: number;
}

/**
 * The scroll offset that puts the line of the current word at the reading line. A word's place
 * inside a paragraph cannot be measured; justified lines hold about the same number of
 * characters, so the share of characters before the word gives its line. Never above the top.
 */
export function followScrollOffset({
  paragraphTop,
  paragraphHeight,
  lineHeight,
  charsBefore,
  totalChars,
  viewportHeight,
}: FollowScrollInput): number {
  const lines = Math.max(1, Math.round(paragraphHeight / lineHeight));
  const share = totalChars > 0 ? Math.min(1, Math.max(0, charsBefore / totalChars)) : 0;
  const line = Math.min(lines - 1, Math.floor(share * lines));
  const lineTop = paragraphTop + (line * paragraphHeight) / lines;
  return Math.max(0, lineTop - READER_CONFIG.readingLineRatio * viewportHeight);
}

/**
 * Where a recitation starts: the first verse, on the page being read, of the surah under the
 * reading line (a verse's own place inside a paragraph cannot be measured, so the following starts
 * at the beginning of that part of the page).
 */
export function followStartVerse(page: number, surah: number): VerseRef {
  const first = quranStructure.firstVerseOfPage(page);
  if (surah === first.surah) return first;
  const last = quranStructure.lastVerseOfPage(page);
  if (surah > first.surah && surah <= last.surah) return { surah, verse: 1 };
  return first;
}
