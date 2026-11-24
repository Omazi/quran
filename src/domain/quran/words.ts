/**
 * Words of a verse are separated by exactly one space (U+0020), in both scripts.
 *
 * Do not split on "any white space": the Uthmani text of 2:72 holds a thin space (U+2009)
 * INSIDE a word, as published by its source. Every module must cut verses with this
 * function so that word positions mean the same thing everywhere.
 */
export const WORD_SEPARATOR = ' ';

/**
 * Never returns an empty word: an empty text, or a text with a leading, trailing or double
 * space, is refused. An empty word would shift the position of every word after it.
 */
export function splitVerseWords(text: string): string[] {
  if (typeof text !== 'string') {
    throw new TypeError(`Invalid verse text: expected a string, got ${typeof text}`);
  }
  const words = text.split(WORD_SEPARATOR);
  if (words.includes('')) {
    throw new RangeError(
      `Invalid verse text: ${JSON.stringify(text)} (empty, or with a leading, trailing or double space)`,
    );
  }
  return words;
}
