import { STRUCTURE } from '../test-support/quran-test-kit';
import { formatVerseKey, parseVerseKey } from '../verse-key';

describe('Verse keys — reading ("18:10")', () => {
  it('reads the surah and the verse of a key', () => {
    expect(parseVerseKey('18:10')).toEqual({ surah: 18, verse: 10 });
    expect(parseVerseKey('1:1')).toEqual({ surah: 1, verse: 1 });
    expect(parseVerseKey('114:6')).toEqual({ surah: 114, verse: 6 });
    expect(parseVerseKey('2:286')).toEqual({ surah: 2, verse: 286 });
  });

  it('writes a reference back as the same key', () => {
    expect(formatVerseKey({ surah: 18, verse: 10 })).toBe('18:10');
    expect(formatVerseKey(parseVerseKey('2:255'))).toBe('2:255');
  });

  it('reads and writes back the key of each of the 6236 verses', () => {
    let count = 0;
    for (const { surah, verseCount } of STRUCTURE.surahs) {
      for (let verse = 1; verse <= verseCount; verse += 1) {
        const key = `${surah}:${verse}`;
        expect(formatVerseKey(STRUCTURE.verseRef(key))).toBe(key);
        count += 1;
      }
    }
    expect(count).toBe(6236);
  });
});

describe('Verse keys — invalid input raises an explicit error', () => {
  const malformedKeys = [
    '',
    '18',
    '18:',
    ':10',
    '18:10:3',
    ' 18:10',
    '18:10 ',
    '18 :10',
    '18-10',
    '18.10',
    '1.5:2',
    '-1:2',
    '1:-2',
    '018:10',
    '18:010',
    '١٨:١٠',
    'al-kahf:10',
  ];

  it.each(malformedKeys)('a malformed key is a TypeError: "%s"', (key) => {
    expect(() => parseVerseKey(key)).toThrow(TypeError);
    expect(() => parseVerseKey(key)).toThrow(/Invalid verse key/);
  });

  it.each([undefined, null, 18, { surah: 18, verse: 10 }])(
    'a key that is not a string is a TypeError: %p',
    (notAString) => {
      // Cast on purpose: keys also come from storage and from other modules at run time.
      expect(() => parseVerseKey(notAString as unknown as string)).toThrow(TypeError);
    },
  );

  it('surah 0 does not exist', () => {
    expect(() => parseVerseKey('0:1')).toThrow(RangeError);
    expect(() => parseVerseKey('0:1')).toThrow('Invalid surah: 0');
  });

  it('surah 115 does not exist', () => {
    expect(() => parseVerseKey('115:1')).toThrow(RangeError);
  });

  it('verse 0 does not exist', () => {
    expect(() => parseVerseKey('1:0')).toThrow(RangeError);
    expect(() => parseVerseKey('1:0')).toThrow('Invalid verse: 0');
  });

  it('a verse number too large to be a whole number is rejected', () => {
    expect(() => parseVerseKey('1:99999999999999999999')).toThrow(RangeError);
  });

  it('parseVerseKey alone does not know how many verses a surah has', () => {
    // Documented limit: the count of verses is data. QuranStructure.verseRef checks it.
    expect(parseVerseKey('1:300')).toEqual({ surah: 1, verse: 300 });
    expect(() => STRUCTURE.verseRef('1:300')).toThrow(RangeError);
  });

  const invalidRefs = [
    { surah: 0, verse: 1 },
    { surah: 115, verse: 1 },
    { surah: 1.5, verse: 1 },
    { surah: Number.NaN, verse: 1 },
    { surah: 1, verse: 0 },
    { surah: 1, verse: -3 },
    { surah: 1, verse: 2.5 },
    { surah: 1, verse: Number.NaN },
    { surah: 1, verse: Number.POSITIVE_INFINITY },
  ];

  it.each(invalidRefs)('formatVerseKey rejects %p', (ref) => {
    expect(() => formatVerseKey(ref)).toThrow(RangeError);
  });
});
