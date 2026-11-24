/**
 * Public types of the recognition module.
 */
import type { VerseRef } from '../quran/types';

/**
 * The text of one verse, as the corpus provides it. Structurally compatible with `Verse`
 * of the Quran module, so a list of `Verse` can be passed as is.
 */
export interface VerseText extends VerseRef {
  readonly text: string;
}

/** One word of a verse. `word` is its 1-based position inside the verse, as in `MushafWord`. */
export interface WordRef extends VerseRef {
  readonly word: number;
}

/** A passage of the corpus proposed as the source of the heard words. */
export interface PassageCandidate {
  /** First and last word of the passage, both included. They may be in different verses. */
  readonly start: WordRef;
  readonly end: WordRef;
  /**
   * How well this passage explains the input, from 0 to 1: the share of words that agree,
   * counting the heard words and the words of the passage that were not heard.
   */
  readonly score: number;
  /**
   * How much to believe that the reader is reciting *this* passage, from 0 to 1: the score,
   * shared between the passages that compete for the same input. Three passages that fit
   * perfectly get about a third each. An estimate, not a calibrated probability.
   */
  readonly confidence: number;
}

export interface SearchOptions {
  /** Minimal number of usable words in the input. Default: `RECOGNITION_CONFIG.minWords`. */
  readonly minWords?: number;
  /**
   * Minimal score of an accepted passage, 0..1. Default: `RECOGNITION_CONFIG.minScore`,
   * and `shortInputMinScore` for inputs of `shortInputMaxWords` words or fewer.
   */
  readonly minScore?: number;
  /** Lower-ranked passages returned after the best ones. Default: 5. */
  readonly maxAlternatives?: number;
}

/** Why nothing was found: not enough words to search, or no passage good enough. */
export type NotFoundReason = 'too-few-words' | 'no-match';

/**
 * What a result left out. Each flag is present (and true) only when it applies: a result
 * without flags is complete.
 */
export interface SearchLimits {
  /**
   * The list of candidates is not complete: either more places are tied than are listed
   * (`tiedCount` is their total), or the search had to leave some places unexamined
   * (an input made of very common words). Nothing is ever cut silently.
   */
  readonly truncated?: true;
  /**
   * The input was longer than `RECOGNITION_CONFIG.maxHeardWords`: only its most recent
   * words were searched, and the candidates are the place of those words.
   */
  readonly inputTruncated?: true;
}

/**
 * Result of a search. Candidates are ranked, best first.
 *
 * - `found`: one passage explains the input better than every other.
 * - `ambiguous`: `tiedCount` places explain the input equally well (a passage repeated in
 *   several places). They come first in `candidates`, in mushaf order, all of them unless
 *   `truncated` says otherwise; more words will tell them apart.
 * - `not-found`: too few words, or no passage reaches the minimal score. No candidate is
 *   returned rather than a wrong one.
 */
export type SearchResult = SearchLimits &
  (
    | {
        readonly status: 'found';
        readonly candidates: readonly PassageCandidate[];
        readonly tiedCount: 1;
      }
    | {
        readonly status: 'ambiguous';
        readonly candidates: readonly PassageCandidate[];
        /** Total number of tied places; more than are listed when `truncated`. */
        readonly tiedCount: number;
      }
    | {
        readonly status: 'not-found';
        readonly reason: NotFoundReason;
        readonly candidates: readonly [];
        readonly tiedCount: 0;
      }
  );

export interface VerseIndex {
  readonly verseCount: number;
  readonly wordCount: number;
  /**
   * Finds the passages that the heard words may come from.
   * `words` are the words of the transcript, raw or already normalised: each entry goes
   * through `normalizeArabic`, so an entry may also hold several words. Only the most
   * recent `RECOGNITION_CONFIG.maxHeardWords` words are searched.
   */
  search(words: readonly string[], options?: SearchOptions): SearchResult;
}

/**
 * Status of one expected word while following a reader.
 *
 * - `upcoming`: not reached yet.
 * - `current`: the next word the reader is expected to say.
 * - `read`: heard (possibly with transcription noise).
 * - `skipped`: the reader went past it and nothing was heard in its place.
 * - `mistake`: the reader went past it and a clearly different word was heard in its place.
 */
export type WordStatus = 'read' | 'current' | 'upcoming' | 'skipped' | 'mistake';

export interface FollowSnapshot {
  /** One status per expected word, in the order given to `createFollowSession`. */
  readonly statuses: readonly WordStatus[];
  /** Index of the `current` word, or null once every expected word is behind the reader. */
  readonly currentIndex: number | null;
  /**
   * How many of the latest heard words in a row are none of the expected words around the
   * reading position. A growing value means the reader left the expected passage (or the
   * engine is lost): the caller may then locate the reader again with the verse search.
   */
  readonly unmatchedStreak: number;
}

export interface FollowSession {
  /**
   * Adds newly recognised words (not the whole transcript again) and returns the new state.
   * Entries are raw or normalised words; each goes through `normalizeArabic`.
   */
  feed(recognizedWords: readonly string[]): FollowSnapshot;
  /** The current state, without feeding anything. */
  snapshot(): FollowSnapshot;
}
