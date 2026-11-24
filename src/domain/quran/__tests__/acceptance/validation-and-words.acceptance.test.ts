/**
 * Acceptance tests — guards on numbers, shared constants and word splitting.
 * Spec (docs/specs/quran.md): "Entrées invalides (sourate 0, verset 300 de la sourate 1,
 * page 605) : erreur explicite" and the counts 114 / 6 236 / 604 / 30 / 60.
 */
import {
  assertHizbNumber,
  assertPageNumber,
  assertSurahNumber,
  DEFAULT_QURAN_SCRIPT,
  HIZB_COUNT,
  HIZB_PER_JUZ,
  JUZ_COUNT,
  LINES_PER_PAGE,
  PAGE_COUNT,
  splitVerseWords,
  SURAH_COUNT,
  VERSE_COUNT,
  WORD_SEPARATOR,
} from '@/domain/quran';

function thrownBy(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  return undefined;
}

function expectExplicitError(action: () => unknown): void {
  const error = thrownBy(action);
  expect(error instanceof RangeError || error instanceof TypeError).toBe(true);
}

describe('Invariant — 114 sourates, 6 236 versets, 604 pages, 30 juz, 60 hizb (constantes)', () => {
  it('exposes the counts of the mushaf', () => {
    expect(SURAH_COUNT).toBe(114);
    expect(VERSE_COUNT).toBe(6236);
    expect(PAGE_COUNT).toBe(604);
    expect(JUZ_COUNT).toBe(30);
    expect(HIZB_COUNT).toBe(60);
    expect(LINES_PER_PAGE).toBe(15);
    expect(HIZB_PER_JUZ * JUZ_COUNT).toBe(HIZB_COUNT);
  });

  it('reads the Uthmani script by default', () => {
    expect(DEFAULT_QURAN_SCRIPT).toBe('uthmani');
  });
});

describe.each([
  { name: 'assertSurahNumber (sourate 0 : erreur explicite)', guard: assertSurahNumber, max: 114 },
  { name: 'assertPageNumber (page 605 : erreur explicite)', guard: assertPageNumber, max: 604 },
  { name: 'assertHizbNumber', guard: assertHizbNumber, max: 60 },
])('Entrées invalides — $name', ({ guard, max }) => {
  it('accepts 1, the maximum and what lies between', () => {
    expect(guard(1)).toBeUndefined();
    expect(guard(2)).toBeUndefined();
    expect(guard(max - 1)).toBeUndefined();
    expect(guard(max)).toBeUndefined();
  });

  it('refuses 0 and maximum + 1 with a RangeError', () => {
    expect(() => guard(0)).toThrow(RangeError);
    expect(() => guard(max + 1)).toThrow(RangeError);
  });

  it.each([
    -1,
    -0.5,
    0.5,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    2 ** 53,
  ])('refuses %p', (value) => {
    expectExplicitError(() => guard(value));
  });

  it.each(['1', '', null, undefined, true, [1], { valueOf: () => 1 }])(
    'refuses %p, which is not a number',
    (value) => {
      // as: simulates an untyped caller (navigation parameter, stored JSON).
      expectExplicitError(() => guard(value as number));
    },
  );
});

describe('Découpage en mots — splitVerseWords', () => {
  it('separates on the ordinary space (U+0020) only', () => {
    expect(WORD_SEPARATOR).toBe('\u0020');
    expect(splitVerseWords('قُلۡ هُوَ ٱللَّهُ أَحَدٌ')).toEqual(['قُلۡ', 'هُوَ', 'ٱللَّهُ', 'أَحَدٌ']);
  });

  it('keeps a one-word verse whole', () => {
    expect(splitVerseWords('طه')).toEqual(['طه']);
  });

  it('does not cut on a thin space inside a word (verse 2:72)', () => {
    const word = 'فَٱدَّٰرَ\u2009ٰٔتُمۡ';
    expect(splitVerseWords(`نَفۡسٗا ${word} فِيهَا`)).toEqual(['نَفۡسٗا', word, 'فِيهَا']);
  });

  it.each(['\u00A0', '\t', '\n', '\u200B', '\u200F', '\u3000'])(
    'does not cut on another white or invisible character (%j)',
    (character) => {
      expect(splitVerseWords(`a${character}b c`)).toEqual([`a${character}b`, 'c']);
    },
  );

  it('joining the words with the separator gives the text back', () => {
    const text = '۞إِنَّ ٱللَّهَ لَا يَسۡتَحۡيِۦٓ أَن يَضۡرِبَ مَثَلٗا';
    expect(splitVerseWords(text).join(WORD_SEPARATOR)).toBe(text);
  });

  it('gives a new list at each call', () => {
    const first = splitVerseWords('a b');
    first.push('c');
    expect(splitVerseWords('a b')).toEqual(['a', 'b']);
  });

  it('never returns an empty word: a malformed text is refused or cut without one', () => {
    // An empty word would shift every word position that follows it, and '' would count
    // as a verse of one word. One test for the six cases: it is a single rule.
    const malformedTexts = ['', ' ', 'a  b', ' a b', 'a b ', '  '];
    const answersWithEmptyWord: string[] = [];
    for (const text of malformedTexts) {
      let words: string[];
      try {
        words = splitVerseWords(text);
      } catch (error) {
        expect(error instanceof RangeError || error instanceof TypeError).toBe(true);
        continue;
      }
      if (words.includes('')) {
        answersWithEmptyWord.push(`${JSON.stringify(text)} -> ${JSON.stringify(words)}`);
      }
    }
    expect(answersWithEmptyWord).toEqual([]);
  });
});
