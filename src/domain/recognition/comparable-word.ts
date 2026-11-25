/**
 * A word ready to be compared, and how alike two words are.
 */
import { RECOGNITION_CONFIG } from './config';
import {
  accentKeyOfNormalized,
  isJoinedSpelling,
  isPartOfSpelling,
  normalizeArabic,
} from './normalize';

export interface ComparableWord {
  /** Normalised spelling (see normalize.ts). */
  readonly key: string;
  /** Same word with the letters that foreign accents confuse grouped together. */
  readonly accentKey: string;
  /**
   * Which letters the accent-tolerant key uses, one bit per letter. Two words that do not
   * use the same letters cannot be close: this is checked first, because it is far
   * cheaper than comparing the words letter by letter.
   */
  readonly letterSet: number;
}

/** Bits of a `letterSet`. Two letters may share a bit: the check only gets less sharp. */
const LETTER_SET_BITS = 32;

export function toComparableWord(normalizedWord: string): ComparableWord {
  const accentKey = accentKeyOfNormalized(normalizedWord);
  let letterSet = 0;
  for (let index = 0; index < accentKey.length; index += 1) {
    letterSet |= 1 << (accentKey.charCodeAt(index) % LETTER_SET_BITS);
  }
  return { key: normalizedWord, accentKey, letterSet };
}

/** Number of letters used by one word and not by the other: each costs at least one edit. */
function lettersNotShared(word: ComparableWord, other: ComparableWord): number {
  return Math.max(
    countBits(word.letterSet & ~other.letterSet),
    countBits(other.letterSet & ~word.letterSet),
  );
}

function countBits(bits: number): number {
  let count = 0;
  // `rest & (rest - 1)` clears the lowest bit that is set.
  for (let rest = bits; rest !== 0; rest &= rest - 1) count += 1;
  return count;
}

/**
 * Normalises a list of words or pieces of text into comparable words.
 * Throws a TypeError when `texts` is not a list of strings.
 */
export function toComparableWords(
  texts: readonly string[],
  argumentName: string,
): ComparableWord[] {
  if (!Array.isArray(texts) || texts.some((text) => typeof text !== 'string')) {
    throw new TypeError(`${argumentName} must be a list of strings`);
  }
  return texts.flatMap((text) => normalizeArabic(text).map(toComparableWord));
}

/**
 * True for a "word" longer than any word of the Quran (the longest has 11 comparable
 * letters): a stuck engine, or junk. Such a word is never the same as another word, not
 * even as itself, so it can never count as read; and it is never compared letter by letter.
 */
export function isTooLongToBeAWord(word: ComparableWord): boolean {
  return word.key.length > RECOGNITION_CONFIG.maxWordLetters;
}

/**
 * The two rows of the `editDistance` table, reused between calls: a search compares tens
 * of thousands of word pairs, and allocating two rows per pair makes it several times
 * slower. They fit every real word (`maxWordLetters`); longer strings get rows of their own.
 */
const SHARED_ROW_LENGTH = RECOGNITION_CONFIG.maxWordLetters + 1;
const sharedPreviousRow = new Uint32Array(SHARED_ROW_LENGTH);
const sharedCurrentRow = new Uint32Array(SHARED_ROW_LENGTH);

/** Number of single-letter edits (insert, delete, replace) that turn `first` into `second`. */
export function editDistance(first: string, second: string): number {
  const fitsSharedRows = second.length < SHARED_ROW_LENGTH;
  let previousRow = fitsSharedRows ? sharedPreviousRow : new Uint32Array(second.length + 1);
  let currentRow = fitsSharedRows ? sharedCurrentRow : new Uint32Array(second.length + 1);
  // Classic two-row dynamic programming: `previousRow[j]` is the distance between the
  // letters of `first` read so far and the first j letters of `second`.
  for (let column = 0; column <= second.length; column += 1) previousRow[column] = column;

  for (let row = 1; row <= first.length; row += 1) {
    currentRow[0] = row;
    const letter = first.charCodeAt(row - 1);
    for (let column = 1; column <= second.length; column += 1) {
      const replaceCost = letter === second.charCodeAt(column - 1) ? 0 : 1;
      currentRow[column] = Math.min(
        (previousRow[column] ?? 0) + 1,
        (currentRow[column - 1] ?? 0) + 1,
        (previousRow[column - 1] ?? 0) + replaceCost,
      );
    }
    [previousRow, currentRow] = [currentRow, previousRow];
  }
  return previousRow[second.length] ?? 0;
}

/** Room left for rounding when a similarity is compared with a threshold (3/10 is not exact). */
const ROUNDING_TOLERANCE = 1e-9;

/** True when two words are the same word, transcription noise allowed. */
export function isCloseEnough(similarity: number): boolean {
  return similarity >= RECOGNITION_CONFIG.closeWordSimilarity - ROUNDING_TOLERANCE;
}

/** True when a heard word is clearly not the expected one (see `mistakeBelowSimilarity`). */
export function isClearlyDifferent(similarity: number): boolean {
  return similarity < RECOGNITION_CONFIG.mistakeBelowSimilarity - ROUNDING_TOLERANCE;
}

/**
 * Similarity of two words from 0 to 1:
 * 1 when the normalised spellings are equal, `accentMatchSimilarity` when only the
 * accent-tolerant keys are equal, otherwise the share of letters of the accent-tolerant
 * keys that agree (never above `accentMatchSimilarity`).
 */
export function wordSimilarity(word: ComparableWord, other: ComparableWord): number {
  if (isTooLongToBeAWord(word) || isTooLongToBeAWord(other)) return 0;
  if (word.key === other.key) return 1;
  if (word.accentKey === other.accentKey) return RECOGNITION_CONFIG.accentMatchSimilarity;
  const longest = Math.max(word.accentKey.length, other.accentKey.length);
  const agreeing = 1 - editDistance(word.accentKey, other.accentKey) / longest;
  return Math.min(RECOGNITION_CONFIG.accentMatchSimilarity, agreeing);
}

/**
 * Same as `wordSimilarity`, except that it answers 0 for clearly different words without
 * comparing them letter by letter when their lengths or their letters alone tell.
 * Most pairs of words are in that case: this is what keeps a search fast.
 */
export function similarityUnlessClearlyDifferent(
  word: ComparableWord,
  other: ComparableWord,
): number {
  if (isTooLongToBeAWord(word) || isTooLongToBeAWord(other)) return 0;
  if (word.key === other.key) return 1;
  if (word.accentKey === other.accentKey) return RECOGNITION_CONFIG.accentMatchSimilarity;
  const longest = Math.max(word.accentKey.length, other.accentKey.length);
  const shortest = Math.min(word.accentKey.length, other.accentKey.length);
  // The keys differ, so at least one edit; a difference in length, or a letter that the
  // other word does not have, costs at least one edit each.
  const fewestEdits = Math.max(1, longest - shortest, lettersNotShared(word, other));
  if (isClearlyDifferent(1 - fewestEdits / longest)) return 0;
  const similarity = wordSimilarity(word, other);
  return isClearlyDifferent(similarity) ? 0 : similarity;
}

/**
 * Similarity between two consecutive words read as one and a single word: covers words
 * that one script joins and the other separates (يا أيها / يأيها, في ما / فيما) and words
 * merged or cut by the speech engine.
 *
 * Unlike `wordSimilarity`, no letter noise is tolerated: the joined words must spell the
 * single word (1) or its accent-tolerant key (`accentMatchSimilarity`); otherwise 0.
 * With noise allowed, a long word followed by any short one would look "almost the same"
 * as the long word alone.
 */
export function joinedWordsSimilarity(
  firstHalf: ComparableWord,
  secondHalf: ComparableWord,
  whole: ComparableWord,
): number {
  if (isTooLongToBeAWord(whole)) return 0;
  if (!isJoinedSpelling(firstHalf.accentKey, secondHalf.accentKey, whole.accentKey)) return 0;
  return isJoinedSpelling(firstHalf.key, secondHalf.key, whole.key)
    ? 1
    : RECOGNITION_CONFIG.accentMatchSimilarity;
}

/**
 * True when the heard word is only the beginning or the end of the expected word: half of
 * a word that the Uthmani script writes joined (يا heard for يَـٰٓأَهۡلَ), or a truncated word.
 * The word was then not heard in full, which is not the same as misread.
 */
export function isPartOfWord(heard: ComparableWord, expected: ComparableWord): boolean {
  // A run of letters too long to be a word is not a part of a word either.
  if (isTooLongToBeAWord(heard) || isTooLongToBeAWord(expected)) return false;
  return isPartOfSpelling(heard.accentKey, expected.accentKey);
}

/**
 * True when a word heard by a speech engine is the expected word of the text, with the same
 * tolerance as the passage search: vowels and script ignored, a little transcription noise
 * allowed (`closeWordSimilarity`), no difference at all in a word of two or three letters.
 * A heard "word" that normalises to several words, or to none, is never the expected word.
 */
export function isSameWordHeard(heard: string, expected: string): boolean {
  const heardWords = normalizeArabic(heard);
  const expectedWords = normalizeArabic(expected);
  if (heardWords.length !== 1 || expectedWords.length !== 1) return false;
  const similarity = wordSimilarity(
    toComparableWord(heardWords[0] ?? ''),
    toComparableWord(expectedWords[0] ?? ''),
  );
  return isCloseEnough(similarity);
}
