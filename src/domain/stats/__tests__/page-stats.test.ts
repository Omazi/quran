import type { MushafPage } from '@/domain/quran';

import { buildSmallMushaf, fixturePage } from '../__fixtures__/small-mushaf';
import { buildPageStatsTable } from '../page-stats';

describe('buildPageStatsTable — words, letters and verses of each page, computed once', () => {
  const table = buildPageStatsTable(buildSmallMushaf());

  it('gives one entry per page, in page order', () => {
    expect(table.map(({ page }) => page)).toEqual([1, 2, 3]);
  });

  it('counts the words printed on each page, a cut verse counting only the words it has there', () => {
    expect(table.map(({ words }) => words)).toEqual([5, 5, 2]);
  });

  it('counts the letters of the words of each page', () => {
    // Page 1: 3+4+6 + 5+3. Page 2: 2+7 + 3+5 + 2. Page 3: 3+3.
    expect(table.map(({ letters }) => letters)).toEqual([21, 19, 6]);
  });

  it('attaches a verse to the page where it ends, with every page that holds a word of it', () => {
    expect(table[0]?.endingVerses).toEqual([{ verse: '1:1', pages: [1] }]);
    expect(table[1]?.endingVerses).toEqual([
      { verse: '1:2', pages: [1, 2] },
      { verse: '1:3', pages: [2] },
    ]);
    expect(table[2]?.endingVerses).toEqual([{ verse: '1:4', pages: [2, 3] }]);
  });

  it('does not count the end-of-verse marks as words', () => {
    // 12 words in the four verses, whatever the number of verse ends.
    expect(table.reduce((sum, { words }) => sum + words, 0)).toBe(12);
  });

  it('ignores header and basmala lines: they carry no word', () => {
    const [first, ...others] = buildSmallMushaf();
    const withHeader: MushafPage[] = [
      {
        ...(first as MushafPage),
        lines: [
          { kind: 'surah-header', surah: 1 },
          { kind: 'basmala' },
          ...(first as MushafPage).lines,
        ],
      },
      ...others,
    ];
    expect(buildPageStatsTable(withHeader)).toEqual(table);
  });

  it('adds the words of several text lines of the same page', () => {
    const [, two, three] = buildSmallMushaf() as [MushafPage, MushafPage, MushafPage];
    const lines = [
      ...fixturePage(1, [['1:1', 1, 3]]).lines,
      ...fixturePage(1, [['1:2', 1, 2]]).lines,
    ];
    const onTwoLines: MushafPage = { ...fixturePage(1, []), lines };
    expect(buildPageStatsTable([onTwoLines, two, three])).toEqual(table);
  });

  it('rejects the same words printed twice on a page: the verse would end twice', () => {
    const [one, two, three] = buildSmallMushaf() as [MushafPage, MushafPage, MushafPage];
    const [line] = one.lines;
    const twice: MushafPage = { ...one, lines: [line, line] as MushafPage['lines'] };
    expect(() => buildPageStatsTable([twice, two, three])).toThrow(RangeError);
  });

  describe('invalid input', () => {
    it('rejects something that is not a list of pages', () => {
      expect(() => buildPageStatsTable(undefined as unknown as MushafPage[])).toThrow(TypeError);
    });

    it('rejects an empty list', () => {
      expect(() => buildPageStatsTable([])).toThrow(RangeError);
    });

    it('rejects pages that are not 1, 2, 3... in order', () => {
      const [one, two, three] = buildSmallMushaf() as [MushafPage, MushafPage, MushafPage];
      expect(() => buildPageStatsTable([two, one, three])).toThrow(RangeError);
      expect(() => buildPageStatsTable([one, three])).toThrow(RangeError);
    });

    it('rejects a verse that never ends: the mushaf was cut', () => {
      const [one, two] = buildSmallMushaf() as [MushafPage, MushafPage];
      expect(() => buildPageStatsTable([one, two])).toThrow(RangeError);
    });

    it('rejects a verse that has words again after the page where it ends (so it would end twice)', () => {
      const [one, two, three] = buildSmallMushaf() as [MushafPage, MushafPage, MushafPage];
      const late = fixturePage(4, [['1:1', 1, 1]]);
      expect(() => buildPageStatsTable([one, two, three, late])).toThrow(RangeError);
    });

    it('rejects a word that the letter rule does not know', () => {
      const [one, two, three] = buildSmallMushaf() as [MushafPage, MushafPage, MushafPage];
      const [line] = one.lines;
      if (line?.kind !== 'text') throw new Error('Test setup: expected a text line');
      const broken: MushafPage = {
        ...one,
        lines: [
          {
            ...line,
            words: [{ verseKey: '1:1', position: 1, text: 'abc' }, ...line.words.slice(1)],
          },
        ],
      };
      expect(() => buildPageStatsTable([broken, two, three])).toThrow(RangeError);
    });

    it('rejects a page without a text line list', () => {
      const [one, two, three] = buildSmallMushaf() as [MushafPage, MushafPage, MushafPage];
      const broken = { ...one, lines: undefined } as unknown as MushafPage;
      expect(() => buildPageStatsTable([broken, two, three])).toThrow(TypeError);
    });
  });
});
