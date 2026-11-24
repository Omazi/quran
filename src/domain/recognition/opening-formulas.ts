/**
 * What readers say before the passage itself.
 *
 * A reader usually starts with the isti'adha ("أعوذ بالله من الشيطان الرجيم"), which is not a
 * verse, and opens a surah with the basmala, which the corpus only holds as verse 1:1 and
 * inside 27:30. Left in the input, these words would count as words that the right passage
 * does not explain, and lower its score for no reason.
 */
import {
  isCloseEnough,
  toComparableWords,
  wordSimilarity,
  type ComparableWord,
} from './comparable-word';

const ISTIADHA = toComparableWords(['أعوذ بالله من الشيطان الرجيم'], 'formula');
const BASMALA = toComparableWords(['بسم الله الرحمن الرحيم'], 'formula');

export const BASMALA_WORD_COUNT = BASMALA.length;

/** True when `words[from ..]` says `formula`, word for word, transcription noise allowed. */
function saysFormula(
  words: readonly ComparableWord[],
  from: number,
  formula: readonly ComparableWord[],
): boolean {
  return formula.every((formulaWord, offset) => {
    const word = words[from + offset];
    return word !== undefined && isCloseEnough(wordSimilarity(word, formulaWord));
  });
}

export interface OpeningFormulas {
  /** Number of leading heard words to leave out of the search. */
  readonly wordCount: number;
  /** True when a basmala is among the words left out. */
  readonly basmalaLeftOut: boolean;
}

/**
 * Finds the opening formulas at the start of the heard words.
 *
 * - A leading isti'adha is always left out: it is not Quran text.
 * - A basmala (at the start, or right after the isti'adha) is left out only when at least
 *   `minWordsAfter` words follow it: then the following words identify the passage. Alone,
 *   it is searched as what it is, verse 1:1.
 */
export function findOpeningFormulas(
  heard: readonly ComparableWord[],
  minWordsAfter: number,
): OpeningFormulas {
  const istiadhaWords = saysFormula(heard, 0, ISTIADHA) ? ISTIADHA.length : 0;
  const wordsAfterBasmala = heard.length - istiadhaWords - BASMALA.length;
  const basmalaLeftOut =
    saysFormula(heard, istiadhaWords, BASMALA) && wordsAfterBasmala >= minWordsAfter;
  return {
    wordCount: istiadhaWords + (basmalaLeftOut ? BASMALA.length : 0),
    basmalaLeftOut,
  };
}

/**
 * True when the heard words up to `lastIndex` end with a whole isti'adha or a whole basmala:
 * the reader has just said an opening formula, not a word of the passage.
 */
export function endsOpeningFormula(heard: readonly ComparableWord[], lastIndex: number): boolean {
  return [ISTIADHA, BASMALA].some((formula) => {
    const from = lastIndex - formula.length + 1;
    return from >= 0 && saysFormula(heard, from, formula);
  });
}

/** True when the corpus words just before `position` are a basmala (1:1, or inside 27:30). */
export function isRightAfterBasmala(
  corpusWords: readonly ComparableWord[],
  position: number,
): boolean {
  const basmalaStart = position - BASMALA.length;
  return basmalaStart >= 0 && saysFormula(corpusWords, basmalaStart, BASMALA);
}
