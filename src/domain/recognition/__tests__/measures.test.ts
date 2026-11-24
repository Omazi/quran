import { UTHMANI_SAMPLE } from '../__fixtures__/uthmani-sample';
import { IMLAEI_SAMPLE } from '../__fixtures__/imlaei-sample';
import { createVerseIndex, normalizeArabic } from '../index';
import {
  measureFollow,
  measureNormalization,
  measureSearch,
  wordEditDistance,
} from '../test-support/measures';
import { createRandom, withNoise, withSimulatedErrors } from '../test-support/noise';

/**
 * The measures of the spec are run on the whole Quran in full-corpus.test.ts. Here the
 * same code runs on the sample, so that it is exercised even without the generated data.
 */
describe('Measures — reproducible random draw', () => {
  const words = UTHMANI_SAMPLE.flatMap((verse) => normalizeArabic(verse.text));

  it('draws the same numbers from the same seed', () => {
    const first = createRandom(42);
    const second = createRandom(42);
    const other = createRandom(43);

    const sequence = Array.from({ length: 20 }, () => first());
    expect(Array.from({ length: 20 }, () => second())).toEqual(sequence);
    expect(Array.from({ length: 20 }, () => other())).not.toEqual(sequence);
    expect(sequence.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('simulates the same errors from the same seed', () => {
    const passage = words.slice(10, 22);
    const damage = (seed: number): string[] =>
      withSimulatedErrors(passage, 3, words, createRandom(seed));

    expect(damage(7)).toEqual(damage(7));
    expect(damage(7)).not.toEqual(passage);
    expect(withSimulatedErrors(passage, 0, words, createRandom(7))).toEqual(passage);
  });

  it('leaves the words untouched when the noise profile is empty', () => {
    const silent = { confusedLetter: 0, wrongLetter: 0, droppedWord: 0, gluedWords: 0 };

    expect(withNoise(words.slice(0, 30), silent, createRandom(1))).toEqual(words.slice(0, 30));
  });
});

describe('Measures — on the sample verses', () => {
  it('counts the verses whose two scripts normalise to the same words', () => {
    const measure = measureNormalization(UTHMANI_SAMPLE, IMLAEI_SAMPLE);

    // 109:1 is the only verse that differs: يَـٰٓأَيُّهَا is one word in Uthmani and two in
    // imla'i, which counts as two word edits (one word replaced, one added).
    expect(measure.verses).toBe(80);
    expect(measure.identicalVerses).toBe(79);
    expect(measure.meanWordEditsWhenDifferent).toBe(2);
  });

  it('counts word edits between two lists of words', () => {
    expect(wordEditDistance(['قل', 'هو'], ['قل', 'هو'])).toBe(0);
    expect(wordEditDistance(['قل', 'يا', 'ءيها'], ['قل', 'يءيها'])).toBe(2);
    expect(wordEditDistance([], ['قل'])).toBe(1);
  });

  it('finds passages of the sample and tells the repeated ones apart', () => {
    const index = createVerseIndex(UTHMANI_SAMPLE);
    const [exact] = measureSearch(index, UTHMANI_SAMPLE, IMLAEI_SAMPLE, {
      seed: 3,
      passages: 60,
      minWords: 6,
      maxWords: 10,
      errorCounts: [0],
      now: () => 0,
    });

    expect(exact?.unique.passages).toBeGreaterThan(0);
    expect(exact?.unique.wrong).toBe(0);
    expect(exact?.unique.notFound).toBe(0);
    expect(exact?.repeated.foundRight).toBe(0);
    expect(exact?.repeated.wrong).toBe(0);
  });

  it('follows a clean reading of the sample without mistake', () => {
    const measure = measureFollow(UTHMANI_SAMPLE, IMLAEI_SAMPLE, 'clean', {
      seed: 9,
      sessions: 10,
      wordsPerSession: 40,
    });

    expect(measure.mistake).toBe(0);
    expect(measure.skipped).toBe(0);
    expect(measure.read).toBe(measure.expectedWords);
  });
});
