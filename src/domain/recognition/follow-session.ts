/**
 * Word-by-word following of a reader.
 *
 * The session knows the expected words and receives the recognised words as they come.
 * For each new word:
 * - if it is the current word, that word is read and the position moves on;
 * - otherwise the latest heard words are aligned with the expected words around the
 *   position (see align.ts) to see where the new word falls: behind (the reader repeats),
 *   or ahead (words were passed over). The position only moves as far as this is certain.
 *
 * The guiding rule: a word wrongly shown as a mistake is worse than a missed mistake.
 * - A word is declared passed (`skipped` or `mistake`) only once enough following words
 *   were recognised after it.
 * - `mistake` needs a clearly different word heard at that very place, whatever the place
 *   (the first word included). A passed word with nothing heard at its place is `skipped`.
 * - Repeating or going back never creates an error: repeated words are just extra words.
 * - A status never gets worse: `read` stays `read`; a `skipped` or `mistake` word that is
 *   read again correctly becomes `read`.
 */
import { alignWords, type AlignedPair } from './align';
import {
  isClearlyDifferent,
  isCloseEnough,
  isPartOfWord,
  isTooLongToBeAWord,
  toComparableWords,
  wordSimilarity,
  type ComparableWord,
} from './comparable-word';
import { RECOGNITION_CONFIG } from './config';
import { endsOpeningFormula } from './opening-formulas';
import type { FollowSession, FollowSnapshot, WordStatus } from './types';

/** Status of a word the reader has gone past. */
type SettledStatus = 'read' | 'skipped' | 'mistake';

/** What the alignment says about one expected word. */
interface HeardAtPlace {
  readonly expectedIndex: number;
  /** Index, in the latest heard words, of the first and last word heard at this place. */
  readonly heardIndex: number;
  readonly lastHeardIndex: number;
  /** True when the expected word itself was recognised. */
  readonly matched: boolean;
  /** Status of the expected word if the reader turns out to have gone past it. */
  readonly statusIfPassed: SettledStatus;
}

/**
 * Starts following a reader over `expectedWords` (one word per entry, as displayed).
 * Throws when the list is empty or when an entry is not exactly one Arabic word.
 */
export function createFollowSession(expectedWords: readonly string[]): FollowSession {
  const expected = readExpectedWords(expectedWords);
  /** Status of the words behind the reading position; null for the words not reached yet. */
  const settled: (SettledStatus | null)[] = expected.map(() => null);
  /** Index of the next expected word: every word before it is settled. */
  let position = 0;
  /** The latest heard words, oldest first. */
  let recentHeard: ComparableWord[] = [];
  /**
   * How many of the latest heard words came after the position last moved. Only these
   * can show that the reader went past a word: the older ones already served to get here.
   */
  let freshHeardCount = 0;
  let unmatchedStreak = 0;

  function hear(word: ComparableWord): void {
    recentHeard = [...recentHeard, word].slice(-RECOGNITION_CONFIG.recentHeardWords);
    freshHeardCount = Math.min(freshHeardCount + 1, recentHeard.length);
    const from = Math.max(0, position - RECOGNITION_CONFIG.lookBehindWords);
    const to = Math.min(expected.length, position + RECOGNITION_CONFIG.lookAheadWords);
    const isAnExpectedWordNearby = expected.slice(from, to).some((near) => isSameWord(word, near));
    unmatchedStreak = isAnExpectedWordNearby ? 0 : unmatchedStreak + 1;

    // The usual case: the reader says the current word right after the previous one.
    // After words that are still unexplained, the alignment below decides instead: the
    // same word may come again two words further (إِلَّا قَلِيلٌ إِلَّا), and those words count.
    const current = expected[position];
    const followsLastMove = freshHeardCount === 1;
    if (followsLastMove && current !== undefined && isSameWord(word, current)) {
      settled[position] = 'read';
      position += 1;
      freshHeardCount = 0;
      return;
    }
    // Otherwise: where does the new word fall, given the words heard just before it?
    const pairs = alignWords(recentHeard, expected, from, to, { goal: 'chain-of-last-heard-word' });
    const places = pairs.flatMap((pair) => placesOf(pair, recentHeard, expected));
    repairWordsReadAgain(places);
    const firstFreshIndex = recentHeard.length - freshHeardCount;
    const freshPlacesAhead = places.filter(
      (place) => place.expectedIndex >= position && place.heardIndex >= firstFreshIndex,
    );
    moveForward([...placesHeardJustBefore(pairs[0], firstFreshIndex), ...freshPlacesAhead]);
  }

  /**
   * The words heard right before the first recognised word, when nothing recognised comes
   * before them: they were said in the place of the expected words right before it, the
   * last heard one against the last expected one. This is how a wrong first word is seen:
   * the alignment only starts at the first word it recognises.
   *
   * The isti'adha and the basmala are the exception: a reader says them before a passage,
   * not in the place of its first words. An expected word with only such a formula heard
   * before it was not heard (skipped), not misread.
   */
  function placesHeardJustBefore(
    firstPair: AlignedPair | undefined,
    firstFreshIndex: number,
  ): HeardAtPlace[] {
    const places: HeardAtPlace[] = [];
    if (firstPair === undefined) return places;
    let heardIndex = firstPair.heardIndex - 1;
    let expectedIndex = firstPair.referenceIndex - 1;
    while (heardIndex >= firstFreshIndex && expectedIndex >= position) {
      if (endsOpeningFormula(recentHeard, heardIndex)) break;
      places.unshift({
        expectedIndex,
        heardIndex,
        lastHeardIndex: heardIndex,
        matched: false,
        statusIfPassed: statusOfReplacedWord(recentHeard[heardIndex], expected[expectedIndex]),
      });
      heardIndex -= 1;
      expectedIndex -= 1;
    }
    return places;
  }

  /**
   * A skipped or mistaken word behind the reader that is read again correctly becomes
   * `read`. One recognised word could be a coincidence: the chain must hold at least
   * `confirmationWords` of them.
   */
  function repairWordsReadAgain(places: readonly HeardAtPlace[]): void {
    const recognised = places.filter((place) => place.matched);
    if (recognised.length < RECOGNITION_CONFIG.confirmationWords) return;
    for (const place of recognised) {
      if (place.expectedIndex < position) settled[place.expectedIndex] = 'read';
    }
  }

  /**
   * Moves the reading position over the recognised words ahead of it.
   * `placesAhead` are in reading order, at or after the position, and heard since the
   * position last moved.
   */
  function moveForward(placesAhead: readonly HeardAtPlace[]): void {
    let remaining = placesAhead;
    for (;;) {
      const nextMatch = remaining.findIndex((place) => place.matched);
      const matchedPlace = remaining[nextMatch];
      if (matchedPlace === undefined) return;

      // Words between the position and the recognised word would be passed over: this
      // needs enough recognised words from here on.
      const passedCount = matchedPlace.expectedIndex - position;
      const recognisedFromHere = remaining.slice(nextMatch).filter((place) => place.matched).length;
      if (passedCount > 0) {
        if (recognisedFromHere < confirmationNeeded(passedCount)) return;
        if (couldBeRepetition(matchedPlace.heardIndex, recognisedFromHere)) return;
      }

      // A passed word with nothing heard at its place was skipped.
      const heardInstead = remaining.slice(0, nextMatch);
      for (let index = position; index < matchedPlace.expectedIndex; index += 1) {
        const place = heardInstead.find((candidate) => candidate.expectedIndex === index);
        settled[index] = place?.statusIfPassed ?? 'skipped';
      }
      settled[matchedPlace.expectedIndex] = 'read';
      position = matchedPlace.expectedIndex + 1;
      freshHeardCount = recentHeard.length - 1 - matchedPlace.lastHeardIndex;
      remaining = remaining.slice(nextMatch + 1);
    }
  }

  /**
   * True when the words heard from `heardIndex` on match the words just read at least as
   * well as the `recognisedAhead` words they match further on: the reader is more likely
   * repeating a phrase than jumping to the same phrase ahead (refrains are common).
   */
  function couldBeRepetition(heardIndex: number, recognisedAhead: number): boolean {
    const from = Math.max(0, position - RECOGNITION_CONFIG.lookBehindWords);
    const behind = alignWords(recentHeard.slice(heardIndex), expected, from, position);
    const recognisedBehind = behind.filter((pair) => pair.matched).length;
    return recognisedBehind >= recognisedAhead;
  }

  function snapshot(): FollowSnapshot {
    const statuses = settled.map((status, index): WordStatus => {
      if (status !== null) return status;
      return index === position ? 'current' : 'upcoming';
    });
    return {
      statuses,
      currentIndex: position < expected.length ? position : null,
      unmatchedStreak,
    };
  }

  return {
    feed(recognizedWords) {
      for (const word of toComparableWords(recognizedWords, 'recognizedWords')) hear(word);
      return snapshot();
    },
    snapshot,
  };
}

function isSameWord(heard: ComparableWord, expected: ComparableWord): boolean {
  return isCloseEnough(wordSimilarity(heard, expected));
}

function readExpectedWords(expectedWords: readonly string[]): ComparableWord[] {
  if (!Array.isArray(expectedWords)) throw new TypeError('expectedWords must be a list of strings');
  if (expectedWords.length === 0) throw new RangeError('expectedWords must hold at least one word');
  return expectedWords.map((text, index) => {
    const words = toComparableWords([text], 'expectedWords');
    const [word] = words;
    if (word === undefined || words.length !== 1) {
      throw new TypeError(
        `expectedWords[${index}] must be exactly one Arabic word, found ${words.length}`,
      );
    }
    if (isTooLongToBeAWord(word)) {
      throw new RangeError(
        `expectedWords[${index}] has ${word.key.length} letters: more than ` +
          `${RECOGNITION_CONFIG.maxWordLetters}, not a word of the Quran`,
      );
    }
    return word;
  });
}

/** One entry per expected word covered by a pair of the alignment. */
function placesOf(
  pair: AlignedPair,
  heard: readonly ComparableWord[],
  expected: readonly ComparableWord[],
): HeardAtPlace[] {
  const places: HeardAtPlace[] = [];
  for (let offset = 0; offset < pair.referenceCount; offset += 1) {
    const expectedIndex = pair.referenceIndex + offset;
    places.push({
      expectedIndex,
      heardIndex: pair.heardIndex,
      lastHeardIndex: pair.heardIndex + pair.heardCount - 1,
      matched: pair.matched,
      statusIfPassed: statusIfPassed(pair, heard[pair.heardIndex], expected[expectedIndex]),
    });
  }
  return places;
}

/** Status of an expected word that the reader went past, given the pair that covers it. */
function statusIfPassed(
  pair: AlignedPair,
  heardWord: ComparableWord | undefined,
  expectedWord: ComparableWord | undefined,
): SettledStatus {
  return pair.matched ? 'read' : statusOfReplacedWord(heardWord, expectedWord);
}

/** Status of an expected word that the reader went past, another word being heard at its place. */
function statusOfReplacedWord(
  heardWord: ComparableWord | undefined,
  expectedWord: ComparableWord | undefined,
): SettledStatus {
  if (heardWord === undefined || expectedWord === undefined) return 'skipped';
  // Something close to the word was heard: the reader gets the benefit of the doubt.
  if (!isClearlyDifferent(wordSimilarity(heardWord, expectedWord))) return 'read';
  // Only a part of the word was heard: not heard in full, which is not a misreading.
  return isPartOfWord(heardWord, expectedWord) ? 'skipped' : 'mistake';
}

/** Recognised words needed after a gap before declaring its words passed. */
function confirmationNeeded(passedCount: number): number {
  return passedCount <= RECOGNITION_CONFIG.shortGapWords
    ? RECOGNITION_CONFIG.confirmationWords
    : RECOGNITION_CONFIG.longJumpConfirmationWords;
}
