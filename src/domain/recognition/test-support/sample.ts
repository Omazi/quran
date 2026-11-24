/**
 * Shortcuts over the sample verses of `__fixtures__`. Not part of the module.
 */
import { IMLAEI_SAMPLE } from '../__fixtures__/imlaei-sample';
import { UTHMANI_SAMPLE } from '../__fixtures__/uthmani-sample';
import type { PassageCandidate, VerseText, WordRef } from '../types';

function versesOf(
  sample: readonly VerseText[],
  surah: number,
  from: number,
  to: number,
): VerseText[] {
  const verses = sample.filter((v) => v.surah === surah && v.verse >= from && v.verse <= to);
  if (verses.length !== to - from + 1) {
    throw new RangeError(`The sample does not hold ${surah}:${from}-${to}`);
  }
  return verses;
}

/** Uthmani words, as displayed, of verses `from`..`to` of a surah of the sample. */
export function uthmaniWords(surah: number, from: number, to: number = from): string[] {
  return versesOf(UTHMANI_SAMPLE, surah, from, to).flatMap((verse) => verse.text.split(' '));
}

/** Imla'i text (Tanzil Simple, with vowel marks) of verses `from`..`to`, as one string. */
export function imlaeiText(surah: number, from: number, to: number = from): string {
  return versesOf(IMLAEI_SAMPLE, surah, from, to)
    .map((verse) => verse.text)
    .join(' ');
}

/**
 * The text without any vowel mark or small sign, as a speech engine that writes plain
 * modern Arabic would give it (الرحمن, هذا: no small alef either).
 */
export function withoutMarks(text: string): string {
  return [...text]
    .filter((character) => {
      const code = character.charCodeAt(0);
      const isMark = (code >= 0x064b && code <= 0x065f) || code === 0x0670;
      const isQuranicSign = code >= 0x06d6 && code <= 0x06ed;
      return !isMark && !isQuranicSign;
    })
    .join('');
}

export function wordRef(surah: number, verse: number, word: number): WordRef {
  return { surah, verse, word };
}

/** "55:13.1-55:13.4": compact form of a candidate, for readable expectations. */
export function span(candidate: PassageCandidate): string {
  const { start, end } = candidate;
  return `${start.surah}:${start.verse}.${start.word}-${end.surah}:${end.verse}.${end.word}`;
}
