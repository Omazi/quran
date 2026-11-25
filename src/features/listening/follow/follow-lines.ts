import type { MushafWord } from '@/domain/quran';

/**
 * The lines of a followed page, as the follow page draws them. Kept for the first launch's
 * demonstration of recitation following (the reader draws its own lines).
 */

/** A word of the followed page, with its place in the page's reading order. */
export interface FollowWord {
  readonly index: number;
  readonly word: MushafWord;
}

/** A line of the followed page: its words, and the verses that end after which of them. */
export interface FollowLine {
  readonly words: readonly FollowWord[];
  readonly verseEnds: readonly { readonly afterWordIndex: number; readonly verse: number }[];
}
