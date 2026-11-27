/**
 * The Quran as a string of letters (docs/DECISIONS.md, D50): the letters `quran-decoding`
 * compares (vowel marks, spaces and hamza seats dropped), in the imla'i spelling Whisper writes.
 *
 * For the audio check (`audio-check.ts`): `placesOf` gives every place where some letters are
 * said, exactly. A held reading's text is a stretch of the passage it was held to; when those
 * letters are said nowhere else in the Quran, the reading names that passage alone, even when
 * it is too short for the word search (fewer than three words).
 *
 * Pure: the verse texts come from the caller.
 */
import type { VerseRef } from '../quran/types';

/** The compared letter for a character, or '' (quran-decoding.cpp, `letter_code`). */
function letterOf(char: string): string {
  const cp = char.codePointAt(0)!;
  switch (cp) {
    case 0x0621:
    case 0x0622:
    case 0x0623:
    case 0x0624:
    case 0x0625:
    case 0x0626:
    case 0x0627:
    case 0x0671:
    case 0x0672:
    case 0x0673:
    case 0x0675:
      return 'ا';
    case 0x0649:
    case 0x06cc:
    case 0x06d2:
      return 'ي';
    case 0x0629:
    case 0x06c1:
    case 0x06be:
    case 0x06d5:
      return 'ه';
    case 0x06a9:
      return 'ك';
    case 0x0640:
      return '';
    default:
      return cp >= 0x0628 && cp <= 0x064a ? char : '';
  }
}

/** The letters of a text, as `quran-decoding` compares them: every alef and hamza one letter. */
export function lettersOf(text: string): string {
  let out = '';
  for (const char of text) out += letterOf(char);
  return out;
}

export interface LetterPlace {
  readonly first: VerseRef;
  readonly last: VerseRef;
}

export interface QuranLetters {
  /** Every place where `letters` are said (at most `max`, default 50), in mushaf order. */
  placesOf(letters: string, max?: number): LetterPlace[];
}

/** Separates two surahs in the string: never a letter, so no stretch runs across. */
const SURAH_END = '|';

const ALL_SURAHS = Array.from({ length: 114 }, (_, i) => i + 1);

/**
 * The letters of the surahs listed (all 114 by default). `verseText` gives a verse's text, or
 * undefined past the end of a surah; `verseCount` the number of verses of a surah.
 */
export function createQuranLetters(
  verseText: (ref: VerseRef) => string | undefined,
  verseCount: (surah: number) => number,
  surahs: readonly number[] = ALL_SURAHS,
): QuranLetters {
  const refs: VerseRef[] = [];
  const parts: string[] = [];
  const owners: number[] = [];
  for (const surah of surahs) {
    for (let verse = 1; verse <= verseCount(surah); verse += 1) {
      const text = verseText({ surah, verse });
      if (text === undefined) break;
      const letters = lettersOf(text);
      refs.push({ surah, verse });
      parts.push(letters);
      for (let i = 0; i < letters.length; i += 1) owners.push(refs.length - 1);
    }
    parts.push(SURAH_END);
    owners.push(-1);
  }
  const quran = parts.join('');
  const ownerAt = Int32Array.from(owners);

  function placesOf(letters: string, max = 50): LetterPlace[] {
    const places: LetterPlace[] = [];
    if (letters.length === 0) return places;
    let at = quran.indexOf(letters);
    while (at >= 0 && places.length < max) {
      // Letters never hold SURAH_END: a place is always inside one surah.
      places.push({
        first: refs[ownerAt[at]!]!,
        last: refs[ownerAt[at + letters.length - 1]!]!,
      });
      at = quran.indexOf(letters, at + 1);
    }
    return places;
  }

  return { placesOf };
}
