/**
 * The measures that the spec asks to report, as plain functions. Not part of the module.
 *
 * `uthmani` is the reference text. `spoken` plays the speech engine: ideally an imla'i
 * text of the same verses (Tanzil Simple); failing that, the Uthmani text itself, which
 * then says nothing about how well the two scripts are brought together.
 * Everything is drawn from a seed: same inputs, same numbers.
 */
import { createFollowSession, normalizeArabic } from '../index';
import type { SearchResult, VerseIndex, VerseText, WordRef } from '../types';

import {
  createRandom,
  pickOne,
  randomInteger,
  withNoise,
  withSimulatedErrors,
  type NoiseProfile,
  type Random,
} from './noise';

/** A clock in milliseconds, injected (tests pass `performance.now`). */
export type Clock = () => number;

// ---- Normalisation ------------------------------------------------------------------------

export interface NormalizationMeasure {
  readonly verses: number;
  /** Verses whose normalised Uthmani and imla'i words are identical. */
  readonly identicalVerses: number;
  /** Mean number of word edits between the two, over the verses that differ. */
  readonly meanWordEditsWhenDifferent: number;
  /** Share of all words that differ (word edits over Uthmani words). */
  readonly differingWordRate: number;
}

export function measureNormalization(
  uthmani: readonly VerseText[],
  imlaei: readonly VerseText[],
): NormalizationMeasure {
  let identicalVerses = 0;
  let wordEdits = 0;
  let words = 0;
  uthmani.forEach((verse, index) => {
    const uthmaniWords = normalizeArabic(verse.text);
    const imlaeiWords = normalizeArabic(imlaei[index]?.text ?? '');
    words += uthmaniWords.length;
    const edits = wordEditDistance(uthmaniWords, imlaeiWords);
    if (edits === 0) identicalVerses += 1;
    wordEdits += edits;
  });
  const differentVerses = uthmani.length - identicalVerses;
  return {
    verses: uthmani.length,
    identicalVerses,
    meanWordEditsWhenDifferent: differentVerses === 0 ? 0 : wordEdits / differentVerses,
    differingWordRate: wordEdits / words,
  };
}

/** Edit distance between two lists of words (insert, delete or replace a word). */
export function wordEditDistance(first: readonly string[], second: readonly string[]): number {
  let previousRow = second.map((_, column) => column);
  previousRow.push(second.length);
  first.forEach((word, row) => {
    const currentRow = [row + 1];
    second.forEach((other, column) => {
      const replaceCost = word === other ? 0 : 1;
      currentRow.push(
        Math.min(
          (previousRow[column + 1] ?? 0) + 1,
          (currentRow[column] ?? 0) + 1,
          (previousRow[column] ?? 0) + replaceCost,
        ),
      );
    });
    previousRow = currentRow;
  });
  return previousRow[second.length] ?? 0;
}

// ---- Shared preparation -------------------------------------------------------------------

/** Both texts as flat lists of normalised words, with the place of each verse. */
interface PreparedTexts {
  readonly uthmaniWords: readonly string[];
  readonly uthmaniVerseStarts: readonly number[];
  readonly spokenWords: readonly string[];
  readonly spokenVerseStarts: readonly number[];
  /** Verse number of each spoken word (index in the list of verses). */
  readonly spokenVerseOfWord: readonly number[];
  readonly verseIndexByKey: ReadonlyMap<string, number>;
}

function prepareTexts(uthmani: readonly VerseText[], spoken: readonly VerseText[]): PreparedTexts {
  const uthmaniWords: string[] = [];
  const uthmaniVerseStarts: number[] = [];
  const spokenWords: string[] = [];
  const spokenVerseStarts: number[] = [];
  const spokenVerseOfWord: number[] = [];
  const verseIndexByKey = new Map<string, number>();
  uthmani.forEach((verse, verseIndex) => {
    verseIndexByKey.set(`${verse.surah}:${verse.verse}`, verseIndex);
    uthmaniVerseStarts.push(uthmaniWords.length);
    uthmaniWords.push(...normalizeArabic(verse.text));
    spokenVerseStarts.push(spokenWords.length);
    for (const word of normalizeArabic(spoken[verseIndex]?.text ?? '')) {
      spokenWords.push(word);
      spokenVerseOfWord.push(verseIndex);
    }
  });
  return {
    uthmaniWords,
    uthmaniVerseStarts,
    spokenWords,
    spokenVerseStarts,
    spokenVerseOfWord,
    verseIndexByKey,
  };
}

/**
 * Position in the Uthmani text of a word of the spoken text: same verse, same rank.
 * The two scripts cut a few words differently (يا أيها), so this can be a few words off;
 * `isSamePassage` leaves room for it.
 */
function uthmaniPositionOf(texts: PreparedTexts, spokenPosition: number): number {
  const verseIndex = texts.spokenVerseOfWord[spokenPosition] ?? 0;
  const rank = spokenPosition - (texts.spokenVerseStarts[verseIndex] ?? 0);
  return (texts.uthmaniVerseStarts[verseIndex] ?? 0) + rank;
}

function positionOf(texts: PreparedTexts, ref: WordRef): number {
  const verseIndex = texts.verseIndexByKey.get(`${ref.surah}:${ref.verse}`) ?? 0;
  return (texts.uthmaniVerseStarts[verseIndex] ?? 0) + ref.word - 1;
}

/**
 * A returned passage is the right one when it shares at least this share of its words
 * with the true passage (and of the true passage's words with it). A passage found
 * elsewhere shares none; the margin leaves room for words cut differently by the two
 * scripts and for errors that hide the first or last words.
 */
const MIN_SHARED_WORDS_RATE = 0.5;

function isSamePassage(start: number, end: number, trueStart: number, trueEnd: number): boolean {
  const sharedWords = Math.min(end, trueEnd) - Math.max(start, trueStart) + 1;
  const longest = Math.max(end - start, trueEnd - trueStart) + 1;
  return sharedWords >= longest * MIN_SHARED_WORDS_RATE;
}

// ---- Passage search -----------------------------------------------------------------------

export interface SearchMeasureOptions {
  readonly seed: number;
  readonly passages: number;
  readonly minWords: number;
  readonly maxWords: number;
  readonly errorCounts: readonly number[];
  readonly now: Clock;
}

export interface SearchOutcomeCounts {
  passages: number;
  /** `found`, and it is the right passage. */
  foundRight: number;
  /** `ambiguous`, and the right passage is among the tied ones. */
  ambiguousWithRight: number;
  /** A passage was returned and the right one is not the answer. */
  wrong: number;
  notFound: number;
}

export interface SearchMeasure {
  readonly errorCount: number;
  /** Passages that occur once in the corpus. */
  readonly unique: SearchOutcomeCounts;
  /** Passages that occur word for word in several places. */
  readonly repeated: SearchOutcomeCounts;
  readonly meanSearchMs: number;
  readonly slowestSearchMs: number;
}

export function measureSearch(
  index: VerseIndex,
  uthmani: readonly VerseText[],
  spoken: readonly VerseText[],
  options: SearchMeasureOptions,
): SearchMeasure[] {
  const texts = prepareTexts(uthmani, spoken);
  const occurrencesOf = occurrenceCounter(texts.spokenWords);

  return options.errorCounts.map((errorCount) => {
    // The same passages for every error count: only the damage changes.
    const random = createRandom(options.seed);
    const unique = emptyCounts();
    const repeated = emptyCounts();
    let totalMs = 0;
    let slowestSearchMs = 0;

    for (let passage = 0; passage < options.passages; passage += 1) {
      const length = randomInteger(random, options.minWords, options.maxWords);
      const spokenStart = randomInteger(random, 0, texts.spokenWords.length - length);
      const clean = texts.spokenWords.slice(spokenStart, spokenStart + length);
      const heard = withSimulatedErrors(clean, errorCount, texts.spokenWords, random);
      const trueStart = uthmaniPositionOf(texts, spokenStart);
      const trueEnd = uthmaniPositionOf(texts, spokenStart + length - 1);

      const before = options.now();
      const result = index.search(heard);
      const elapsed = options.now() - before;
      totalMs += elapsed;
      slowestSearchMs = Math.max(slowestSearchMs, elapsed);

      const isRepeated = occurrencesOf(clean) > 1;
      countOutcome(isRepeated ? repeated : unique, result, texts, trueStart, trueEnd);
    }
    return {
      errorCount,
      unique,
      repeated,
      meanSearchMs: totalMs / options.passages,
      slowestSearchMs,
    };
  });
}

function emptyCounts(): SearchOutcomeCounts {
  return { passages: 0, foundRight: 0, ambiguousWithRight: 0, wrong: 0, notFound: 0 };
}

function countOutcome(
  counts: SearchOutcomeCounts,
  result: SearchResult,
  texts: PreparedTexts,
  trueStart: number,
  trueEnd: number,
): void {
  counts.passages += 1;
  if (result.status === 'not-found') {
    counts.notFound += 1;
    return;
  }
  const rightOnes = result.candidates
    .slice(0, result.tiedCount)
    .filter((candidate) =>
      isSamePassage(
        positionOf(texts, candidate.start),
        positionOf(texts, candidate.end),
        trueStart,
        trueEnd,
      ),
    );
  if (rightOnes.length === 0) counts.wrong += 1;
  else if (result.status === 'found') counts.foundRight += 1;
  else counts.ambiguousWithRight += 1;
}

/** Returns a function counting how many times a sequence of words occurs in `words`. */
function occurrenceCounter(words: readonly string[]): (sequence: readonly string[]) => number {
  const positionsOfWord = new Map<string, number[]>();
  words.forEach((word, position) => {
    const positions = positionsOfWord.get(word) ?? [];
    positionsOfWord.set(word, positions);
    positions.push(position);
  });
  return (sequence) => {
    const starts = positionsOfWord.get(sequence[0] ?? '') ?? [];
    return starts.filter((start) =>
      sequence.every((word, offset) => words[start + offset] === word),
    ).length;
  };
}

// ---- Unrelated input ----------------------------------------------------------------------

export interface UnrelatedInputMeasure {
  readonly inputs: number;
  /** Inputs for which a passage was returned although none should be. */
  readonly falsePositives: number;
  /** Best score reached by an unrelated input when no minimal score is applied. */
  readonly highestScore: number;
  /** Score under which 99 % of the unrelated inputs stay. */
  readonly score99thPercentile: number;
}

/**
 * Searches sequences of words drawn at random from the corpus (frequent words come up as
 * often as in the Quran): the hardest unrelated input, since every word is a Quran word.
 */
export function measureUnrelatedInput(
  index: VerseIndex,
  uthmani: readonly VerseText[],
  options: { seed: number; inputs: number; minWords: number; maxWords: number },
): UnrelatedInputMeasure {
  const corpusWords = uthmani.flatMap((verse) => normalizeArabic(verse.text));
  const random = createRandom(options.seed);
  let falsePositives = 0;
  const bestScores: number[] = [];
  for (let input = 0; input < options.inputs; input += 1) {
    const length = randomInteger(random, options.minWords, options.maxWords);
    const words = Array.from({ length }, () => pickOne(random, corpusWords));
    if (index.search(words).status !== 'not-found') falsePositives += 1;
    bestScores.push(index.search(words, { minScore: 0, minWords: 1 }).candidates[0]?.score ?? 0);
  }
  bestScores.sort((first, second) => first - second);
  return {
    inputs: options.inputs,
    falsePositives,
    highestScore: bestScores[bestScores.length - 1] ?? 0,
    score99thPercentile: bestScores[Math.floor(bestScores.length * 0.99)] ?? 0,
  };
}

// ---- Search under heavier noise -----------------------------------------------------------

/** Same as `measureSearch`, with every word damaged at random instead of a fixed number of errors. */
export function measureSearchUnderNoise(
  index: VerseIndex,
  uthmani: readonly VerseText[],
  spoken: readonly VerseText[],
  profile: NoiseProfile,
  options: { seed: number; passages: number; words: number },
): SearchOutcomeCounts {
  const texts = prepareTexts(uthmani, spoken);
  const random = createRandom(options.seed);
  const counts = emptyCounts();
  for (let passage = 0; passage < options.passages; passage += 1) {
    const spokenStart = randomInteger(random, 0, texts.spokenWords.length - options.words);
    const clean = texts.spokenWords.slice(spokenStart, spokenStart + options.words);
    const result = index.search(withNoise(clean, profile, random));
    const trueStart = uthmaniPositionOf(texts, spokenStart);
    const trueEnd = uthmaniPositionOf(texts, spokenStart + options.words - 1);
    countOutcome(counts, result, texts, trueStart, trueEnd);
  }
  return counts;
}

// ---- Following a reader -------------------------------------------------------------------

export type FollowScenario =
  'clean' | 'noisy-letters' | 'dropped-words' | 'replaced-words' | 'repeats';

export interface FollowMeasure {
  readonly scenario: FollowScenario;
  readonly expectedWords: number;
  readonly read: number;
  readonly skipped: number;
  readonly mistake: number;
  /** Words still `current` or `upcoming` at the end (the last words cannot be confirmed). */
  readonly notReached: number;
  /** Words dropped or replaced on purpose by the scenario. */
  readonly damagedOnPurpose: number;
}

/** Share of words damaged in the scenarios that damage words. */
const FOLLOW_DAMAGE_RATE = 0.05;
const FOLLOW_LETTER_NOISE: NoiseProfile = {
  confusedLetter: 0.2,
  wrongLetter: 0.1,
  droppedWord: 0,
  gluedWords: 0,
};
/** A reader going back repeats this many words, about once every `REPEAT_EVERY_WORDS` words. */
const REPEATED_WORDS = 4;
const REPEAT_EVERY_WORDS = 15;

/**
 * Follows simulated readers over stretches of consecutive verses of about
 * `wordsPerSession` words, the transcript being fed one word at a time.
 */
export function measureFollow(
  uthmani: readonly VerseText[],
  spoken: readonly VerseText[],
  scenario: FollowScenario,
  options: { seed: number; sessions: number; wordsPerSession: number },
): FollowMeasure {
  const random = createRandom(options.seed);
  const vocabulary = spoken.flatMap((verse) => normalizeArabic(verse.text));
  const totals = { expectedWords: 0, read: 0, skipped: 0, mistake: 0, notReached: 0, damaged: 0 };

  for (let session = 0; session < options.sessions; session += 1) {
    const firstVerse = randomInteger(random, 0, uthmani.length - 1);
    const expected: string[] = [];
    const clean: string[] = [];
    for (
      let verse = firstVerse;
      verse < uthmani.length && expected.length < options.wordsPerSession;
      verse += 1
    ) {
      expected.push(...normalizeArabic(uthmani[verse]?.text ?? ''));
      clean.push(...normalizeArabic(spoken[verse]?.text ?? ''));
    }
    const { heard, damaged } = playScenario(scenario, clean, vocabulary, random);
    const follow = createFollowSession(expected);
    let snapshot = follow.snapshot();
    for (const word of heard) snapshot = follow.feed([word]);

    totals.expectedWords += expected.length;
    totals.damaged += damaged;
    for (const status of snapshot.statuses) {
      if (status === 'read') totals.read += 1;
      else if (status === 'skipped') totals.skipped += 1;
      else if (status === 'mistake') totals.mistake += 1;
      else totals.notReached += 1;
    }
  }
  return {
    scenario,
    expectedWords: totals.expectedWords,
    read: totals.read,
    skipped: totals.skipped,
    mistake: totals.mistake,
    notReached: totals.notReached,
    damagedOnPurpose: totals.damaged,
  };
}

function playScenario(
  scenario: FollowScenario,
  clean: readonly string[],
  vocabulary: readonly string[],
  random: Random,
): { heard: string[]; damaged: number } {
  if (scenario === 'clean') return { heard: [...clean], damaged: 0 };
  if (scenario === 'noisy-letters')
    return { heard: withNoise(clean, FOLLOW_LETTER_NOISE, random), damaged: 0 };

  const heard: string[] = [];
  let damaged = 0;
  clean.forEach((word, index) => {
    const hit = random() < FOLLOW_DAMAGE_RATE;
    if (scenario === 'repeats') {
      heard.push(word);
      if (index >= REPEATED_WORDS && random() < 1 / REPEAT_EVERY_WORDS) {
        heard.push(...clean.slice(index - REPEATED_WORDS + 1, index + 1));
      }
    } else if (!hit) {
      heard.push(word);
    } else if (scenario === 'replaced-words') {
      heard.push(pickOne(random, vocabulary));
      damaged += 1;
    } else {
      damaged += 1; // dropped-words: the word is simply not heard
    }
  });
  return { heard, damaged };
}
