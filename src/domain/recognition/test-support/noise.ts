/**
 * Simulated transcription errors, reproducible from a seed. Not part of the module.
 *
 * These are the errors named by the spec (confused letter, deleted word, added word,
 * replaced word) plus two that an ordinary reader's transcript shows: a random wrong
 * letter and two words glued together. They imitate text damage only: nothing here
 * models how a real speech engine fails.
 */

/** Returns a new number in [0, 1) at each call. */
export type Random = () => number;

/** Small deterministic generator (mulberry32): same seed, same sequence, on every machine. */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInteger(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

export function pickOne<Item>(random: Random, items: readonly Item[]): Item {
  const item = items[randomInteger(random, 0, items.length - 1)];
  if (item === undefined) throw new RangeError('pickOne needs a non-empty list');
  return item;
}

/** The groups of letters that non-Arabic speakers confuse (spec, "clé tolérante à l'accent"). */
const CONFUSED_LETTER_GROUPS: readonly (readonly string[])[] = [
  ['ح', 'ه'],
  ['ع', 'ء'],
  ['ق', 'ك'],
  ['ص', 'س', 'ث'],
  ['ض', 'د'],
  ['ط', 'ت'],
  ['ذ', 'ز', 'ظ'],
];

/** Letters used for a random wrong letter. */
const COMMON_LETTERS = [...'بتجحدرسعفقكلمنهوي'];

/** Replaces one letter of the word by another letter of its group; null when it has none. */
export function withConfusedLetter(word: string, random: Random): string | null {
  const letters = [...word];
  const candidates = letters
    .map((letter, index) => ({
      index,
      group: CONFUSED_LETTER_GROUPS.find((g) => g.includes(letter)),
    }))
    .filter((candidate) => candidate.group !== undefined);
  if (candidates.length === 0) return null;
  const chosen = pickOne(random, candidates);
  const others = (chosen.group ?? []).filter((letter) => letter !== letters[chosen.index]);
  letters[chosen.index] = pickOne(random, others);
  return letters.join('');
}

/** Replaces, removes or adds one letter at random. */
export function withWrongLetter(word: string, random: Random): string {
  const letters = [...word];
  const index = randomInteger(random, 0, letters.length - 1);
  const edit = randomInteger(random, 0, 2);
  if (edit === 0) letters[index] = pickOne(random, COMMON_LETTERS);
  else if (edit === 1 && letters.length > 1) letters.splice(index, 1);
  else letters.splice(index, 0, pickOne(random, COMMON_LETTERS));
  return letters.join('');
}

export type SimulatedError = 'confused-letter' | 'deleted-word' | 'added-word' | 'replaced-word';

export const SPEC_ERRORS: readonly SimulatedError[] = [
  'confused-letter',
  'deleted-word',
  'added-word',
  'replaced-word',
];

/**
 * Returns a copy of `words` with `errorCount` simulated errors, each of a kind drawn at
 * random. `vocabulary` provides the added and replacing words.
 */
export function withSimulatedErrors(
  words: readonly string[],
  errorCount: number,
  vocabulary: readonly string[],
  random: Random,
): string[] {
  const damaged = [...words];
  for (let error = 0; error < errorCount; error += 1) {
    const kind = pickOne(random, SPEC_ERRORS);
    const index = randomInteger(random, 0, damaged.length - 1);
    const word = damaged[index] ?? '';
    if (kind === 'confused-letter') {
      // A word without any confusable letter gets a replaced word instead.
      damaged[index] = withConfusedLetter(word, random) ?? pickOne(random, vocabulary);
    } else if (kind === 'deleted-word' && damaged.length > 1) {
      damaged.splice(index, 1);
    } else if (kind === 'added-word') {
      damaged.splice(index, 0, pickOne(random, vocabulary));
    } else {
      damaged[index] = pickOne(random, vocabulary);
    }
  }
  return damaged;
}

/** Share of words hit by each kind of damage, for a whole transcript. */
export interface NoiseProfile {
  /** A letter replaced by one of its accent group. */
  readonly confusedLetter: number;
  /** A letter replaced, removed or added at random. */
  readonly wrongLetter: number;
  /** The word is missing from the transcript. */
  readonly droppedWord: number;
  /** The word is glued to the next one. */
  readonly gluedWords: number;
}

/**
 * Damages every word independently according to `profile`: a rough picture of an ordinary
 * reader transcribed by a small model.
 */
export function withNoise(
  words: readonly string[],
  profile: NoiseProfile,
  random: Random,
): string[] {
  const noisy: string[] = [];
  let gluePrefix = '';
  for (const word of words) {
    const draw = random();
    let heard = gluePrefix + word;
    gluePrefix = '';
    if (draw < profile.droppedWord) continue;
    if (draw < profile.droppedWord + profile.gluedWords) {
      gluePrefix = heard;
      continue;
    }
    if (random() < profile.confusedLetter) heard = withConfusedLetter(heard, random) ?? heard;
    if (random() < profile.wrongLetter) heard = withWrongLetter(heard, random);
    noisy.push(heard);
  }
  if (gluePrefix !== '') noisy.push(gluePrefix);
  return noisy;
}
