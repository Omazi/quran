/**
 * Which passage the words heard so far name, for the listening screen.
 *
 * The passage search scores a passage by the share of the input it explains
 * (docs/specs/recognition.md). A real transcription of an ordinary reader is noisy, and the
 * noise of the first words (a mangled isti'adha, a hesitation) weighs on every later search: with
 * all the words, a passage recited cleanly afterwards may never reach the threshold. So when the
 * search over all the words does not find a passage, the latest words are searched alone too,
 * with the same thresholds. Measured on recordings of ordinary readers, D42.
 *
 * Never sure wrongly: only a `found` of the latest words replaces the answer for all the words;
 * otherwise the answer for all the words stands (an `ambiguous` with every tied place, a
 * `not-found` with its reason).
 */
import type { SearchResult, VerseIndex } from '../recognition';

export const HEARD_SEARCH = Object.freeze({
  /**
   * How many of the latest words are searched alone. Eight: on random inputs of the Quran's own
   * words, a window of eight was never found (0 of 400 inputs of 14 words, every window tried),
   * a window of six was once (1 of 400); see D42.
   */
  recentWords: 8,
});

export function searchHeardWords(index: VerseIndex, words: readonly string[]): SearchResult {
  const all = index.search(words);
  if (all.status === 'found' || words.length <= HEARD_SEARCH.recentWords) return all;
  const recent = index.search(words.slice(-HEARD_SEARCH.recentWords));
  return recent.status === 'found' ? recent : all;
}

/**
 * The search while a phrase is still being read (D45): the final words, then the words of the
 * latest reading that are not final yet. Whisper only makes a word final once two readings in a
 * row agree on it, about a reading later than it first wrote it: searching these words too
 * announces the passage about 1.3 s sooner (median, measured on 312 clips), with the same
 * thresholds and no passage announced wrongly. Only a `found` counts (the words not final yet may
 * still change): otherwise null, and the answer for the final words stands.
 */
export function searchWithPartialWords(
  index: VerseIndex,
  finalWords: readonly string[],
  partialWords: readonly string[],
): SearchResult | null {
  if (partialWords.length === 0) return null;
  const result = searchHeardWords(index, [...finalWords, ...partialWords]);
  return result.status === 'found' ? result : null;
}
