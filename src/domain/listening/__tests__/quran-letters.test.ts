import { IMLAEI_SAMPLE } from '../../recognition/__fixtures__/imlaei-sample';
import { createQuranLetters, lettersOf } from '../quran-letters';

const verseText = ({ surah, verse }: { surah: number; verse: number }) =>
  IMLAEI_SAMPLE.find((v) => v.surah === surah && v.verse === verse)?.text;
const verseCount = (surah: number) => IMLAEI_SAMPLE.filter((v) => v.surah === surah).length;
const SURAHS = [...new Set(IMLAEI_SAMPLE.map((v) => v.surah))];
const letters = createQuranLetters(verseText, verseCount, SURAHS);

describe('lettersOf', () => {
  it('keeps the letters only, as quran-decoding compares them', () => {
    // Vowel marks and spaces dropped; every alef and hamza one letter; ى as ي, ة as ه.
    expect(lettersOf('إِنَّا أَعْطَيْنَاكَ')).toBe('انااعطيناك');
    expect(lettersOf('آمَنُوا مُؤْمِنٌ شَيْءٌ')).toBe('امنوامامنشيا');
    expect(lettersOf('عَلَى الصَّلَاةِ')).toBe('علي' + 'الصلاه');
    expect(lettersOf('abc ١٢ ـ')).toBe('');
  });
});

describe('createQuranLetters', () => {
  it('finds every place where letters are said, across verses', () => {
    expect(letters.placesOf(lettersOf('قُلْ هُوَ اللَّهُ أَحَدٌ اللَّهُ الصَّمَدُ'))).toEqual([
      { first: { surah: 112, verse: 1 }, last: { surah: 112, verse: 2 } },
    ]);
    // Said in 1:1 and as the whole of 1:3.
    expect(letters.placesOf(lettersOf('الرَّحْمَٰنِ الرَّحِيمِ'))).toEqual([
      { first: { surah: 1, verse: 1 }, last: { surah: 1, verse: 1 } },
      { first: { surah: 1, verse: 3 }, last: { surah: 1, verse: 3 } },
    ]);
  });

  it('counts a refrain in every place it is said, up to a limit', () => {
    const refrain = lettersOf('فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ');
    expect(letters.placesOf(refrain).length).toBeGreaterThan(5);
    expect(letters.placesOf(refrain, 3)).toHaveLength(3);
  });

  it('never runs a stretch across two surahs', () => {
    // The end of 113 then the start of 114.
    const across = lettersOf('وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ قُلْ أَعُوذُ');
    expect(letters.placesOf(across)).toEqual([]);
  });

  it('finds nothing for letters said nowhere, or no letters at all', () => {
    expect(letters.placesOf(lettersOf('كتب سيارة حاسوب'))).toEqual([]);
    expect(letters.placesOf('')).toEqual([]);
  });
});
