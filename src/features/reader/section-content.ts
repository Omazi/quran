/**
 * From a page section to what the scroll draws (docs/specs/reader.md, "Exigence absolue", D41).
 * Each verse is passed on exactly as `QuranRepository` gives it, in the script chosen. The only
 * things the reader adds are the ones the publisher prints and the data leaves to the renderer:
 *
 * - the header of a surah, where its verse 1 begins;
 * - the basmala above verse 1, except for Al-Fatiha (whose verse 1 is the basmala) and At-Tawba
 *   (which has none): it is the text of verse 1:1, in the same script;
 * - the end-of-verse mark after each verse. In the Uthmani script it is the verse number in
 *   Arabic-Indic digits, which the King Fahd font draws as the ornate mark with its number inside
 *   (docs/DATA_SOURCES.md, section 1: the publisher prints it so). The simple script has no such
 *   font: the number goes between the two ornate brackets of Unicode, as imla'i editions print it.
 */

import type { VerseRef } from '@/domain/quran';
import type { ReaderScript } from '@/store';

import { arabicIndicDigits } from './arabic-digits';
import { READER_CONFIG } from './config';
import type { PageSection } from './reading-sections';

export interface SectionVerse extends VerseRef {
  /** The verse, exactly as the repository gives it. */
  readonly text: string;
  /** The end-of-verse mark drawn after it (see above). */
  readonly mark: string;
}

export type SectionBlock =
  | { readonly kind: 'surah-header'; readonly surah: number }
  | { readonly kind: 'basmala'; readonly text: string }
  | { readonly kind: 'verses'; readonly surah: number; readonly verses: readonly SectionVerse[] };

const BASMALA_VERSE: VerseRef = { surah: 1, verse: 1 };
/** Al-Fatiha: its first verse is the basmala. At-Tawba: it opens without one. */
const SURAHS_WITHOUT_BASMALA_LINE: readonly number[] = [1, 9];

/** The mark that ends a verse, in the given script. */
export function verseMark(verse: number, script: ReaderScript): string {
  if (!Number.isInteger(verse) || verse < 1) throw new RangeError(`Invalid verse number: ${verse}`);
  const digits = arabicIndicDigits(verse);
  if (script === 'uthmani') return digits;
  const { open, close } = READER_CONFIG.simpleVerseMark;
  return `${open}${digits}${close}`;
}

function textOrError(textOf: (ref: VerseRef) => string, ref: VerseRef, page: number): string {
  const text = textOf(ref);
  if (text.trim() === '') {
    throw new RangeError(`Page ${page} cannot be shown: verse ${ref.surah}:${ref.verse} is empty.`);
  }
  return text;
}

/**
 * The blocks of a section, in reading order. A verse without text throws a `RangeError`: the
 * screen then shows an integrity error, never a partial text (spec, "Exigence absolue").
 */
export function buildSectionBlocks(
  section: PageSection,
  textOf: (ref: VerseRef) => string,
  script: ReaderScript,
): readonly SectionBlock[] {
  const blocks: SectionBlock[] = [];
  for (const segment of section.segments) {
    if (segment.startsSurah) {
      blocks.push({ kind: 'surah-header', surah: segment.surah });
      if (!SURAHS_WITHOUT_BASMALA_LINE.includes(segment.surah)) {
        blocks.push({ kind: 'basmala', text: textOrError(textOf, BASMALA_VERSE, section.page) });
      }
    }
    const verses: SectionVerse[] = [];
    for (let verse = segment.firstVerse; verse <= segment.lastVerse; verse += 1) {
      const ref = { surah: segment.surah, verse };
      verses.push({
        ...ref,
        text: textOrError(textOf, ref, section.page),
        mark: verseMark(verse, script),
      });
    }
    blocks.push({ kind: 'verses', surah: segment.surah, verses });
  }
  return blocks;
}
