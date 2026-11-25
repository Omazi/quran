import type { MushafPage, MushafWord, VerseKey } from '@/domain/quran';

/**
 * A mushaf of three pages and four verses, small enough to count by hand. Two verses are cut by
 * a page break:
 *
 *   page 1: 1:1 (3 words) | 1:2 words 1-2 of 4
 *   page 2: 1:2 words 3-4 | 1:3 (2 words) | 1:4 word 1 of 3
 *   page 3: 1:4 words 2-3
 *
 * Words are real Quran words so that letters can be counted by hand:
 *   بِسۡمِ(3) ٱللَّهِ(4) ٱلرَّحۡمَٰنِ(6) | ٱلۡحَمۡدُ(5) لِلَّهِ(3) رَبِّ(2) ٱلۡعَٰلَمِينَ(7)
 *   | ذَٰلِكَ(3) ٱلۡكِتَٰبُ(5) | لَا(2) رَيۡبَۛ(3) فِيهِۛ(3)
 */
export const WORDS_OF_VERSE: Readonly<Record<VerseKey, readonly string[]>> = {
  '1:1': ['بِسۡمِ', 'ٱللَّهِ', 'ٱلرَّحۡمَٰنِ'],
  '1:2': ['ٱلۡحَمۡدُ', 'لِلَّهِ', 'رَبِّ', 'ٱلۡعَٰلَمِينَ'],
  '1:3': ['ذَٰلِكَ', 'ٱلۡكِتَٰبُ'],
  '1:4': ['لَا', 'رَيۡبَۛ', 'فِيهِۛ'],
};

/** A slice of one verse on a page: words `first..last` (1-based). */
type Slice = readonly [verse: VerseKey, first: number, last: number];

/** One page made of one text line. Verses that end on it are those whose last word is shown. */
export function fixturePage(page: number, slices: readonly Slice[]): MushafPage {
  const words: MushafWord[] = [];
  const verseEnds: { afterWordIndex: number; verse: number }[] = [];
  for (const [verseKey, first, last] of slices) {
    const verseWords = WORDS_OF_VERSE[verseKey] ?? [];
    verseWords.slice(first - 1, last).forEach((text, offset) => {
      words.push({ verseKey, position: first + offset, text });
    });
    if (last === verseWords.length) {
      verseEnds.push({
        afterWordIndex: words.length - 1,
        verse: Number(verseKey.split(':')[1]),
      });
    }
  }
  return { page, juz: 1, hizb: 1, lines: [{ kind: 'text', words, verseEnds }] };
}

export function buildSmallMushaf(): MushafPage[] {
  return [
    fixturePage(1, [
      ['1:1', 1, 3],
      ['1:2', 1, 2],
    ]),
    fixturePage(2, [
      ['1:2', 3, 4],
      ['1:3', 1, 2],
      ['1:4', 1, 1],
    ]),
    fixturePage(3, [['1:4', 2, 3]]),
  ];
}

/**
 * A mushaf of 604 pages with the shape of the real one and numbers that are easy to add up:
 * every page holds the two words بِسۡمِ (3 letters) and رَبِّ (2 letters) of one verse that ends
 * on it, "1:<page>". It lets tests write whole khatmas (604 pages) without the real text.
 *
 * With `isFirstVerseCut`, pages 1 and 2 hold ONE verse, "1:1" (four words, ending on page 2),
 * so the mushaf has 603 verses instead of 604.
 */
export const UNIFORM_PAGE_COUNT = 604;
export const UNIFORM_WORDS_PER_PAGE = 2;
export const UNIFORM_LETTERS_PER_PAGE = 5;

export function buildUniformMushaf(isFirstVerseCut = false): MushafPage[] {
  return Array.from({ length: UNIFORM_PAGE_COUNT }, (_, index): MushafPage => {
    const page = index + 1;
    const isCut = isFirstVerseCut && page <= 2;
    const verseKey: VerseKey = isCut ? '1:1' : `1:${page}`;
    const firstPosition = isCut && page === 2 ? 3 : 1;
    const words: MushafWord[] = ['بِسۡمِ', 'رَبِّ'].map((text, offset) => ({
      verseKey,
      position: firstPosition + offset,
      text,
    }));
    const endsHere = !isCut || page === 2;
    const verseEnds = endsHere ? [{ afterWordIndex: 1, verse: isCut ? 1 : page }] : [];
    return { page, juz: 1, hizb: 1, lines: [{ kind: 'text', words, verseEnds }] };
  });
}
