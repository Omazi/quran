import { countLetters } from '../letters';

/**
 * The letter rule of docs/specs/stats.md, on words taken from the Uthmani text of the app.
 * Counted by hand: one letter per written letter, none for marks.
 */
describe('countLetters — the letter rule', () => {
  it.each([
    ['a plain word: three consonants', 'بِسۡمِ', 3],
    ['alif wasla counts as an alif', 'ٱلنَّاسُ', 5],
    ['a shadda is not a letter: the doubled letter is written once', 'رَبِّ', 2],
    ['a shadda on the second lam of Allah', 'ٱللَّهِ', 4],
    ['the alif suscrit (dagger alif) is not a letter', 'ذَٰلِكَ', 3],
    ['the dagger alif of al-Rahman is not a letter either', 'ٱلرَّحۡمَٰنِ', 6],
    ['the small waw is not a letter', 'لَهُۥ', 2],
    ['the small ya is not a letter', 'بِهِۦ', 2],
    ['the small waw and the madda on the same word', 'لِأَمۡرِهِۦٓ', 5],
    ['hamza carried by waw is one letter', 'يُؤۡمِنُونَ', 6],
    ['hamza carried by ya is one letter', 'أُوْلَٰٓئِكَ', 5],
    ['hamza on alif (above) and hamza under alif are letters', 'إِنَّ', 2],
    ['hamza above alif', 'أَمۡ', 2],
    ['hamza alone on the line is a letter', 'سَوَآءٌ', 4],
    ['hamza alone followed by alif madda', 'ءَامَنَّا', 5],
    ['a madda sign on an alif is not a second letter', 'ٱلۡأٓخِرَةِ', 6],
    ['a hamza sign written on a ya is part of the ya', 'تِلۡقَآيِٕ', 5],
    ['a hamza sign written on a tatweel is the hamza letter', 'يَـُٔودُهُۥ', 5],
    ['a hamza on a tatweel after a dagger alif and madda', 'يَٰٓـَٔادَمُ', 5],
    ['ta marbuta is a letter', 'رَحۡمَةٗ', 4],
    ['ta marbuta in the middle of a longer word', 'ٱلصَّلَوٰةَ', 6],
    ['alif maqsura is a letter', 'عَلَىٰ', 3],
    ['alif maqsura with a tanwin', 'هُدٗى', 3],
    ['a tanwin is not a letter', 'رَشَدٗا', 4],
    ['the three tanwin signs are not letters', 'نَارٞ', 3],
    ['a pause sign is not a letter', 'رَيۡبَۛ', 3],
    ['another pause sign is not a letter', 'وَنِسَآءٗۚ', 5],
    ['the hizb sign stuck to a word is not a letter', '۞ٱللَّهُ', 4],
    ['a sukun is not a letter', 'ءَأَنذَرۡتَهُمۡ', 8],
    ['the small meem of iqlab is not a letter', 'أَلِيمُۢ', 4],
  ])('%s: %s', (_rule, word, expected) => {
    expect(countLetters(word)).toBe(expected);
  });

  it('counts each of the 28 letters of the alphabet once', () => {
    const alphabet = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي';
    expect([...alphabet]).toHaveLength(28);
    expect(countLetters(alphabet)).toBe(28);
  });

  it('counts every written form of the alif, the hamza and the ya', () => {
    expect(countLetters('ا')).toBe(1);
    expect(countLetters('ٱ')).toBe(1);
    expect(countLetters('آ')).toBe(1);
    expect(countLetters('أ')).toBe(1);
    expect(countLetters('إ')).toBe(1);
    expect(countLetters('ء')).toBe(1);
    expect(countLetters('ؤ')).toBe(1);
    expect(countLetters('ئ')).toBe(1);
    expect(countLetters('ة')).toBe(1);
    expect(countLetters('ى')).toBe(1);
  });

  it('counts a tatweel as nothing', () => {
    expect(countLetters('ـ')).toBe(0);
    expect(countLetters('بـ')).toBe(1);
  });

  it('counts a word made of marks only as zero', () => {
    expect(countLetters('ۛ')).toBe(0);
    expect(countLetters('۞')).toBe(0);
  });

  it('counts a hamza sign on a letter other than a tatweel as part of that letter, in either order of marks', () => {
    // Decomposed forms of the same letters as the precomposed أ and ئ.
    expect(countLetters('أ')).toBe(countLetters('أ'));
    expect(countLetters('يٕ')).toBe(1);
    expect(countLetters('ـَٔ')).toBe(1);
  });

  it('counts one hamza only for a tatweel, whatever else it carries', () => {
    expect(countLetters('ـُٔ')).toBe(1);
    expect(countLetters('ـُ')).toBe(0);
    expect(countLetters('ـۧ')).toBe(0);
  });

  describe('invalid input', () => {
    it.each([
      ['an empty word', ''],
      ['a word with a space inside', 'بِسۡمِ ٱللَّهِ'],
      ['a Latin letter', 'abc'],
      ['a digit', '١٢'],
      ['a Persian letter that is not in the Quran', 'ک'],
      ['a thin space inside a word', 'ب ت'],
    ])('rejects %s with a RangeError', (_name, word) => {
      expect(() => countLetters(word)).toThrow(RangeError);
    });

    it.each([
      ['undefined', undefined],
      ['a number', 5],
      ['null', null],
    ])('rejects %s with a TypeError', (_name, value) => {
      expect(() => countLetters(value as unknown as string)).toThrow(TypeError);
    });
  });
});
