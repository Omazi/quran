/**
 * Passage search: which verses do these heard words come from?
 *
 * The corpus is read as one long sequence of normalised words. A search runs in two steps:
 *
 * 1. Seeding. Every heard word that exists in the corpus "votes" for the place where the
 *    passage would start if that word were at its place. Rare words weigh more than
 *    common ones. Places with enough weight are kept.
 *    Cost: the number of occurrences of the heard words in the corpus.
 * 2. Verification. Each kept place is aligned word by word with the heard words
 *    (see align.ts), which tolerates wrong, missing, extra and badly cut words.
 *    Cost per place: heard words x (heard words + tolerance).
 *
 * Nothing depends on the corpus being the whole Quran: tests use a few short surahs.
 */
import { SURAH_COUNT, type VerseRef } from '../quran/types';

import { alignWords } from './align';
import { toComparableWord, toComparableWords, type ComparableWord } from './comparable-word';
import { RECOGNITION_CONFIG } from './config';
import { normalizeArabic } from './normalize';
import { BASMALA_WORD_COUNT, findOpeningFormulas, isRightAfterBasmala } from './opening-formulas';
import type {
  NotFoundReason,
  PassageCandidate,
  SearchOptions,
  SearchResult,
  VerseIndex,
  VerseText,
  WordRef,
} from './types';

/** The corpus as one sequence of words, with the place of each verse in it. */
interface Corpus {
  readonly words: readonly ComparableWord[];
  readonly verses: readonly VerseRef[];
  /** Position in `words` of the first word of each verse. */
  readonly verseStarts: readonly number[];
  /** Positions of every word, by accent-tolerant key. */
  readonly positionsByAccentKey: ReadonlyMap<string, readonly number[]>;
}

/** A passage of the corpus that explains the heard words, as positions in `Corpus.words`. */
interface Passage {
  readonly start: number;
  readonly end: number;
  readonly score: number;
  /** Heard words recognised in the passage. */
  readonly matchedWords: number;
}

interface SearchSettings {
  readonly minWords: number;
  /** Undefined when the caller did not choose: the default then depends on the input length. */
  readonly minScore: number | undefined;
  readonly maxAlternatives: number;
}

export function createVerseIndex(verses: readonly VerseText[]): VerseIndex {
  const corpus = readCorpus(verses);
  return {
    verseCount: corpus.verses.length,
    wordCount: corpus.words.length,
    search: (words, options) => searchPassage(corpus, words, options),
  };
}

// ---- Building the index -------------------------------------------------------------------

function readCorpus(verses: readonly VerseText[]): Corpus {
  if (!Array.isArray(verses)) throw new TypeError('createVerseIndex expects a list of verses');
  if (verses.length === 0) throw new RangeError('createVerseIndex expects at least one verse');

  const words: ComparableWord[] = [];
  const verseRefs: VerseRef[] = [];
  const verseStarts: number[] = [];
  // One object per distinct word: the Quran has about 77,000 words but 14,000 distinct ones.
  const knownWords = new Map<string, ComparableWord>();
  const positionsByAccentKey = new Map<string, number[]>();
  let previous: VerseRef | null = null;

  verses.forEach((verse, index) => {
    assertVerseText(verse, index);
    if (previous !== null && !isAfter(verse, previous)) {
      throw new RangeError(
        `Verses must be in mushaf order without duplicates: ${verse.surah}:${verse.verse} ` +
          `comes after ${previous.surah}:${previous.verse}`,
      );
    }
    const verseWords = normalizeArabic(verse.text);
    if (verseWords.length === 0) {
      throw new RangeError(`Verse ${verse.surah}:${verse.verse} has no Arabic word`);
    }
    previous = { surah: verse.surah, verse: verse.verse };
    verseRefs.push(previous);
    verseStarts.push(words.length);

    for (const normalized of verseWords) {
      const word = knownWords.get(normalized) ?? toComparableWord(normalized);
      knownWords.set(normalized, word);
      const positions = positionsByAccentKey.get(word.accentKey) ?? [];
      positionsByAccentKey.set(word.accentKey, positions);
      positions.push(words.length);
      words.push(word);
    }
  });
  return { words, verses: verseRefs, verseStarts, positionsByAccentKey };
}

function assertVerseText(verse: VerseText, index: number): void {
  if (typeof verse !== 'object' || verse === null || typeof verse.text !== 'string') {
    throw new TypeError(`Verse #${index} must be an object with a text`);
  }
  if (!Number.isInteger(verse.surah) || verse.surah < 1 || verse.surah > SURAH_COUNT) {
    throw new RangeError(`Verse #${index}: surah must be 1..${SURAH_COUNT}, got ${verse.surah}`);
  }
  if (!Number.isInteger(verse.verse) || verse.verse < 1) {
    throw new RangeError(`Verse #${index}: verse must be 1 or more, got ${verse.verse}`);
  }
}

function isAfter(verse: VerseRef, previous: VerseRef): boolean {
  return (
    verse.surah > previous.surah || (verse.surah === previous.surah && verse.verse > previous.verse)
  );
}

// ---- Searching ------------------------------------------------------------------------------

function searchPassage(
  corpus: Corpus,
  words: readonly string[],
  options: SearchOptions = {},
): SearchResult {
  const settings = readSettings(options);
  const allHeard = toComparableWords(words, 'words');
  const opening = findOpeningFormulas(allHeard, settings.minWords);
  const heard = allHeard.slice(opening.wordCount);
  if (heard.length < settings.minWords) return notFound('too-few-words');
  const minScore = settings.minScore ?? defaultMinScore(heard.length);

  const drift = Math.max(
    RECOGNITION_CONFIG.minDriftWords,
    Math.ceil(heard.length * RECOGNITION_CONFIG.driftRatio),
  );
  // Each place costs "heard words x words of the place" comparisons to examine.
  const comparisonsPerPlace = heard.length * (heard.length + 2 * drift);
  const maxPlaces = Math.max(
    RECOGNITION_CONFIG.minVerifiedPlaces,
    Math.floor(RECOGNITION_CONFIG.maxVerifiedComparisons / comparisonsPerPlace),
  );
  const passages = findLikelyStarts(corpus, heard, drift, maxPlaces)
    .map((start) => verifyPassage(corpus, heard, start, drift, opening.basmalaLeftOut))
    .filter((passage): passage is Passage => passage !== null)
    .filter((passage) => passage.score >= minScore && passage.matchedWords >= settings.minWords)
    .sort((first, second) => second.score - first.score || first.start - second.start);

  const ranked = withoutOverlaps(passages);
  const [best] = ranked;
  if (best === undefined) return notFound('no-match');

  // Scores are compared as "words of evidence": the score times the number of heard words.
  const evidenceBehindBest = (passage: Passage): number =>
    (best.score - passage.score) * heard.length;
  const tiedCount = ranked.filter(
    (passage) => evidenceBehindBest(passage) <= RECOGNITION_CONFIG.tieMarginWords,
  ).length;

  // Each word of evidence less divides the likelihood of a passage; confidence is the
  // score, shared between the passages in proportion to their likelihood.
  const likelihoods = ranked.map((passage) =>
    Math.pow(RECOGNITION_CONFIG.oddsPerExplainedWord, -evidenceBehindBest(passage)),
  );
  const totalLikelihood = likelihoods.reduce((total, likelihood) => total + likelihood, 0);

  const candidates = ranked
    .slice(0, tiedCount + settings.maxAlternatives)
    .map((passage, rank): PassageCandidate => ({
      start: wordRefAt(corpus, passage.start),
      end: wordRefAt(corpus, passage.end),
      score: passage.score,
      confidence: (passage.score * (likelihoods[rank] ?? 0)) / totalLikelihood,
    }));

  return tiedCount > 1
    ? { status: 'ambiguous', candidates, tiedCount }
    : { status: 'found', candidates, tiedCount: 1 };
}

function notFound(reason: NotFoundReason): SearchResult {
  return { status: 'not-found', reason, candidates: [], tiedCount: 0 };
}

/** Short inputs must be explained almost entirely (see `shortInputMinScore`). */
function defaultMinScore(heardWordCount: number): number {
  return heardWordCount <= RECOGNITION_CONFIG.shortInputMaxWords
    ? RECOGNITION_CONFIG.shortInputMinScore
    : RECOGNITION_CONFIG.minScore;
}

function readSettings(options: SearchOptions): SearchSettings {
  const settings: SearchSettings = {
    minWords: options.minWords ?? RECOGNITION_CONFIG.minWords,
    minScore: options.minScore,
    maxAlternatives: options.maxAlternatives ?? RECOGNITION_CONFIG.maxAlternatives,
  };
  if (!Number.isInteger(settings.minWords) || settings.minWords < 1) {
    throw new RangeError(`minWords must be a whole number, 1 or more, got ${settings.minWords}`);
  }
  const { minScore } = settings;
  if (minScore !== undefined && !(minScore >= 0 && minScore <= 1)) {
    throw new RangeError(`minScore must be between 0 and 1, got ${minScore}`);
  }
  if (!Number.isInteger(settings.maxAlternatives) || settings.maxAlternatives < 0) {
    throw new RangeError(
      `maxAlternatives must be a whole number, 0 or more, got ${settings.maxAlternatives}`,
    );
  }
  return settings;
}

/**
 * Step 1: corpus positions where the heard passage probably starts, strongest first,
 * `maxPlaces` at most.
 *
 * A heard word found at corpus position p, and heard as the i-th word, votes for a passage
 * starting at p - i. A reader who skips or adds a word shifts the next words by one, so
 * the weight of a start is pooled with its close neighbours (`minDriftWords`), and starts
 * within `drift` of a stronger one are the same place.
 */
function findLikelyStarts(
  corpus: Corpus,
  heard: readonly ComparableWord[],
  drift: number,
  maxPlaces: number,
): number[] {
  const corpusSize = corpus.words.length;
  // Starts go from -(heard.length - 1), when only the last heard word is in the corpus,
  // to corpusSize - 1: `shift` makes them usable as array indexes ("slots").
  const shift = heard.length - 1;
  const votes = new Float64Array(corpusSize + shift);
  const votedSlots: number[] = [];
  heard.forEach((word, heardIndex) => {
    const positions = corpus.positionsByAccentKey.get(word.accentKey);
    if (positions === undefined) return;
    // A word found everywhere says little about where we are: log(1 + corpus / occurrences).
    const weight = Math.log(1 + corpusSize / positions.length);
    for (const position of positions) {
      const slot = position - heardIndex + shift;
      const votesSoFar = votes[slot] ?? 0;
      if (votesSoFar === 0) votedSlots.push(slot);
      votes[slot] = votesSoFar + weight;
    }
  });

  const poolingReach = RECOGNITION_CONFIG.minDriftWords;
  const pooledWeights = votedSlots.map((slot) => {
    let pooled = 0;
    for (let near = slot - poolingReach; near <= slot + poolingReach; near += 1) {
      pooled += votes[near] ?? 0;
    }
    return pooled;
  });
  const bestWeight = pooledWeights.reduce((best, weight) => Math.max(best, weight), 0);
  const minWeight = bestWeight * RECOGNITION_CONFIG.seedKeepRatio;

  const starts: { readonly position: number; readonly weight: number }[] = [];
  votedSlots.forEach((slot, index) => {
    const weight = pooledWeights[index] ?? 0;
    if (weight < minWeight) return;
    // Neighbouring starts describe the same place: only the one with the most votes is kept.
    // Equal neighbours are both kept, so that a phrase repeated a few words further
    // (كَلَّا سَوۡفَ تَعۡلَمُونَ ثُمَّ كَلَّا سَوۡفَ تَعۡلَمُونَ) is examined at both places.
    const ownVotes = votes[slot] ?? 0;
    for (let near = slot - drift; near <= slot + drift; near += 1) {
      if ((votes[near] ?? 0) > ownVotes) return;
    }
    starts.push({ position: slot - shift, weight });
  });

  return starts
    .sort((first, second) => second.weight - first.weight || first.position - second.position)
    .slice(0, maxPlaces)
    .map((start) => start.position);
}

/** Step 2: aligns the heard words with the corpus around a likely start. */
function verifyPassage(
  corpus: Corpus,
  heard: readonly ComparableWord[],
  likelyStart: number,
  drift: number,
  basmalaLeftOut: boolean,
): Passage | null {
  const from = Math.max(0, likelyStart - drift);
  const to = Math.min(corpus.words.length, likelyStart + heard.length + drift);
  const pairs = alignWords(heard, corpus.words, from, to);
  const first = pairs[0];
  const last = pairs[pairs.length - 1];
  if (first === undefined || last === undefined) return null;

  let explainedWords = 0;
  let matchedWords = 0;
  let coveredReferenceWords = 0;
  for (const pair of pairs) {
    coveredReferenceWords += pair.referenceCount;
    if (pair.matched) {
      explainedWords += pair.similarity * pair.heardCount;
      matchedWords += pair.heardCount;
    }
  }
  const end = last.referenceIndex + last.referenceCount - 1;
  const missingReferenceWords = end - first.referenceIndex + 1 - coveredReferenceWords;
  // Every heard word counts, matched or not, and so does every word of the passage that
  // was not heard: 1 means "this passage, word for word, and nothing else".
  const score = explainedWords / (heard.length + missingReferenceWords);

  // The reader opened with a basmala and went on with the words that follow one in the
  // corpus (the Fatiha, or 27:30): that basmala is part of the passage.
  const startsWithLeftOutBasmala =
    basmalaLeftOut &&
    first.heardIndex === 0 &&
    isRightAfterBasmala(corpus.words, first.referenceIndex);
  const start = startsWithLeftOutBasmala
    ? first.referenceIndex - BASMALA_WORD_COUNT
    : first.referenceIndex;
  return { start, end, score, matchedWords };
}

/** Keeps the best passage of each place: `ranked` is sorted, a later passage that overlaps an earlier one is dropped. */
function withoutOverlaps(ranked: readonly Passage[]): Passage[] {
  const kept: Passage[] = [];
  for (const passage of ranked) {
    const overlaps = kept.some((other) => passage.start <= other.end && other.start <= passage.end);
    if (!overlaps) kept.push(passage);
  }
  return kept;
}

/** Converts a position in the corpus to "surah, verse, word". */
function wordRefAt(corpus: Corpus, position: number): WordRef {
  // Binary search of the last verse that starts at or before `position`.
  let low = 0;
  let high = corpus.verseStarts.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((corpus.verseStarts[middle] ?? 0) <= position) low = middle;
    else high = middle - 1;
  }
  const verse = corpus.verses[low];
  const verseStart = corpus.verseStarts[low];
  if (verse === undefined || verseStart === undefined) {
    throw new RangeError(`No verse at corpus position ${position}`);
  }
  return { surah: verse.surah, verse: verse.verse, word: position - verseStart + 1 };
}
