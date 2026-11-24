import type { QuranStructure } from './structure';
import type { MushafLine, MushafPage, MushafWord, VerseRef } from './types';
import { formatVerseKey } from './verse-key';

/** Consecutive words of one verse on a line: words `firstWord..lastWord` (1-based) of `verse`. */
export type WordSegment = readonly [verse: number, firstWord: number, lastWord: number];

/**
 * One line of a page as stored in `assets/data/pages`: a surah header, a basmala, or the
 * words of the line. The stored layout holds positions only; the text comes from the verses.
 */
export type PageLineLayout =
  | { readonly header: number }
  | { readonly basmala: number }
  | { readonly surah: number; readonly words: readonly WordSegment[] };

export interface PageLayout {
  readonly page: number;
  readonly lines: readonly PageLineLayout[];
}

type TextLine = Extract<MushafLine, { kind: 'text' }>;

function buildTextLine(
  page: number,
  surah: number,
  segments: readonly WordSegment[],
  structure: QuranStructure,
  wordsOfVerse: (ref: VerseRef) => readonly string[],
): TextLine {
  const words: MushafWord[] = [];
  const verseEnds: { afterWordIndex: number; verse: number }[] = [];

  for (const [verse, firstWord, lastWord] of segments) {
    const ref: VerseRef = { surah, verse };
    structure.assertVerse(ref);
    const verseKey = formatVerseKey(ref);
    const verseWords = wordsOfVerse(ref);
    if (firstWord < 1 || lastWord < firstWord || lastWord > verseWords.length) {
      throw new RangeError(
        `Invalid layout of page ${page}: words ${firstWord}..${lastWord} of ${verseKey} ` +
          `(the verse has ${verseWords.length} words)`,
      );
    }
    verseWords.slice(firstWord - 1, lastWord).forEach((text, offset) => {
      words.push({ verseKey, position: firstWord + offset, text });
    });
    // The end-of-verse mark is always printed on the line of the last word of the verse.
    if (lastWord === verseWords.length) verseEnds.push({ afterWordIndex: words.length - 1, verse });
  }
  return { kind: 'text', words, verseEnds };
}

/**
 * Turns the stored layout of a page into the page the reader displays.
 * `wordsOfVerse` gives the words of a verse in the script to display.
 */
export function buildMushafPage(
  layout: PageLayout,
  structure: QuranStructure,
  wordsOfVerse: (ref: VerseRef) => readonly string[],
): MushafPage {
  const lines = layout.lines.map((line): MushafLine => {
    if ('header' in line)
      return { kind: 'surah-header', surah: structure.surah(line.header).surah };
    if ('basmala' in line) return { kind: 'basmala' };
    return buildTextLine(layout.page, line.surah, line.words, structure, wordsOfVerse);
  });
  return {
    page: layout.page,
    juz: structure.juzOfPage(layout.page),
    hizb: structure.hizbOfPage(layout.page),
    lines,
  };
}
