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

  it.each(['', ' ', '  ', 'a  b', ' a b', 'a b '])(
    'never returns an empty word: %p is refused',
    (malformed) => {
      expect(() => splitVerseWords(malformed)).toThrow(RangeError);
      expect(() => splitVerseWords(malformed)).toThrow(/Invalid verse text/);
    },
  );

  it('a text that is not a string is refused', () => {
    // Cast on purpose: verses also come from files at run time.
    expect(() => splitVerseWords(undefined as unknown as string)).toThrow(TypeError);
  });

  it('cuts on the ordinary space only: any other white space stays inside its word', () => {
    // Made-up text. An earlier source wrote a thin space (U+2009) inside a word of 2:72.
    expect(splitVerseWords('a\u2009b c')).toEqual(['a\u2009b', 'c']);
    expect(splitVerseWords('a\u00A0b')).toEqual(['a\u00A0b']);
  });

  it('2:72 has its ten words', () => {
    expect(splitVerseWords(verseText(uthmaniVerses, '2:72'))).toHaveLength(10);
  });
});
