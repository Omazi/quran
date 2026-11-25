/**
 * How long a page of the mushaf must be read before it counts (docs/specs/reader.md, section 3;
 * owner's decision of 25 November 2026). The time grows with the page: a fixed time per word of
 * that page, never less than a floor, so that the short pages (1, 2, 604) count too. The values
 * are the reader's settings, given by the caller; this rule only does the arithmetic.
 */

export interface ReadingTimeRules {
  /** Seconds asked for each word of the page: a positive number. */
  readonly secondsPerWord: number;
  /** The least a page asks, in seconds: a number from 0. */
  readonly minimumSeconds: number;
}

/** Seconds of reading a page of `wordCount` words asks before it counts. */
export function requiredReadingSeconds(wordCount: number, rules: ReadingTimeRules): number {
  if (!Number.isInteger(wordCount) || wordCount < 1) {
    throw new RangeError(`A page has a whole number of words from 1, not ${wordCount}.`);
  }
  const { secondsPerWord, minimumSeconds } = rules;
  if (!Number.isFinite(secondsPerWord) || secondsPerWord <= 0) {
    throw new RangeError(`The time per word must be a positive number, not ${secondsPerWord}.`);
  }
  if (!Number.isFinite(minimumSeconds) || minimumSeconds < 0) {
    throw new RangeError(`The minimum time must be a number from 0, not ${minimumSeconds}.`);
  }
  return Math.max(minimumSeconds, wordCount * secondsPerWord);
}
