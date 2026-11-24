import { buildMushafPage, type PageLayout } from '../mushaf-page';
import { STRUCTURE } from '../test-support/quran-test-kit';
import type { VerseRef } from '../types';

/** Test data only: three short "verses" of surah 2, with words that say where they come from. */
const WORDS: Readonly<Record<string, readonly string[]>> = {
  '2:1': ['a1'],
  '2:2': ['b1', 'b2', 'b3'],
  '2:3': ['c1', 'c2'],
};

function wordsOfVerse(ref: VerseRef): readonly string[] {
  return WORDS[`${ref.surah}:${ref.verse}`] ?? [];
}

const LAYOUT: PageLayout = {
  page: 2,
  lines: [
    { header: 2 },
    { basmala: 2 },
    {
      surah: 2,
      words: [
        [1, 1, 1],
        [2, 1, 2],
      ],
    },
    {
      surah: 2,
      words: [
        [2, 3, 3],
        [3, 1, 2],
      ],
    },
  ],
};

describe('buildMushafPage — from the stored layout to the page to display', () => {
  const page = buildMushafPage(LAYOUT, STRUCTURE, wordsOfVerse);

  it('keeps the page number and gives the juz and hizb of the page', () => {
    expect(page.page).toBe(2);
    expect(page.juz).toBe(1);
    expect(page.hizb).toBe(1);
  });

  it('turns header and basmala lines into their line kinds', () => {
    expect(page.lines[0]).toEqual({ kind: 'surah-header', surah: 2 });
    expect(page.lines[1]).toEqual({ kind: 'basmala' });
  });

  it('gives each word its verse, its 1-based position and its text', () => {
    expect(page.lines[2]).toMatchObject({
      kind: 'text',
      words: [
        { verseKey: '2:1', position: 1, text: 'a1' },
        { verseKey: '2:2', position: 1, text: 'b1' },
        { verseKey: '2:2', position: 2, text: 'b2' },
      ],
    });
    expect(page.lines[3]).toMatchObject({
      kind: 'text',
      words: [
        { verseKey: '2:2', position: 3, text: 'b3' },
        { verseKey: '2:3', position: 1, text: 'c1' },
        { verseKey: '2:3', position: 2, text: 'c2' },
      ],
    });
  });

  it('marks the end of a verse on the line of its last word, after that word', () => {
    // Line 3 holds all of 2:1 and the start of 2:2: only 2:1 ends there, after word index 0.
    expect(page.lines[2]).toMatchObject({ verseEnds: [{ afterWordIndex: 0, verse: 1 }] });
    // Line 4: 2:2 ends after its last word (index 0), 2:3 after index 2.
    expect(page.lines[3]).toMatchObject({
      verseEnds: [
        { afterWordIndex: 0, verse: 2 },
        { afterWordIndex: 2, verse: 3 },
      ],
    });
  });

  it('a line that ends in the middle of a verse has no end mark', () => {
    const line = buildMushafPage(
      { page: 2, lines: [{ surah: 2, words: [[2, 1, 2]] }] },
      STRUCTURE,
      wordsOfVerse,
    ).lines[0];
    expect(line).toMatchObject({ kind: 'text', verseEnds: [] });
  });
});

describe('buildMushafPage — an invalid layout raises an explicit error', () => {
  const build = (lines: PageLayout['lines'], page = 2) =>
    buildMushafPage({ page, lines }, STRUCTURE, wordsOfVerse);

  it('a word after the last word of the verse', () => {
    expect(() => build([{ surah: 2, words: [[2, 1, 4]] }])).toThrow(RangeError);
    expect(() => build([{ surah: 2, words: [[2, 1, 4]] }])).toThrow(
      'Invalid layout of page 2: words 1..4 of 2:2 (the verse has 3 words)',
    );
  });

  it('a word numbered 0', () => {
    expect(() => build([{ surah: 2, words: [[2, 0, 1]] }])).toThrow(RangeError);
  });

  it('a range that ends before it starts', () => {
    expect(() => build([{ surah: 2, words: [[2, 3, 2]] }])).toThrow(RangeError);
  });

  it('a verse that does not exist', () => {
    expect(() => build([{ surah: 2, words: [[287, 1, 1]] }])).toThrow(RangeError);
    expect(() => build([{ surah: 115, words: [[1, 1, 1]] }])).toThrow(RangeError);
  });

  it('a header for a surah that does not exist', () => {
    expect(() => build([{ header: 0 }])).toThrow(RangeError);
    expect(() => build([{ header: 115 }])).toThrow(RangeError);
  });

  it('page 605', () => {
    expect(() => build([{ surah: 2, words: [[1, 1, 1]] }], 605)).toThrow(RangeError);
  });
});
