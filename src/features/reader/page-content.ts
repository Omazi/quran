/**
 * From a page of the data layer to what the reader draws (docs/specs/reader.md, "Exigence
 * absolue" and section 2). Words are passed on exactly as `QuranRepository` gives them, in their
 * order and on their lines. The only things the reader adds are the ones the publisher prints
 * and the data layer leaves to the renderer:
 *
 * - the end-of-verse mark, after the last word of each verse on its line (`MushafLine.verseEnds`).
 *   The publisher's text ends each verse with its number in Arabic-Indic digits, which the data
 *   layer removed from the verse text (docs/DATA_SOURCES.md, section 1); in the bundled font
 *   those digits are drawn as the verse mark with its number inside;
 * - the text of the basmala line, which the layout does not hold: it is the text of verse 1:1,
 *   asked from the same repository.
 */

import { LINES_PER_PAGE, type MushafPage } from '@/domain/quran';

/** Arabic-Indic digits, U+0660 to U+0669, as the publisher's text writes verse numbers. */
const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export type PageItem =
  | { readonly kind: 'word'; readonly text: string; readonly key: string }
  | {
      readonly kind: 'verse-end';
      readonly verse: number;
      readonly text: string;
      readonly key: string;
    };

export type PageLine =
  | { readonly kind: 'surah-header'; readonly surah: number }
  | { readonly kind: 'basmala'; readonly text: string }
  | {
      readonly kind: 'text';
      readonly items: readonly PageItem[];
      /** The line as VoiceOver reads it: its words and verse numbers, separated by spaces. */
      readonly spokenText: string;
    };

/** A verse number as the publisher writes it: 110 is "١١٠". */
export function verseNumberText(verse: number): string {
  if (!Number.isInteger(verse) || verse < 1) throw new RangeError(`Invalid verse number: ${verse}`);
  return String(verse)
    .split('')
    .map((digit) => ARABIC_INDIC_DIGITS.charAt(Number(digit)))
    .join('');
}

function corrupted(page: number, reason: string): RangeError {
  return new RangeError(`Page ${page} cannot be shown: ${reason}`);
}

/**
 * The lines to draw. Data that is not coherent throws a RangeError: the screen then shows an
 * integrity error, never a partial text (spec, "Exigence absolue").
 */
export function buildPageLines(page: MushafPage, basmala: string): readonly PageLine[] {
  if (page.lines.length === 0 || page.lines.length > LINES_PER_PAGE) {
    throw corrupted(page.page, `${page.lines.length} lines`);
  }
  return page.lines.map((line, lineIndex): PageLine => {
    if (line.kind === 'surah-header') return line;
    if (line.kind === 'basmala') {
      if (basmala.trim() === '') throw corrupted(page.page, 'the basmala has no text');
      return { kind: 'basmala', text: basmala };
    }
    if (line.words.length === 0) throw corrupted(page.page, `line ${lineIndex + 1} has no word`);
    const items: PageItem[] = [];
    let nextEnd = 0;
    line.words.forEach((word, wordIndex) => {
      if (word.text === '') throw corrupted(page.page, `an empty word in ${word.verseKey}`);
      items.push({ kind: 'word', text: word.text, key: `${word.verseKey}:${word.position}` });
      const end = line.verseEnds[nextEnd];
      if (end !== undefined && end.afterWordIndex === wordIndex) {
        items.push({
          kind: 'verse-end',
          verse: end.verse,
          text: verseNumberText(end.verse),
          key: `${word.verseKey}:end`,
        });
        nextEnd += 1;
      }
    });
    if (nextEnd !== line.verseEnds.length) {
      throw corrupted(page.page, `a verse end out of place on line ${lineIndex + 1}`);
    }
    return {
      kind: 'text',
      items,
      spokenText: items.map((item) => item.text).join(' '),
    };
  });
}
