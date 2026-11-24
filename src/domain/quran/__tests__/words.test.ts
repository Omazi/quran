import uthmaniVerses from '../../../../assets/data/verses/uthmani.json';
import { verseText } from '../test-support/quran-test-kit';
import { splitVerseWords, WORD_SEPARATOR } from '../words';

describe('splitVerseWords — words are separated by one space (U+0020)', () => {
  it('cuts a verse into its words', () => {
    expect(splitVerseWords('one two three')).toEqual(['one', 'two', 'three']);
    expect(splitVerseWords('single')).toEqual(['single']);
  });

  it('joining the words with the separator gives the text back', () => {
    const text = verseText(uthmaniVerses, '2:255');
    expect(splitVerseWords(text).join(WORD_SEPARATOR)).toBe(text);
  });

  it('keeps the thin space that the source writes inside a word of 2:72', () => {
    const text = verseText(uthmaniVerses, '2:72');
    const words = splitVerseWords(text);
    expect(words).toHaveLength(10);
    expect(words[3]).toContain('\u2009');
    // Splitting on any white space would wrongly cut this word in two.
    expect(text.split(/\s+/u)).toHaveLength(11);
  });
});
