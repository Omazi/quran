/**
 * Alignment of heard words with a stretch of reference text.
 *
 * Both features of the module ask the same question: "which run of the reference do these
 * heard words follow best, and word against word, how?". The answer is a local alignment
 * (Smith-Waterman): the best-scoring chain of word pairs, in order, allowing
 * - a heard word that differs from the reference word at its place (substitution),
 * - a reference word that was not heard, or an extra heard word (gap),
 * - two heard words for one reference word, or the reverse (words cut differently).
 * Heard words before and after the chain, and reference words around it, are left out.
 *
 * Cost: one cell per (heard word, reference word) pair, a few word comparisons per cell.
 */
import {
  isCloseEnough,
  joinedWordsSimilarity,
  similarityUnlessClearlyDifferent,
  wordSimilarity,
  type ComparableWord,
} from './comparable-word';
import { RECOGNITION_CONFIG } from './config';

/** Heard words placed against reference words. Most pairs are one word against one word. */
export interface AlignedPair {
  /** Index of the first heard word of the pair, and how many heard words it covers (1 or 2). */
  readonly heardIndex: number;
  readonly heardCount: number;
  /** Index of the first reference word of the pair, and how many it covers (1 or 2). */
  readonly referenceIndex: number;
  readonly referenceCount: number;
  /** Similarity of the two sides, 0..1. */
  readonly similarity: number;
  /** True when both sides are the same word (close enough), false for a substitution. */
  readonly matched: boolean;
}

// How the best chain reached a cell of the table.
/** The chain starts at this cell. */
const STEP_START = 0;
/** One heard word against one reference word (same word, or substitution). */
const STEP_PAIR = 1;
/** Two heard words against one reference word. */
const STEP_HEARD_IN_TWO = 2;
/** One heard word against two reference words. */
const STEP_REFERENCE_IN_TWO = 3;
/** A heard word with nothing in the reference. */
const STEP_EXTRA_HEARD = 4;
/** A reference word that was not heard. */
const STEP_MISSING_REFERENCE = 5;

/** Which chain `alignWords` looks for. */
export type AlignmentGoal =
  /** The best chain, wherever it ends: "where do these words come from?". */
  | 'best-chain'
  /** The best chain that ends with the last heard word: "where does the newest word fall?". */
  | 'chain-of-last-heard-word';

/**
 * Aligns `heard` with `reference[referenceFrom .. referenceTo)`.
 *
 * Returns the pairs of the chain in reading order; an empty list when there is none (no
 * heard word matches, or the last heard word matches nothing when it must end the chain).
 * The chain always starts and ends on a matched pair. Among equally good chains, the one
 * ending earliest in the reference wins: nothing ever moves forward on a tie.
 */
export function alignWords(
  heard: readonly ComparableWord[],
  reference: readonly ComparableWord[],
  referenceFrom: number,
  referenceTo: number,
  goal: AlignmentGoal = 'best-chain',
): AlignedPair[] {
  const rowCount = heard.length + 1;
  const columnCount = Math.max(0, referenceTo - referenceFrom) + 1;
  // scores[row * columnCount + column]: score of the best chain that ends with heard word
  // `row - 1` and reference word `referenceFrom + column - 1`. Row and column 0 stay at 0.
  const scores = new Float64Array(rowCount * columnCount);
  const steps = new Uint8Array(rowCount * columnCount);
  const { substitutionPenalty, gapPenalty } = RECOGNITION_CONFIG;

  let bestScore = 0;
  let bestRow = 0;
  let bestColumn = 0;

  for (let row = 1; row < rowCount; row += 1) {
    const heardWord = heard[row - 1];
    if (heardWord === undefined) continue;
    const previousHeard = row >= 2 ? heard[row - 2] : undefined;
    // Where this row, the row above and the one before start in the table.
    const thisRow = row * columnCount;
    const rowAbove = thisRow - columnCount;
    const twoRowsAbove = rowAbove - columnCount;

    for (let column = 1; column < columnCount; column += 1) {
      const referenceWord = reference[referenceFrom + column - 1];
      if (referenceWord === undefined) continue;
      const previousReference = column >= 2 ? reference[referenceFrom + column - 2] : undefined;

      // Options are tried in this order; a later one must be strictly better to win.
      let score = 0;
      let step = STEP_START;
      let endsOnMatch = false;

      // The same word adds its similarity; another word costs the penalty, less when
      // the two are half alike, so that a noisy word is placed against its own word
      // rather than against a neighbour.
      const similarity = similarityUnlessClearlyDifferent(heardWord, referenceWord);
      const pairGain = isCloseEnough(similarity)
        ? similarity
        : -substitutionPenalty * (1 - similarity);
      const pairScore = (scores[rowAbove + column - 1] ?? 0) + pairGain;
      if (pairScore > score) {
        score = pairScore;
        step = STEP_PAIR;
        endsOnMatch = pairGain > 0;
      }
      // Two words for one: both words are accounted for, hence twice the similarity.
      if (previousHeard !== undefined) {
        const joined = joinedWordsSimilarity(previousHeard, heardWord, referenceWord);
        const joinedScore = (scores[twoRowsAbove + column - 1] ?? 0) + 2 * joined;
        if (joined > 0 && joinedScore > score) {
          score = joinedScore;
          step = STEP_HEARD_IN_TWO;
          endsOnMatch = true;
        }
      }
      if (previousReference !== undefined) {
        const joined = joinedWordsSimilarity(previousReference, referenceWord, heardWord);
        const joinedScore = (scores[rowAbove + column - 2] ?? 0) + 2 * joined;
        if (joined > 0 && joinedScore > score) {
          score = joinedScore;
          step = STEP_REFERENCE_IN_TWO;
          endsOnMatch = true;
        }
      }
      const extraHeardScore = (scores[rowAbove + column] ?? 0) - gapPenalty;
      if (extraHeardScore > score) {
        score = extraHeardScore;
        step = STEP_EXTRA_HEARD;
        endsOnMatch = false;
      }
      const missingReferenceScore = (scores[thisRow + column - 1] ?? 0) - gapPenalty;
      if (missingReferenceScore > score) {
        score = missingReferenceScore;
        step = STEP_MISSING_REFERENCE;
        endsOnMatch = false;
      }

      scores[thisRow + column] = score;
      steps[thisRow + column] = step;
      const mayEndHere = endsOnMatch && (goal === 'best-chain' || row === rowCount - 1);
      const endsEarlier = score === bestScore && column < bestColumn;
      if (mayEndHere && (score > bestScore || endsEarlier)) {
        bestScore = score;
        bestRow = row;
        bestColumn = column;
      }
    }
  }

  // Walk back from the end of the best chain to its start.
  const pairs: AlignedPair[] = [];
  let row = bestRow;
  let column = bestColumn;
  while (row > 0 && column > 0) {
    const step = steps[row * columnCount + column] ?? STEP_START;
    const heardWord = heard[row - 1];
    const referenceIndex = referenceFrom + column - 1;
    const referenceWord = reference[referenceIndex];
    if (step === STEP_START || heardWord === undefined || referenceWord === undefined) break;

    if (step === STEP_PAIR) {
      pairs.push(pairOf(row - 1, 1, referenceIndex, 1, wordSimilarity(heardWord, referenceWord)));
      row -= 1;
      column -= 1;
    } else if (step === STEP_HEARD_IN_TWO) {
      const previousHeard = heard[row - 2] ?? heardWord;
      const similarity = joinedWordsSimilarity(previousHeard, heardWord, referenceWord);
      pairs.push(pairOf(row - 2, 2, referenceIndex, 1, similarity));
      row -= 2;
      column -= 1;
    } else if (step === STEP_REFERENCE_IN_TWO) {
      const previousReference = reference[referenceIndex - 1] ?? referenceWord;
      const similarity = joinedWordsSimilarity(previousReference, referenceWord, heardWord);
      pairs.push(pairOf(row - 1, 1, referenceIndex - 1, 2, similarity));
      row -= 1;
      column -= 2;
    } else if (step === STEP_EXTRA_HEARD) {
      row -= 1;
    } else {
      column -= 1;
    }
  }
  return pairs.reverse();
}

function pairOf(
  heardIndex: number,
  heardCount: number,
  referenceIndex: number,
  referenceCount: number,
  similarity: number,
): AlignedPair {
  return {
    heardIndex,
    heardCount,
    referenceIndex,
    referenceCount,
    similarity,
    matched: isCloseEnough(similarity),
  };
}
