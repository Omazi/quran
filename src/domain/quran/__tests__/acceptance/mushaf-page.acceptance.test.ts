/**
 * Acceptance tests — from the stored layout of a page to the page that is displayed.
 * Spec (docs/specs/quran.md): "Chaque mot de chaque verset apparaît exactement une fois dans
 * les pages, dans l'ordre" and "Chaque page a au plus 15 lignes ; les pages 1 et 2 sont un
 * cas particulier connu". The whole mushaf is checked in src/data/quran; here the builder
 * is checked alone, on the two pages whose lines the tester knows by heart.
 */
import {
  buildMushafPage,
  createQuranStructure,
  type MushafLine,
  type PageLayout,
  type PageLineLayout,
  type VerseRef,
} from '@/domain/quran';

import structureData from '../../../../../assets/data/structure.json';
import { itemAt } from './mushaf-anchors';

const structure = createQuranStructure(structureData);

/**
 * Page 1 of the Madinah mushaf, line by line: the heading, then seven lines of text.
 * Written from the printed page, not from the app's data.
 */
const PAGE_1: PageLayout = {
  page: 1,
  lines: [
    { header: 1 },
    { surah: 1, words: [[1, 1, 4]] },
    { surah: 1, words: [[2, 1, 4]] },
    {
      surah: 1,
      words: [
        [3, 1, 2],
        [4, 1, 3],
      ],
    },
    {
      surah: 1,
      words: [
        [5, 1, 4],
        [6, 1, 1],
      ],
    },
    {
      surah: 1,
      words: [
        [6, 2, 3],
        [7, 1, 3],
      ],
    },
    { surah: 1, words: [[7, 4, 7]] },
    { surah: 1, words: [[7, 8, 9]] },
  ],
};

/** Page 2: heading, basmala, then 2:1-5 on six lines. */
const PAGE_2: PageLayout = {
  page: 2,
  lines: [
    { header: 2 },
    { basmala: 2 },
    {
      surah: 2,
      words: [
        [1, 1, 1],
        [2, 1, 6],
      ],
    },
    {
      surah: 2,
      words: [
        [2, 7, 7],
        [3, 1, 5],
      ],
    },
    {
      surah: 2,
      words: [
        [3, 6, 8],
        [4, 1, 4],
      ],
    },
    { surah: 2, words: [[4, 5, 12]] },
    { surah: 2, words: [[5, 1, 6]] },
    { surah: 2, words: [[5, 7, 8]] },
  ],
};

/** Words per verse on these two pages (al-Fatiha: 29 words; 2:1-5: 36 words). */
const WORD_COUNTS: Readonly<Record<string, number>> = {
  '1:1': 4,
  '1:2': 4,
  '1:3': 2,
  '1:4': 3,
  '1:5': 4,
  '1:6': 3,
  '1:7': 9,
  '2:1': 1,
  '2:2': 7,
  '2:3': 8,
  '2:4': 12,
  '2:5': 8,
};

/** A recognisable stand-in for each word: "w<surah>:<verse>#<position>". */
function wordsOfVerse(ref: VerseRef): readonly string[] {
  const key = `${ref.surah}:${ref.verse}`;
  const count = WORD_COUNTS[key];
  if (count === undefined) {
    throw new RangeError(`The test has no words for ${key}.`);
  }
  return Array.from({ length: count }, (_, index) => `w${key}#${index + 1}`);
}

function textLines(lines: readonly MushafLine[]): Extract<MushafLine, { kind: 'text' }>[] {
  return lines.filter((line) => line.kind === 'text');
}

function expectExplicitError(action: () => unknown): void {
  let error: unknown;
  try {
    action();
  } catch (caught) {
    error = caught;
  }
  expect(error instanceof RangeError || error instanceof TypeError).toBe(true);
}

function pageOneWith(lines: readonly PageLineLayout[]): PageLayout {
  return { page: 1, lines };
}

describe('buildMushafPage — page 1 (al-Fatiha)', () => {
  const page = buildMushafPage(PAGE_1, structure, wordsOfVerse);

  it('is page 1, in juz 1 and hizb 1, with 8 lines: the heading and 7 lines of text', () => {
    expect(page.page).toBe(1);
    expect(page.juz).toBe(1);
    expect(page.hizb).toBe(1);
    expect(page.lines).toHaveLength(8);
    expect(page.lines.map((line) => line.kind)).toEqual([
      'surah-header',
      'text',
      'text',
      'text',
      'text',
      'text',
      'text',
      'text',
    ]);
    expect(page.lines[0]).toEqual({ kind: 'surah-header', surah: 1 });
  });

  it('places each of the 29 words once, in order, with its verse key and its position', () => {
    const words = textLines(page.lines).flatMap((line) => line.words);
    expect(words).toHaveLength(29);
    const expected = Object.entries(WORD_COUNTS)
      .filter(([key]) => key.startsWith('1:'))
      .flatMap(([key, count]) =>
        Array.from({ length: count }, (_, index) => ({
          verseKey: key,
          position: index + 1,
          text: `w${key}#${index + 1}`,
        })),
      );
    expect(words).toEqual(expected);
  });

  it('keeps the words of each line: the third line of text holds verse 3 then verse 4', () => {
    const third = itemAt(textLines(page.lines), 2);
    expect(third.words.map((word) => word.text)).toEqual([
      'w1:3#1',
      'w1:3#2',
      'w1:4#1',
      'w1:4#2',
      'w1:4#3',
    ]);
  });

  it('marks the end of each verse on the line where it ends, after its last word', () => {
    const ends = textLines(page.lines).map((line) => line.verseEnds);
    expect(ends).toEqual([
      [{ afterWordIndex: 3, verse: 1 }],
      [{ afterWordIndex: 3, verse: 2 }],
      [
        { afterWordIndex: 1, verse: 3 },
        { afterWordIndex: 4, verse: 4 },
      ],
      [{ afterWordIndex: 3, verse: 5 }],
      [{ afterWordIndex: 1, verse: 6 }],
      [],
      [{ afterWordIndex: 1, verse: 7 }],
    ]);
  });
});

describe('buildMushafPage — page 2 (heading, basmala, 2:1-5)', () => {
  const page = buildMushafPage(PAGE_2, structure, wordsOfVerse);

  it('has 8 lines: heading, basmala and 6 lines of text', () => {
    expect(page.page).toBe(2);
    expect(page.juz).toBe(1);
    expect(page.hizb).toBe(1);
    expect(page.lines.map((line) => line.kind)).toEqual([
      'surah-header',
      'basmala',
      'text',
      'text',
      'text',
      'text',
      'text',
      'text',
    ]);
    expect(page.lines[0]).toEqual({ kind: 'surah-header', surah: 2 });
  });

  it('places the 36 words once and in order; the one-word verse 2:1 ends after its only word', () => {
    const lines = textLines(page.lines);
    const words = lines.flatMap((line) => line.words);
    expect(words.map((word) => `${word.verseKey}#${word.position}`)).toEqual(
      Object.entries(WORD_COUNTS)
        .filter(([key]) => key.startsWith('2:'))
        .flatMap(([key, count]) => Array.from({ length: count }, (_, i) => `${key}#${i + 1}`)),
    );
    expect(itemAt(lines, 0).verseEnds).toEqual([{ afterWordIndex: 0, verse: 1 }]);
    expect(itemAt(lines, 5).verseEnds).toEqual([{ afterWordIndex: 1, verse: 5 }]);
  });
});

describe('buildMushafPage — juz et hizb de la page : ceux de son premier verset', () => {
  it('page 22 opens juz 2 and hizb 3 (2:142)', () => {
    const layout: PageLayout = { page: 22, lines: [{ surah: 2, words: [[142, 1, 2]] }] };
    const page = buildMushafPage(layout, structure, () => ['a', 'b']);
    expect(page.juz).toBe(2);
    expect(page.hizb).toBe(3);
  });

  it('page 582 opens juz 30 and hizb 59 (78:1)', () => {
    const layout: PageLayout = {
      page: 582,
      lines: [{ header: 78 }, { basmala: 78 }, { surah: 78, words: [[1, 1, 2]] }],
    };
    const page = buildMushafPage(layout, structure, () => ['a', 'b']);
    expect(page.juz).toBe(30);
    expect(page.hizb).toBe(59);
  });
});

describe('buildMushafPage — entrées invalides : erreur explicite, jamais de mot sans texte', () => {
  it('accepts the control layout', () => {
    expect(() => buildMushafPage(PAGE_1, structure, wordsOfVerse)).not.toThrow();
  });

  it.each([0, 605, -1, 1.5, Number.NaN])('refuses page number %p', (pageNumber) => {
    expectExplicitError(() =>
      buildMushafPage({ page: pageNumber, lines: PAGE_1.lines }, structure, wordsOfVerse),
    );
  });

  it.each<[string, PageLineLayout]>([
    ['a word beyond the last word of the verse', { surah: 1, words: [[1, 1, 5]] }],
    ['a first word numbered 0', { surah: 1, words: [[1, 0, 4]] }],
    ['a first word after the last word', { surah: 1, words: [[1, 3, 2]] }],
    ['a word position that is not an integer', { surah: 1, words: [[1, 1.5, 4]] }],
    ['a verse that does not exist (1:8)', { surah: 1, words: [[8, 1, 2]] }],
    ['verse number 0', { surah: 1, words: [[0, 1, 2]] }],
    ['surah 0', { surah: 0, words: [[1, 1, 4]] }],
    ['surah 115', { surah: 115, words: [[1, 1, 4]] }],
    ['a heading for surah 115', { header: 115 }],
    ['a heading for surah 0', { header: 0 }],
  ])('refuses a line with %s', (_name, line) => {
    expectExplicitError(() => buildMushafPage(pageOneWith([line]), structure, wordsOfVerse));
  });

  it('refuses a verse for which no word is given, instead of showing an empty verse', () => {
    expectExplicitError(() => buildMushafPage(PAGE_1, structure, () => []));
  });

  it('refuses a verse that has fewer words than the layout places', () => {
    expectExplicitError(() => buildMushafPage(PAGE_1, structure, () => ['only', 'two']));
  });

  it('does not change the layout it is given', () => {
    const before = JSON.stringify(PAGE_2);
    buildMushafPage(PAGE_2, structure, wordsOfVerse);
    expect(JSON.stringify(PAGE_2)).toBe(before);
  });
});
