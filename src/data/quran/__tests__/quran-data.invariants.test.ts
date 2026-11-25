import {
  canonicalQuranText,
  splitVerseWords,
  type MushafLine,
  type MushafPage,
  type MushafWord,
  type Verse,
} from '@/domain/quran';

import integrity from '../../../../assets/data/integrity.json';
import { sha256Hex } from './acceptance/acceptance-kit';
import { quranRepository, quranStructure } from '../index';

/**
 * The invariants of docs/specs/quran.md, checked on the generated data as the app reads it:
 * through the repository, page after page, for the whole mushaf.
 */

type TextLine = Extract<MushafLine, { kind: 'text' }>;

const QUARTER_MARK = '\u06DE';
const SAJDA_MARK = '\u06E9';

/** The 15 verses marked with a sajda sign in the Medina mushaf. */
const SAJDA_VERSES = [
  '7:206',
  '13:15',
  '16:50',
  '17:109',
  '19:58',
  '22:18',
  '22:77',
  '25:60',
  '27:26',
  '32:15',
  '38:24',
  '41:38',
  '53:62',
  '84:21',
  '96:19',
];

/**
 * The three places where the publisher of the Uthmani text writes two words without a
 * space: the word is kept as published and counts as one word. `words` is the number of
 * words of the verse in the Uthmani text; the Uthmani-minimal text has one more.
 */
const JOINED_WORDS = [
  { key: '15:7', position: 1, words: 7 },
  { key: '27:20', position: 4, words: 11 },
  { key: '36:22', position: 1, words: 7 },
] as const;

const pages: MushafPage[] = [];
const uthmani: Verse[] = [];
const uthmaniMinimal: Verse[] = [];
const imlaei: Verse[] = [];
/** Every word of the 604 pages, in reading order. */
const pageWords: MushafWord[] = [];
let textLines: TextLine[] = [];

beforeAll(async () => {
  for (let page = 1; page <= 604; page += 1) pages.push(await quranRepository.getPage(page));
  for (let surah = 1; surah <= 114; surah += 1) {
    uthmani.push(...(await quranRepository.getSurahVerses(surah)));
    uthmaniMinimal.push(...(await quranRepository.getSurahVerses(surah, 'uthmani-minimal')));
    imlaei.push(...(await quranRepository.getSurahVerses(surah, 'imlaei')));
  }
  const allLines = pages.flatMap((page) => page.lines);
  textLines = allLines.filter((line): line is TextLine => line.kind === 'text');
  pageWords.push(...textLines.flatMap((line) => line.words));
});

describe('Invariant — 114 surahs, 6236 verses, 604 pages, 30 juz, 60 hizb', () => {
  it('the repository gives 6236 verses in 114 surahs, in both texts', () => {
    expect(uthmani).toHaveLength(6236);
    expect(uthmaniMinimal).toHaveLength(6236);
    expect(new Set(uthmani.map((verse) => verse.surah)).size).toBe(114);
    expect(uthmaniMinimal.map((verse) => verse.key)).toEqual(uthmani.map((verse) => verse.key));
  });

  it('the repository gives 604 pages, numbered 1 to 604', () => {
    expect(pages.map((page) => page.page)).toEqual(Array.from({ length: 604 }, (_, i) => i + 1));
  });

  it('the pages go through the 30 juz and the 60 hizb, in order', () => {
    expect(new Set(pages.map((page) => page.juz))).toEqual(
      new Set(Array.from({ length: 30 }, (_, i) => i + 1)),
    );
    expect(new Set(pages.map((page) => page.hizb))).toEqual(
      new Set(Array.from({ length: 60 }, (_, i) => i + 1)),
    );
    pages.forEach((page, index) => {
      const previous = pages[index - 1];
      if (previous === undefined) return;
      expect(page.hizb - previous.hizb === 0 || page.hizb - previous.hizb === 1).toBe(true);
      expect(page.juz).toBe(Math.ceil(page.hizb / 2));
    });
  });

  it('each page carries the juz and the hizb of its first verse', () => {
    for (const page of pages) {
      expect(page.juz).toBe(quranStructure.juzOfPage(page.page));
      expect(page.hizb).toBe(quranStructure.hizbOfPage(page.page));
    }
  });
});

describe('Invariant — every page has at most 15 lines; pages 1 and 2 are a known special case', () => {
  it('no page has more than 15 lines', () => {
    expect(Math.max(...pages.map((page) => page.lines.length))).toBe(15);
  });

  it('pages 1 and 2 have 8 lines', () => {
    expect(pages[0]?.lines).toHaveLength(8);
    expect(pages[1]?.lines).toHaveLength(8);
  });

  it('every other page has exactly 15 lines', () => {
    const others = pages.slice(2).filter((page) => page.lines.length !== 15);
    expect(others.map((page) => page.page)).toEqual([]);
  });

  it('the mushaf has 9046 lines in all, as recorded in integrity.json', () => {
    const lineCount = pages.reduce((total, page) => total + page.lines.length, 0);
    expect(lineCount).toBe(8 + 8 + 602 * 15);
    expect(lineCount).toBe(integrity.counts.lines);
  });

  it('no text line is empty', () => {
    expect(textLines.every((line) => line.words.length > 0)).toBe(true);
  });
});

describe('Invariant — every word of every verse appears exactly once in the pages, in order', () => {
  it('the words of the pages are the words of the verses, one after the other', () => {
    const expected = uthmani.flatMap((verse) =>
      splitVerseWords(verse.text).map((_, index) => `${verse.key}#${index + 1}`),
    );
    const found = pageWords.map((word) => `${word.verseKey}#${word.position}`);

    expect(found).toHaveLength(expected.length);
    expect(found).toEqual(expected);
  });

  it('no word is placed twice', () => {
    const places = pageWords.map((word) => `${word.verseKey}#${word.position}`);
    expect(new Set(places).size).toBe(places.length);
  });

  it('the pages hold the 77430 words of the Uthmani text', () => {
    expect(pageWords).toHaveLength(77430);
    expect(pageWords).toHaveLength(integrity.counts.uthmaniWords);
  });

  it('a page never starts in the middle of a verse', () => {
    for (const page of pages) {
      const firstLine = page.lines.find((line): line is TextLine => line.kind === 'text');
      const firstWord = firstLine?.words[0];
      const firstVerse = quranStructure.firstVerseOfPage(page.page);
      expect(firstWord?.position).toBe(1);
      expect(firstWord?.verseKey).toBe(`${firstVerse.surah}:${firstVerse.verse}`);
    }
  });

  it('a line never mixes two surahs', () => {
    for (const line of textLines) {
      const surahs = new Set(line.words.map((word) => word.verseKey.split(':')[0]));
      expect(surahs.size).toBe(1);
    }
  });
});

describe('Invariant — the words of a verse joined from the pages are identical to the text of the verse', () => {
  it('holds for each of the 6236 verses', () => {
    const wordsByVerse = new Map<string, string[]>();
    for (const word of pageWords) {
      const words = wordsByVerse.get(word.verseKey) ?? [];
      words.push(word.text);
      wordsByVerse.set(word.verseKey, words);
    }

    expect(wordsByVerse.size).toBe(6236);
    const different = uthmani.filter(
      (verse) => wordsByVerse.get(verse.key)?.join(' ') !== verse.text,
    );
    expect(different.map((verse) => verse.key)).toEqual([]);
  });

  it('no word of a page is empty or holds a space', () => {
    expect(pageWords.every((word) => word.text !== '' && !word.text.includes(' '))).toBe(true);
  });
});

describe('End-of-verse marks', () => {
  it('each verse has exactly one end mark, right after its last word', () => {
    const wordCount = new Map<string, number>(
      uthmani.map((verse) => [verse.key, splitVerseWords(verse.text).length]),
    );
    const marked: string[] = [];

    for (const line of textLines) {
      for (const end of line.verseEnds) {
        const lastWord = line.words[end.afterWordIndex];
        expect(lastWord).toBeDefined();
        expect(lastWord?.verseKey.split(':')[1]).toBe(String(end.verse));
        expect(lastWord?.position).toBe(wordCount.get(lastWord?.verseKey ?? ''));
        marked.push(lastWord?.verseKey ?? '');
      }
    }

    expect(marked).toEqual(uthmani.map((verse) => verse.key));
  });
});

describe('Surah headers and basmala lines', () => {
  const lineKinds = () => pages.flatMap((page) => page.lines);

  it('there are 114 headers, in order, each right before its surah', () => {
    const lines = lineKinds();
    const headers = lines.filter((line) => line.kind === 'surah-header');
    expect(headers.map((line) => line.surah)).toEqual(Array.from({ length: 114 }, (_, i) => i + 1));

    lines.forEach((line, index) => {
      if (line.kind !== 'surah-header') return;
      const next = lines.slice(index + 1).find((following) => following.kind === 'text');
      expect(next?.words[0]).toMatchObject({ verseKey: `${line.surah}:1`, position: 1 });
    });
  });

  it('a basmala line follows every header except those of surahs 1 and 9', () => {
    const lines = lineKinds();
    const withBasmala: number[] = [];
    lines.forEach((line, index) => {
      if (line.kind !== 'basmala') return;
      const header = lines[index - 1];
      expect(header?.kind).toBe('surah-header');
      if (header?.kind === 'surah-header') withBasmala.push(header.surah);
    });

    const expected = Array.from({ length: 114 }, (_, i) => i + 1).filter(
      (surah) => surah !== 1 && surah !== 9,
    );
    expect(withBasmala).toEqual(expected);
  });

  it('a page never ends with a header or a basmala', () => {
    expect(pages.every((page) => page.lines.at(-1)?.kind === 'text')).toBe(true);
  });
});

describe('Known alignment cases — resolved explicitly, never by a fallback', () => {
  it('sajda: the sign stays glued to the last word of its 15 verses, it is not a word', () => {
    const withSign = uthmani.filter((verse) => verse.text.includes(SAJDA_MARK));
    expect(withSign.map((verse) => verse.key)).toEqual(SAJDA_VERSES);

    for (const verse of withSign) {
      const words = pageWords.filter((word) => word.verseKey === verse.key);
      expect(words.at(-1)?.text.endsWith(SAJDA_MARK)).toBe(true);
      expect(words.at(-1)?.text).not.toBe(SAJDA_MARK);
      expect(words.filter((word) => word.text.includes(SAJDA_MARK))).toHaveLength(1);
    }
  });

  it('quarter of hizb: the sign stays glued to the first word of its 199 verses', () => {
    const withSign = uthmani.filter((verse) => verse.text.includes(QUARTER_MARK));
    expect(withSign).toHaveLength(199);
    expect(withSign.every((verse) => verse.text.startsWith(QUARTER_MARK))).toBe(true);
    expect(pageWords.some((word) => word.text === QUARTER_MARK)).toBe(false);
  });

  it.each(JOINED_WORDS)(
    'joined word: word $position of $key is one word, as its publisher writes it',
    ({ key, position, words }) => {
      const uthmaniVerse = uthmani.find((verse) => verse.key === key);
      const minimalVerse = uthmaniMinimal.find((verse) => verse.key === key);
      const onPages = pageWords.filter((word) => word.verseKey === key);

      expect(splitVerseWords(uthmaniVerse?.text ?? '')).toHaveLength(words);
      expect(splitVerseWords(minimalVerse?.text ?? '')).toHaveLength(words + 1);
      expect(onPages).toHaveLength(words);
      expect(onPages[position - 1]?.text).toBe(
        splitVerseWords(uthmaniVerse?.text ?? '')[position - 1],
      );
    },
  );

  it('the three joined words are the only difference in word count between the two texts', () => {
    const different = uthmani.filter((verse, index) => {
      const other = uthmaniMinimal[index];
      return splitVerseWords(verse.text).length !== splitVerseWords(other?.text ?? '').length;
    });
    expect(different.map((verse) => verse.key)).toEqual(JOINED_WORDS.map((joined) => joined.key));
  });

  it('white space: no verse of either text holds anything but ordinary spaces between words', () => {
    const otherWhiteSpace = /[^\S ]/u;
    expect(
      uthmani.filter((verse) => otherWhiteSpace.test(verse.text)).map((verse) => verse.key),
    ).toEqual([]);
    expect(uthmaniMinimal.filter((verse) => otherWhiteSpace.test(verse.text))).toEqual([]);
    expect(pageWords.filter((word) => word.verseKey === '2:72')).toHaveLength(10);
  });

  it('the Uthmani text holds no verse number and no no-break space left from its source', () => {
    const leftover = /[\u00A0\u0660-\u0669]/u;
    expect(uthmani.filter((verse) => leftover.test(verse.text)).map((verse) => verse.key)).toEqual(
      [],
    );
  });
});

describe('Uthmani-minimal — the second text', () => {
  it('has the 77433 words recorded in integrity.json', () => {
    const wordCount = uthmaniMinimal.reduce(
      (total, verse) => total + splitVerseWords(verse.text).length,
      0,
    );
    expect(wordCount).toBe(77433);
    expect(wordCount).toBe(integrity.counts.uthmaniMinimalWords);
  });

  it('separates its words with single spaces and has no empty verse', () => {
    for (const verse of uthmaniMinimal) {
      expect(verse.text).not.toBe('');
      expect(splitVerseWords(verse.text).includes('')).toBe(false);
    }
  });

  it('carries no sajda or quarter sign in its text', () => {
    expect(uthmaniMinimal.some((verse) => verse.text.includes(SAJDA_MARK))).toBe(false);
    expect(uthmaniMinimal.some((verse) => verse.text.includes(QUARTER_MARK))).toBe(false);
  });
});

/**
 * The third text, for the "Simple" script of the reader (D41): the King Fahd Complex's own
 * imla'i column, unchanged. Its fingerprint is recorded in integrity.json and checked here on the
 * text as the app reads it, like the Uthmani text's.
 */
describe("Imla'i — the simple script", () => {
  const ARABIC_VOWEL_MARKS = /[\u064B-\u0652\u0670]/u;

  it('has the 6236 verses, with the keys of the Uthmani text', () => {
    expect(imlaei).toHaveLength(6236);
    expect(imlaei.map((verse) => verse.key)).toEqual(uthmani.map((verse) => verse.key));
  });

  it('is the text recorded in integrity.json, character for character', () => {
    const bySurah: Record<string, string[]> = {};
    for (const verse of imlaei) (bySurah[String(verse.surah)] ??= []).push(verse.text);
    const fingerprint = sha256Hex(canonicalQuranText(bySurah));
    expect(fingerprint).toBe(integrity.canonicalText.imlaeiSha256);
    expect(fingerprint).toBe('177f2aeabdbde65193126fc402af2700cc81df7288eae9869e469a31dc493d6a');
  });

  it('has the words recorded in integrity.json, separated by single spaces', () => {
    const words = imlaei.reduce((total, verse) => total + splitVerseWords(verse.text).length, 0);
    expect(words).toBe(integrity.counts.imlaeiWords);
    for (const verse of imlaei) {
      expect(verse.text).not.toBe('');
      expect(splitVerseWords(verse.text)).not.toContain('');
    }
  });

  it('is the everyday spelling, without vowel marks, as the Complex publishes it', () => {
    expect(imlaei.find((verse) => verse.key === '1:2')?.text).toBe('الحمد لله رب العالمين');
    expect(imlaei.some((verse) => ARABIC_VOWEL_MARKS.test(verse.text))).toBe(false);
  });
});
