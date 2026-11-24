/**
 * Acceptance tests — the 604 pages of the mushaf, read through the repository.
 * Spec (docs/specs/quran.md, "Invariants à tester"):
 *  - 604 pages; "Chaque page a au plus 15 lignes ; les pages 1 et 2 sont un cas particulier connu";
 *  - "Chaque mot de chaque verset apparaît exactement une fois dans les pages, dans l'ordre";
 *  - "La concaténation des mots d'un verset dans les pages est identique au texte du verset".
 */
import { quranRepository, quranStructure } from '@/data/quran';
import {
  LINES_PER_PAGE,
  splitVerseWords,
  type MushafLine,
  type MushafPage,
  type MushafWord,
} from '@/domain/quran';
import {
  allVerseKeys,
  FIRST_PAGE_OF_SURAH,
  itemAt,
  SURAH_WITH_TWO_BASMALAS,
  SURAH_WITHOUT_BASMALA,
} from '@/domain/quran/__tests__/acceptance/mushaf-anchors';

type TextLine = Extract<MushafLine, { kind: 'text' }>;

const PAGE_NUMBERS = Array.from({ length: 604 }, (_, index) => index + 1);
const SURAH_NUMBERS = Array.from({ length: 114 }, (_, index) => index + 1);
const ALL_KEYS = allVerseKeys();
/** Pages 1 and 2 are framed pages: the heading and seven more lines. */
const LINES_ON_FRAMED_PAGES = 8;

const pages: MushafPage[] = [];
const verseText = new Map<string, string>();

beforeAll(async () => {
  for (const pageNumber of PAGE_NUMBERS) {
    pages.push(await quranRepository.getPage(pageNumber));
  }
  for (const surah of SURAH_NUMBERS) {
    for (const verse of await quranRepository.getSurahVerses(surah, 'uthmani')) {
      verseText.set(verse.key, verse.text);
    }
  }
});

function pageNumbered(pageNumber: number): MushafPage {
  return itemAt(pages, pageNumber - 1);
}

function textLinesOf(page: MushafPage): TextLine[] {
  return page.lines.filter((line) => line.kind === 'text');
}

function wordsOfPage(page: MushafPage): MushafWord[] {
  return textLinesOf(page).flatMap((line) => line.words);
}

function wordsOfVerse(key: string): string[] {
  const text = verseText.get(key);
  if (text === undefined) {
    throw new RangeError(`No Uthmani text for ${key}.`);
  }
  return splitVerseWords(text);
}

function label(word: MushafWord): string {
  return `${word.verseKey}#${word.position}`;
}

function surahOfKey(key: string): number {
  return Number(key.split(':')[0]);
}

function verseOfKey(key: string): number {
  return Number(key.split(':')[1]);
}

describe('Invariant — 604 pages', () => {
  it('the repository gives pages 1 to 604, each under its own number', () => {
    expect(pages).toHaveLength(604);
    expect(pages.map((page) => page.page)).toEqual(PAGE_NUMBERS);
  });
});

describe('Invariant — Chaque page a au plus 15 lignes ; les pages 1 et 2 sont un cas particulier connu', () => {
  it('no page has more than 15 lines', () => {
    expect(LINES_PER_PAGE).toBe(15);
    expect(pages.filter((page) => page.lines.length > LINES_PER_PAGE)).toEqual([]);
  });

  it('pages 3 to 604 have exactly 15 lines', () => {
    const others = pages.slice(2).filter((page) => page.lines.length !== LINES_PER_PAGE);
    expect(others.map((page) => `page ${page.page}: ${page.lines.length} lines`)).toEqual([]);
  });

  it('pages 1 and 2 have 8 lines: the heading and seven more', () => {
    expect(pageNumbered(1).lines).toHaveLength(LINES_ON_FRAMED_PAGES);
    expect(pageNumbered(2).lines).toHaveLength(LINES_ON_FRAMED_PAGES);
  });

  it('every line is a heading, a basmala or a line of text with at least one word', () => {
    for (const page of pages) {
      for (const line of page.lines) {
        expect(['surah-header', 'basmala', 'text']).toContain(line.kind);
        if (line.kind === 'text') {
          expect(line.words.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('Ancres indépendantes — titres de sourate et basmalas', () => {
  it('114 headings, one per surah, in order, each on the page where its surah begins', () => {
    const headings = pages.flatMap((page) =>
      page.lines.flatMap((line) =>
        line.kind === 'surah-header' ? [{ surah: line.surah, page: page.page }] : [],
      ),
    );
    expect(headings.map((heading) => heading.surah)).toEqual(SURAH_NUMBERS);
    expect(headings.map((heading) => heading.page)).toEqual(FIRST_PAGE_OF_SURAH);
  });

  it('112 basmala lines: every surah has one, except al-Fatiha (it is verse 1) and at-Tawba (none)', () => {
    const surahsWithBasmalaLine: number[] = [];
    for (const page of pages) {
      page.lines.forEach((line, index) => {
        if (line.kind !== 'basmala') {
          return;
        }
        const previous = page.lines[index - 1];
        // A basmala is always printed right under the heading of its surah.
        expect(previous?.kind).toBe('surah-header');
        if (previous?.kind === 'surah-header') {
          surahsWithBasmalaLine.push(previous.surah);
        }
      });
    }
    const expected = SURAH_NUMBERS.filter(
      (surah) => surah !== 1 && surah !== SURAH_WITHOUT_BASMALA,
    );
    expect(surahsWithBasmalaLine).toEqual(expected);
    expect(surahsWithBasmalaLine).toHaveLength(112);
  });

  it('under each heading (and its basmala) comes the first word of the first verse, on the same page', () => {
    for (const page of pages) {
      page.lines.forEach((line, index) => {
        if (line.kind !== 'surah-header') {
          return;
        }
        const hasBasmala = line.surah !== 1 && line.surah !== SURAH_WITHOUT_BASMALA;
        const firstTextLine = page.lines[index + (hasBasmala ? 2 : 1)];
        expect(firstTextLine?.kind).toBe('text');
        if (firstTextLine?.kind === 'text') {
          expect(label(itemAt(firstTextLine.words, 0))).toBe(`${line.surah}:1#1`);
        }
      });
    }
  });

  it('at-Tawba (page 187) opens with its heading and no basmala', () => {
    const lines = pageNumbered(187).lines;
    expect(lines[0]).toEqual({ kind: 'surah-header', surah: SURAH_WITHOUT_BASMALA });
    expect(lines[1]?.kind).toBe('text');
    expect(lines.filter((line) => line.kind === 'basmala')).toEqual([]);
  });

  it('an-Naml has two basmalas: the line under its heading and the words of verse 27:30', () => {
    const firstPage = pageNumbered(itemAt(FIRST_PAGE_OF_SURAH, SURAH_WITH_TWO_BASMALAS - 1));
    const headingIndex = firstPage.lines.findIndex(
      (line) => line.kind === 'surah-header' && line.surah === SURAH_WITH_TWO_BASMALAS,
    );
    expect(firstPage.lines[headingIndex + 1]?.kind).toBe('basmala');
    const basmalaWords = wordsOfVerse('1:1');
    expect(wordsOfVerse('27:30').slice(-basmalaWords.length)).toEqual(basmalaWords);
  });

  it('page 604 holds three headings: surahs 112, 113 and 114', () => {
    const headings = pageNumbered(604).lines.flatMap((line) =>
      line.kind === 'surah-header' ? [line.surah] : [],
    );
    expect(headings).toEqual([112, 113, 114]);
  });
});

describe('Invariant — Chaque mot de chaque verset apparaît exactement une fois dans les pages, dans l’ordre', () => {
  it('the words of the 604 pages, read in order, are the words of the 6236 verses, each once', () => {
    const placed = pages.flatMap((page) => wordsOfPage(page).map(label));
    const expected = ALL_KEYS.flatMap((key) =>
      wordsOfVerse(key).map((_, index) => `${key}#${index + 1}`),
    );
    expect(placed.length).toBe(expected.length);
    const firstDifferences: string[] = [];
    for (let index = 0; index < expected.length && firstDifferences.length < 10; index += 1) {
      if (placed[index] !== expected[index]) {
        firstDifferences.push(
          `word ${index}: placed ${placed[index]}, expected ${expected[index]}`,
        );
      }
    }
    expect(firstDifferences).toEqual([]);
    expect(new Set(placed).size).toBe(placed.length);
  });

  it('each placed word carries the text of that word of the Uthmani verse', () => {
    const wrongWords: string[] = [];
    for (const page of pages) {
      for (const word of wordsOfPage(page)) {
        if (word.text !== wordsOfVerse(word.verseKey)[word.position - 1]) {
          wrongWords.push(`page ${page.page}: ${label(word)}`);
        }
      }
    }
    expect(wrongWords).toEqual([]);
  });

  it('no word of a page is empty or holds a space', () => {
    const badWords = pages.flatMap((page) =>
      wordsOfPage(page)
        .filter((word) => word.text.length === 0 || word.text.includes(' '))
        .map(label),
    );
    expect(badWords).toEqual([]);
  });

  it('a line holds the words of one surah only', () => {
    for (const page of pages) {
      for (const line of textLinesOf(page)) {
        expect(new Set(line.words.map((word) => surahOfKey(word.verseKey))).size).toBe(1);
      }
    }
  });
});

describe('Invariant — La concaténation des mots d’un verset dans les pages est identique au texte du verset', () => {
  it('rebuilding each of the 6236 verses from its page words gives the verse text', () => {
    const rebuilt = new Map<string, string[]>();
    for (const page of pages) {
      for (const word of wordsOfPage(page)) {
        const words = rebuilt.get(word.verseKey) ?? [];
        words.push(word.text);
        rebuilt.set(word.verseKey, words);
      }
    }
    expect(rebuilt.size).toBe(6236);
    const differences = ALL_KEYS.filter(
      (key) => (rebuilt.get(key) ?? []).join(' ') !== verseText.get(key),
    );
    expect(differences).toEqual([]);
  });
});

describe('Pages contiguës', () => {
  it('every page starts with the first word of a verse and ends with the last word of a verse', () => {
    for (const page of pages) {
      const words = wordsOfPage(page);
      const first = itemAt(words, 0);
      const last = itemAt(words, words.length - 1);
      expect(first.position).toBe(1);
      expect(last.position).toBe(wordsOfVerse(last.verseKey).length);
    }
  });

  it('each page starts with the verse that follows the last verse of the previous page', () => {
    let expectedRank = 0;
    for (const page of pages) {
      const words = wordsOfPage(page);
      expect(itemAt(words, 0).verseKey).toBe(itemAt(ALL_KEYS, expectedRank));
      expectedRank = ALL_KEYS.indexOf(itemAt(words, words.length - 1).verseKey) + 1;
    }
    expect(expectedRank).toBe(6236);
  });

  it('first and last verse of each page are those of the structure', () => {
    for (const page of pages) {
      const words = wordsOfPage(page);
      const first = quranStructure.firstVerseOfPage(page.page);
      const last = quranStructure.lastVerseOfPage(page.page);
      expect(itemAt(words, 0).verseKey).toBe(`${first.surah}:${first.verse}`);
      expect(itemAt(words, words.length - 1).verseKey).toBe(`${last.surah}:${last.verse}`);
    }
  });

  it('juz and hizb of each page are those of its first verse', () => {
    for (const page of pages) {
      const first = quranStructure.firstVerseOfPage(page.page);
      expect(page.juz).toBe(quranStructure.juzOfVerse(first));
      expect(page.hizb).toBe(quranStructure.hizbOfVerse(first));
      expect(page.juz).toBe(quranStructure.juzOfPage(page.page));
      expect(page.hizb).toBe(quranStructure.hizbOfPage(page.page));
    }
  });

  it('well-known pages: 1 (juz 1, hizb 1), 22 (juz 2, hizb 3), 582 (juz 30, hizb 59), 604 (juz 30, hizb 60)', () => {
    expect([pageNumbered(1).juz, pageNumbered(1).hizb]).toEqual([1, 1]);
    expect([pageNumbered(22).juz, pageNumbered(22).hizb]).toEqual([2, 3]);
    expect([pageNumbered(582).juz, pageNumbered(582).hizb]).toEqual([30, 59]);
    expect([pageNumbered(604).juz, pageNumbered(604).hizb]).toEqual([30, 60]);
    // Juz 7 (hizb 13) begins in the middle of page 121: the page still belongs to juz 6.
    expect([pageNumbered(121).juz, pageNumbered(121).hizb]).toEqual([6, 12]);
  });
});

describe('Fins de verset', () => {
  it('each of the 6236 verses ends exactly once, on the line that holds its last word', () => {
    const ended: string[] = [];
    const misplaced: string[] = [];
    for (const page of pages) {
      for (const line of textLinesOf(page)) {
        const surah = surahOfKey(itemAt(line.words, 0).verseKey);
        const expectedEnds = line.words.flatMap((word, index) =>
          word.position === wordsOfVerse(word.verseKey).length
            ? [{ afterWordIndex: index, verse: verseOfKey(word.verseKey) }]
            : [],
        );
        if (JSON.stringify(line.verseEnds) !== JSON.stringify(expectedEnds)) {
          misplaced.push(`page ${page.page}, line starting with ${label(itemAt(line.words, 0))}`);
        }
        ended.push(...line.verseEnds.map((end) => `${surah}:${end.verse}`));
      }
    }
    expect(misplaced).toEqual([]);
    expect(ended).toEqual(ALL_KEYS);
  });
});

describe('Ancres indépendantes — lignes de pages connues', () => {
  it('page 1: the seven lines of al-Fatiha as printed', () => {
    const lines = textLinesOf(pageNumbered(1)).map((line) => line.words.map(label));
    expect(pageNumbered(1).lines[0]).toEqual({ kind: 'surah-header', surah: 1 });
    expect(lines).toEqual([
      ['1:1#1', '1:1#2', '1:1#3', '1:1#4'],
      ['1:2#1', '1:2#2', '1:2#3', '1:2#4'],
      ['1:3#1', '1:3#2', '1:4#1', '1:4#2', '1:4#3'],
      ['1:5#1', '1:5#2', '1:5#3', '1:5#4', '1:6#1'],
      ['1:6#2', '1:6#3', '1:7#1', '1:7#2', '1:7#3'],
      ['1:7#4', '1:7#5', '1:7#6', '1:7#7'],
      ['1:7#8', '1:7#9'],
    ]);
  });

  it('page 2: heading, basmala, then 2:1-5 on six lines, the last one holding the last two words', () => {
    const page = pageNumbered(2);
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
    const lines = textLinesOf(page).map((line) => line.words.map(label));
    expect(itemAt(lines, 0)).toEqual([
      '2:1#1',
      '2:2#1',
      '2:2#2',
      '2:2#3',
      '2:2#4',
      '2:2#5',
      '2:2#6',
    ]);
    expect(itemAt(lines, 5)).toEqual(['2:5#7', '2:5#8']);
  });

  it('page 48 is the verse of debt alone: 15 lines of text, all of 2:282', () => {
    const page = pageNumbered(48);
    expect(page.lines.every((line) => line.kind === 'text')).toBe(true);
    expect(new Set(wordsOfPage(page).map((word) => word.verseKey))).toEqual(new Set(['2:282']));
  });

  it('page 42 holds the whole verse of the Throne (2:255)', () => {
    const onPage = wordsOfPage(pageNumbered(42)).filter((word) => word.verseKey === '2:255');
    expect(onPage).toHaveLength(50);
  });

  it('page 50 opens with the heading of Al Imran, page 3 with the first word of 2:6', () => {
    expect(pageNumbered(50).lines[0]).toEqual({ kind: 'surah-header', surah: 3 });
    expect(pageNumbered(50).lines[1]?.kind).toBe('basmala');
    expect(label(itemAt(wordsOfPage(pageNumbered(3)), 0))).toBe('2:6#1');
  });
});
