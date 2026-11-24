/**
 * Passage search: which verses do these heard words come from?
 *
 * The corpus is read as one long sequence of normalised words. A search looks at places
 * of three kinds, then ranks what it found:
 *
 * 1. Exact places: everywhere the heard words stand word for word. Always all of them.
 * 2. Likely places: every heard word that exists in the corpus "votes" for the place where
 *    the passage would start if that word were at its place; the heaviest places are
 *    aligned word by word with the heard words (see align.ts), which tolerates wrong,
 *    missing, extra and badly cut words. This step has a work bound; when the bound leaves
 *    places out, the result says so.
 * 3. Twin places: everywhere the words of a best passage stand again. Two places with the
 *    same words explain any input equally well, so they are always listed together.
 *
 * Cost: the occurrences of the heard words in the corpus, plus, for each place aligned,
 * (heard words) x (tolerated shift). Nothing depends on the corpus being the whole Quran.
 */
import { SURAH_COUNT, type VerseRef } from '../quran/types';

import { alignWords } from './align';
import {
  isTooLongToBeAWord,
  toComparableWord,
  toComparableWords,
  type ComparableWord,
} from './comparable-word';
import { RECOGNITION_CONFIG } from './config';
import { normalizeArabic } from './normalize';
import { BASMALA_WORD_COUNT, findOpeningFormulas, isRightAfterBasmala } from './opening-formulas';
import type {
  NotFoundReason,
  PassageCandidate,
  SearchLimits,
  SearchOptions,
  SearchResult,
  VerseIndex,
  VerseText,
  WordRef,
} from './types';

/** The corpus as one sequence of words, with the place of each verse in it. */
interface Corpus {
  /** One object per distinct word: two equal words of the corpus are the same object. */
  readonly words: readonly ComparableWord[];
  readonly verses: readonly VerseRef[];
  /** Position in `words` of the first word of each verse. */
  readonly verseStarts: readonly number[];
  /** Positions of every word, in order, by accent-tolerant key. */
  readonly positionsByAccentKey: ReadonlyMap<string, readonly number[]>;
}

/** A passage of the corpus that explains the heard words, as positions in `Corpus.words`. */
interface Passage {
  readonly start: number;
  readonly end: number;
  readonly score: number;
  /** Heard words recognised in the passage. */
  readonly matchedWords: number;
  /** The same, each word counted for its similarity (1 when heard exactly). */
  readonly explainedWords: number;
  /** Words of the passage that were not heard. */
  readonly missingWords: number;
  /** Rank, among the heard words, of the first one recognised. */
  readonly firstHeardIndex: number;
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
      if (isTooLongToBeAWord(word)) {
        throw new RangeError(
          `Verse ${verse.surah}:${verse.verse} holds a word of ${normalized.length} letters: ` +
            `more than ${RECOGNITION_CONFIG.maxWordLetters}, not a word of the Quran`,
        );
      }
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
  options?: SearchOptions,
): SearchResult {
  const settings = readSettings(options);
  const allHeard = toComparableWords(words, 'words');
  // A long transcript is searched on its most recent words only: the work stays bounded.
  const inputTruncated = allHeard.length > RECOGNITION_CONFIG.maxHeardWords;
  const recentHeard = allHeard.slice(-RECOGNITION_CONFIG.maxHeardWords);
  const opening = findOpeningFormulas(recentHeard, settings.minWords);
  const heard = recentHeard.slice(opening.wordCount);
  if (heard.length < settings.minWords) return notFound('too-few-words', inputTruncated);

  const minScore = settings.minScore ?? defaultMinScore(heard.length);
  const isGoodEnough = (passage: Passage): boolean =>
    passage.score >= minScore && passage.matchedWords >= settings.minWords;

  const examined = examinePlaces(corpus, heard);
  const found = rankPassages(corpus, examined.passages.filter(isGoodEnough));
  const twins = twinPlaces(corpus, tiedWithBest(found, heard.length));
  let ranked = rankPassages(corpus, [...found, ...twins]);
  let heardCount = heard.length;

  const bestFollowsBasmala = tiedWithBest(ranked, heardCount).some((passage) =>
    followsBasmala(corpus, passage),
  );
  if (opening.basmalaLeftOut && bestFollowsBasmala) {
    // A best place holds a basmala before the passage (the Fatiha, or 27:30): the heard
    // basmala is text, and a place that explains it beats one that explains only the rest.
    heardCount += BASMALA_WORD_COUNT;
    const withBasmala = ranked.map((passage) => countBasmalaAsText(corpus, passage, heardCount));
    ranked = rankPassages(corpus, withBasmala.filter(isGoodEnough));
  }

  const [best] = ranked;
  if (best === undefined) return notFound('no-match', inputTruncated);
  const tiedCount = tiedWithBest(ranked, heardCount).length;

  // Each word of evidence less divides the likelihood of a passage; confidence is the
  // score, shared between the passages in proportion to their likelihood.
  const likelihoodOf = (passage: Passage): number =>
    Math.pow(
      RECOGNITION_CONFIG.oddsPerExplainedWord,
      -wordsOfEvidenceBehind(best, passage, heardCount),
    );
  const totalLikelihood = ranked.reduce((total, passage) => total + likelihoodOf(passage), 0);

  // Every tied place is listed, up to `maxListedPlaces`; then come a few lower-ranked ones.
  const allTiedListed = tiedCount <= RECOGNITION_CONFIG.maxListedPlaces;
  const listedCount = allTiedListed
    ? tiedCount + settings.maxAlternatives
    : RECOGNITION_CONFIG.maxListedPlaces;
  const candidates = ranked.slice(0, listedCount).map((passage): PassageCandidate => ({
    start: wordRefAt(corpus, passage.start),
    end: wordRefAt(corpus, passage.end),
    score: passage.score,
    confidence: (passage.score * likelihoodOf(passage)) / totalLikelihood,
  }));
  const limits = limitsOf(allTiedListed && !examined.placesLeftOut, inputTruncated);
  return tiedCount > 1
    ? { status: 'ambiguous', candidates, tiedCount, ...limits }
    : { status: 'found', candidates, tiedCount: 1, ...limits };
}

function notFound(reason: NotFoundReason, inputTruncated: boolean): SearchResult {
  const limits = limitsOf(true, inputTruncated);
  return { status: 'not-found', reason, candidates: [], tiedCount: 0, ...limits };
}

/** The flags of a result that left something out; a complete result carries none. */
function limitsOf(listIsComplete: boolean, inputTruncated: boolean): SearchLimits {
  const limits: { truncated?: true; inputTruncated?: true } = {};
  if (!listIsComplete) limits.truncated = true;
  if (inputTruncated) limits.inputTruncated = true;
  return limits;
}

/** Short inputs must be explained almost entirely (see `shortInputMinScore`). */
function defaultMinScore(heardWordCount: number): number {
  return heardWordCount <= RECOGNITION_CONFIG.shortInputMaxWords
    ? RECOGNITION_CONFIG.shortInputMinScore
    : RECOGNITION_CONFIG.minScore;
}

function readSettings(options: SearchOptions = {}): SearchSettings {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new TypeError('search options must be an object, or left out');
  }
  // Only an option left out (undefined) takes its default: null is an invalid value.
  const { minScore } = options;
  const minWords = options.minWords === undefined ? RECOGNITION_CONFIG.minWords : options.minWords;
  const maxAlternatives =
    options.maxAlternatives === undefined
      ? RECOGNITION_CONFIG.maxAlternatives
      : options.maxAlternatives;
  if (typeof minWords !== 'number' || !Number.isInteger(minWords) || minWords < 1) {
    throw new RangeError(`minWords must be a whole number, 1 or more, got ${String(minWords)}`);
  }
  const isScore = typeof minScore === 'number' && minScore >= 0 && minScore <= 1;
  if (minScore !== undefined && !isScore) {
    throw new RangeError(`minScore must be a number between 0 and 1, got ${String(minScore)}`);
  }
  const isCount =
    typeof maxAlternatives === 'number' &&
    Number.isInteger(maxAlternatives) &&
    maxAlternatives >= 0;
  if (!isCount) {
    throw new RangeError(
      `maxAlternatives must be a whole number, 0 or more, got ${String(maxAlternatives)}`,
    );
  }
  return { minWords, minScore, maxAlternatives };
}

// ---- Ranking --------------------------------------------------------------------------------

/**
 * How many words of evidence separate a passage from the best one: the difference of
 * scores, times the number of heard words.
 */
function wordsOfEvidenceBehind(best: Passage, passage: Passage, heardCount: number): number {
  return (best.score - passage.score) * heardCount;
}

/** The passages that explain the input as well as the first one (`ranked` is sorted). */
function tiedWithBest(ranked: readonly Passage[], heardCount: number): Passage[] {
  const [best] = ranked;
  if (best === undefined) return [];
  // Half a word at most, and never more than a small share of a very short input.
  const margin = Math.min(
    RECOGNITION_CONFIG.tieMarginWords,
    RECOGNITION_CONFIG.tieMarginShare * heardCount,
  );
  return ranked.filter((passage) => wordsOfEvidenceBehind(best, passage, heardCount) <= margin);
}

/**
 * Sorts passages best first (then in mushaf order: never at random) and keeps the best
 * passage of each place: a passage that overlaps a better one is dropped.
 */
function rankPassages(corpus: Corpus, passages: readonly Passage[]): Passage[] {
  const sorted = [...passages].sort(
    (first, second) => second.score - first.score || first.start - second.start,
  );
  const taken = new Uint8Array(corpus.words.length);
  return sorted.filter((passage) => {
    for (let position = passage.start; position <= passage.end; position += 1) {
      if (taken[position] === 1) return false;
    }
    taken.fill(1, passage.start, passage.end + 1);
    return true;
  });
}

// ---- The places examined --------------------------------------------------------------------

/** Passages found at the exact places and at the likely places of the heard words. */
function examinePlaces(
  corpus: Corpus,
  heard: readonly ComparableWord[],
): { passages: Passage[]; placesLeftOut: boolean } {
  const drift = Math.min(
    RECOGNITION_CONFIG.maxDriftWords,
    Math.max(
      RECOGNITION_CONFIG.minDriftWords,
      Math.ceil(heard.length * RECOGNITION_CONFIG.driftRatio),
    ),
  );
  const exact = exactPlaces(corpus, heard);
  const exactStarts = new Set(exact.map((passage) => passage.start));
  const likelyStarts = findLikelyStarts(corpus, heard, drift).filter(
    (start) => !exactStarts.has(start),
  );
  // Aligning one place costs "heard words x reference words looked at for each".
  const comparisonsPerPlace = heard.length * (2 * drift + 1);
  const maxPlaces = Math.max(
    RECOGNITION_CONFIG.minVerifiedPlaces,
    Math.floor(RECOGNITION_CONFIG.maxVerifiedComparisons / comparisonsPerPlace),
  );
  const aligned = likelyStarts
    .slice(0, maxPlaces)
    .map((start) => alignedPassage(corpus, heard, start, drift))
    .filter((passage): passage is Passage => passage !== null);
  return { passages: [...exact, ...aligned], placesLeftOut: likelyStarts.length > maxPlaces };
}

/**
 * Every place where the heard words stand word for word (letters that foreign accents
 * confuse may differ). No bound applies here: when the input is exact text, every one of
 * its places is found, however many there are.
 * Cost: the occurrences of the rarest heard word, times the number of heard words.
 */
function exactPlaces(corpus: Corpus, heard: readonly ComparableWord[]): Passage[] {
  let rarestIndex = 0;
  let rarestPositions: readonly number[] | undefined;
  for (const [index, word] of heard.entries()) {
    const positions = corpus.positionsByAccentKey.get(word.accentKey);
    if (positions === undefined) return []; // a heard word is nowhere in the corpus
    if (rarestPositions === undefined || positions.length < rarestPositions.length) {
      rarestIndex = index;
      rarestPositions = positions;
    }
  }

  const passages: Passage[] = [];
  for (const position of rarestPositions ?? []) {
    const start = position - rarestIndex;
    let explainedWords = 0;
    const standsHere = heard.every((word, offset) => {
      const corpusWord = corpus.words[start + offset];
      if (corpusWord?.accentKey !== word.accentKey) return false;
      explainedWords += corpusWord.key === word.key ? 1 : RECOGNITION_CONFIG.accentMatchSimilarity;
      return true;
    });
    if (!standsHere) continue;
    passages.push({
      start,
      end: start + heard.length - 1,
      score: explainedWords / heard.length,
      matchedWords: heard.length,
      explainedWords,
      missingWords: 0,
      firstHeardIndex: 0,
    });
  }
  return passages;
}

/**
 * Corpus positions where the heard passage probably starts, strongest first.
 *
 * A heard word found at corpus position p, and heard as the i-th word, votes for a passage
 * starting at p - i. A reader who skips or adds a word shifts the next words by one, so
 * the weight of a start counts every heard word found within `minDriftWords` of its place,
 * each word once however often the place repeats it. A start is kept when this weight is
 * a fair share of the best one, or when every heard word but one stands exactly at its
 * place: the last one may then be a close word, and such a place explains the input
 * almost as well as the best, however rare the word that differs. Starts within `drift`
 * of a start with more votes describe the same place and are left out.
 */
function findLikelyStarts(
  corpus: Corpus,
  heard: readonly ComparableWord[],
  drift: number,
): number[] {
  const corpusSize = corpus.words.length;
  // Starts go from -(heard.length - 1), when only the last heard word is in the corpus,
  // to corpusSize - 1: `shift` makes them usable as array indexes ("slots").
  const shift = heard.length - 1;
  const slotCount = corpusSize + shift;
  /** Weight of the heard words found exactly where a passage starting here puts them. */
  const votes = new Float64Array(slotCount);
  /** Weight of the heard words found near where a passage starting here puts them. */
  const weights = new Float64Array(slotCount);
  /** Number of heard words found exactly where a passage starting here puts them. */
  const hits = new Uint16Array(slotCount);
  const votedSlots: number[] = [];
  const reach = RECOGNITION_CONFIG.minDriftWords;

  heard.forEach((word, heardIndex) => {
    const positions = corpus.positionsByAccentKey.get(word.accentKey);
    if (positions === undefined) return;
    // A word found everywhere says little about where we are: log(1 + corpus / occurrences).
    const weight = Math.log(1 + corpusSize / positions.length);
    // Positions come in order: remembering how far this word is already counted keeps it
    // from counting twice for a start that has it twice within reach.
    let countedThrough = -1;
    for (const position of positions) {
      const slot = position - heardIndex + shift;
      const votesSoFar = votes[slot] ?? 0;
      if (votesSoFar === 0) votedSlots.push(slot);
      votes[slot] = votesSoFar + weight;
      hits[slot] = (hits[slot] ?? 0) + 1;
      const last = Math.min(slot + reach, slotCount - 1);
      for (let near = Math.max(slot - reach, countedThrough + 1); near <= last; near += 1) {
        weights[near] = (weights[near] ?? 0) + weight;
      }
      countedThrough = last;
    }
  });

  const bestWeight = votedSlots.reduce((best, slot) => Math.max(best, weights[slot] ?? 0), 0);
  const minWeight = bestWeight * RECOGNITION_CONFIG.seedKeepRatio;

  // The starts that enough of the heard words support: by their weight, or by their number.
  const minHits = Math.max(1, heard.length - 1);
  const supportedSlots = votedSlots.filter(
    (slot) => (weights[slot] ?? 0) >= minWeight || (hits[slot] ?? 0) >= minHits,
  );
  const isSupported = new Uint8Array(slotCount);
  for (const slot of supportedSlots) isSupported[slot] = 1;

  const starts: { readonly position: number; readonly weight: number }[] = [];
  for (const slot of supportedSlots) {
    // Neighbouring starts describe the same place: only the one with the most votes is
    // kept. Equal neighbours are both kept, so that a phrase repeated a few words further
    // is examined at both places. Only a supported start may stand for its neighbours:
    // otherwise a long passage whose words shift several times could lose all its starts,
    // each one set aside for a neighbour that is itself set aside for lack of support.
    const ownVotes = votes[slot] ?? 0;
    let hasStrongerNeighbour = false;
    for (let near = slot - drift; near <= slot + drift && !hasStrongerNeighbour; near += 1) {
      hasStrongerNeighbour = isSupported[near] === 1 && (votes[near] ?? 0) > ownVotes;
    }
    if (!hasStrongerNeighbour) starts.push({ position: slot - shift, weight: weights[slot] ?? 0 });
  }
  return starts
    .sort((first, second) => second.weight - first.weight || first.position - second.position)
    .map((start) => start.position);
}

/** Aligns the heard words with the corpus around a likely start; null when nothing matches. */
function alignedPassage(
  corpus: Corpus,
  heard: readonly ComparableWord[],
  likelyStart: number,
  drift: number,
): Passage | null {
  const from = Math.max(0, likelyStart - drift);
  const to = Math.min(corpus.words.length, likelyStart + heard.length + drift);
  const pairs = alignWords(heard, corpus.words, from, to, {
    band: { firstHeardAt: likelyStart, reach: drift },
  });
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
  const missingWords = end - first.referenceIndex + 1 - coveredReferenceWords;
  return {
    start: first.referenceIndex,
    end,
    // Every heard word counts, matched or not, and so does every word of the passage that
    // was not heard: 1 means "this passage, word for word, and nothing else".
    score: explainedWords / (heard.length + missingWords),
    matchedWords,
    explainedWords,
    missingWords,
    firstHeardIndex: first.heardIndex,
  };
}

/**
 * The other places of the corpus that hold exactly the words of one of `passages`. They
 * explain the input exactly as well, whatever the noise: they get the same score.
 * Cost per distinct run of words: the occurrences of its rarest word, times its length.
 */
function twinPlaces(corpus: Corpus, passages: readonly Passage[]): Passage[] {
  const twins: Passage[] = [];
  const runsDone = new Set<string>();
  for (const passage of passages) {
    const run = corpus.words.slice(passage.start, passage.end + 1);
    const runText = run.map((word) => word.key).join(' ');
    if (runsDone.has(runText)) continue;
    runsDone.add(runText);

    let rarestOffset = 0;
    let rarestPositions: readonly number[] = [];
    run.forEach((word, offset) => {
      const positions = corpus.positionsByAccentKey.get(word.accentKey) ?? [];
      if (offset === 0 || positions.length < rarestPositions.length) {
        rarestOffset = offset;
        rarestPositions = positions;
      }
    });
    for (const position of rarestPositions) {
      const start = position - rarestOffset;
      // Equal words of the corpus are the same object: comparing objects compares words.
      const isTwin =
        start !== passage.start &&
        run.every((word, offset) => corpus.words[start + offset] === word);
      if (isTwin) twins.push({ ...passage, start, end: start + run.length - 1 });
    }
  }
  return twins;
}

// ---- Opening basmala --------------------------------------------------------------------------

/**
 * True when the passage starts with the first word heard after the basmala, right after a
 * basmala of the corpus.
 */
function followsBasmala(corpus: Corpus, passage: Passage): boolean {
  return passage.firstHeardIndex === 0 && isRightAfterBasmala(corpus.words, passage.start);
}

/**
 * The same passage when the heard basmala counts as text: a passage that follows a basmala
 * of the corpus takes it in and explains four more words; any other passage leaves four
 * heard words unexplained. `heardCount` includes the basmala.
 */
function countBasmalaAsText(corpus: Corpus, passage: Passage, heardCount: number): Passage {
  const basmalaWords = followsBasmala(corpus, passage) ? BASMALA_WORD_COUNT : 0;
  const explainedWords = passage.explainedWords + basmalaWords;
  return {
    ...passage,
    start: passage.start - basmalaWords,
    score: explainedWords / (heardCount + passage.missingWords),
    matchedWords: passage.matchedWords + basmalaWords,
    explainedWords,
  };
}

// ---- Places as "surah, verse, word" -----------------------------------------------------------

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
