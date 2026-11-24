/**
 * Words of a verse are separated by exactly one space (U+0020), in both scripts.
 *
 * Do not split on "any white space": the Uthmani text of 2:72 holds a thin space (U+2009)
 * INSIDE a word, as published by its source. Every module must cut verses with this
 * function so that word positions mean the same thing everywhere.
 */
export const WORD_SEPARATOR = ' ';

export function splitVerseWords(text: string): string[] {
  return text.split(WORD_SEPARATOR);
}
