/**
 * Following a recitation word by word on a page of the mushaf (docs/design/voix.png): which
 * word was just recited, which comes next, and which word to read again.
 *
 * A pure function over the words of the page as the data writes them and the words the speech
 * engine heard. Both are compared after the passage search's normalisation, so the Uthmani
 * script and the engine's plain spelling meet. It never guesses further than one word: a word
 * left out is noticed when the next one is recited; anything else heard is a misreading of the
 * word expected, and the place does not move.
 */
import { normalizeArabic } from '../recognition';

export interface FollowState {
  /** Index of the word expected next. Equal to the number of words once the last is recited. */
  readonly next: number;
  /** Index of the word just recited, or null before the first one. */
  readonly current: number | null;
  /** Index of a word to read again (left out or misread), or null. */
  readonly reread: number | null;
}

/** Before the word at `from`: nothing recited, nothing to read again. */
export function startFollowing(from: number): FollowState {
  if (!Number.isInteger(from) || from < 0) {
    throw new RangeError(`A recitation starts at a word index of 0 or more, got ${from}`);
  }
  return { next: from, current: null, reread: null };
}

function keyOf(word: string): string {
  return normalizeArabic(word).join(' ');
}

/**
 * The state after the engine heard `heard`, in order. `pageWords` are the words of the page as
 * the data layer gives them; they are only compared, never changed.
 */
export function followRecitation(
  state: FollowState,
  pageWords: readonly string[],
  heard: readonly string[],
): FollowState {
  if (state.next > pageWords.length) {
    throw new RangeError(`Word ${state.next} is past the ${pageWords.length} words of the page`);
  }
  let { next, current, reread } = state;
  let changed = false;
  for (const word of heard) {
    const key = keyOf(word);
    if (key === '' || next >= pageWords.length) continue;
    const expected = keyOf(pageWords[next] ?? '');
    const following = next + 1 < pageWords.length ? keyOf(pageWords[next + 1] ?? '') : null;
    if (key === expected) {
      // The word misread is now recited, or the recitation went on past a word left out: the
      // reminder has done its work.
      reread = null;
      current = next;
      next += 1;
    } else if (key === following) {
      reread = next;
      current = next + 1;
      next += 2;
    } else {
      reread = next;
    }
    changed = true;
  }
  return changed ? { next, current, reread } : state;
}
