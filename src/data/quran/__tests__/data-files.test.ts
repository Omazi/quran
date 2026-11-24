import { quranStructure } from '../index';
import { readPageFile, readVersesFile } from '../data-files';

import pagesFile from '../../../../assets/data/pages/pages-601-604.json';
import uthmaniVerses from '../../../../assets/data/verses/uthmani.json';

const PAGES_PER_FILE = 20;

describe('readVersesFile — a verses file is checked before it is used', () => {
  it('accepts the generated file', () => {
    const verses = readVersesFile(uthmaniVerses, quranStructure);
    expect(Object.keys(verses)).toHaveLength(114);
    expect(verses['1']).toHaveLength(7);
  });

  it.each<[string, unknown]>([
    ['not an object', 'text'],
    ['null', null],
    ['an array', []],
    ['a missing surah', { ...uthmaniVerses, '114': undefined }],
    ['a surah with a missing verse', { ...uthmaniVerses, '1': uthmaniVerses['1'].slice(0, 6) }],
    ['a surah with one verse too many', { ...uthmaniVerses, '1': [...uthmaniVerses['1'], 'x'] }],
    ['an empty verse', { ...uthmaniVerses, '108': ['', '', ''] }],
    ['a verse that is not a text', { ...uthmaniVerses, '108': [1, 2, 3] }],
  ])('refuses %s', (_label, raw) => {
    expect(() => readVersesFile(raw, quranStructure)).toThrow(/Corrupted Quran data/);
  });
});

describe('readPageFile — a page file is checked before it is used', () => {
  it('accepts the generated file', () => {
    const file = readPageFile(pagesFile, 601, PAGES_PER_FILE);
    expect(file.firstPage).toBe(601);
    expect(file.lastPage).toBe(604);
    expect(file.pages.map((page) => page.page)).toEqual([601, 602, 603, 604]);
  });

  const firstPage = pagesFile.pages[0];

  it.each<[string, unknown]>([
    ['not an object', 12],
    ['null', null],
    ['a file without pages', { firstPage: 601, lastPage: 604 }],
    ['a file that holds other pages', { ...pagesFile, firstPage: 581 }],
    ['a file with a missing page', { ...pagesFile, pages: pagesFile.pages.slice(0, 3) }],
    [
      'a page with the wrong number',
      { ...pagesFile, pages: [{ ...firstPage, page: 600 }, ...pagesFile.pages.slice(1)] },
    ],
    ['a page without lines', { ...pagesFile, pages: [{ page: 601 }, ...pagesFile.pages.slice(1)] }],
    [
      'an unknown kind of line',
      { ...pagesFile, pages: [{ page: 601, lines: [{ footer: 1 }] }, ...pagesFile.pages.slice(1)] },
    ],
    [
      'a text line without words',
      {
        ...pagesFile,
        pages: [{ page: 601, lines: [{ surah: 103, words: [] }] }, ...pagesFile.pages.slice(1)],
      },
    ],
    [
      'words that are not three numbers',
      {
        ...pagesFile,
        pages: [
          { page: 601, lines: [{ surah: 103, words: [[1, 1]] }] },
          ...pagesFile.pages.slice(1),
        ],
      },
    ],
    [
      'a word position that is not a whole number',
      {
        ...pagesFile,
        pages: [
          { page: 601, lines: [{ surah: 103, words: [[1, 1, 1.5]] }] },
          ...pagesFile.pages.slice(1),
        ],
      },
    ],
    [
      'a word position of 0',
      {
        ...pagesFile,
        pages: [
          { page: 601, lines: [{ surah: 103, words: [[1, 0, 1]] }] },
          ...pagesFile.pages.slice(1),
        ],
      },
    ],
  ])('refuses %s', (_label, raw) => {
    expect(() => readPageFile(raw, 601, PAGES_PER_FILE)).toThrow(/Corrupted Quran data/);
  });

  it('refuses the right file asked for the wrong pages', () => {
    expect(() => readPageFile(pagesFile, 581, PAGES_PER_FILE)).toThrow(
      'expected pages 581..600, found 601..604',
    );
  });
});
