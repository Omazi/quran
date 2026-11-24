import { IMLAEI_SAMPLE } from '../__fixtures__/imlaei-sample';
import { UTHMANI_SAMPLE } from '../__fixtures__/uthmani-sample';
import { normalizeArabic, toAccentKey } from '../index';
import { withoutMarks } from '../test-support/sample';

/** The single normalised word of a text that holds one word. */
function word(text: string): string {
  const words = normalizeArabic(text);
  expect(words).toHaveLength(1);
  return words[0] ?? '';
}

const TATWEEL = String.fromCharCode(0x0640);
const HAMZA_ABOVE = String.fromCharCode(0x0654);
const HAMZA_BELOW = String.fromCharCode(0x0655);
const ZERO_WIDTH_JOINER = String.fromCharCode(0x200d);
const THIN_SPACE = String.fromCharCode(0x2009);

describe('Rule 1 — normalizeArabic returns comparable words', () => {
  it("gives the same words for a verse in Uthmani, in imla'i and without any mark", () => {
    const uthmani = 'ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ';
    const imlaei = 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ';
    const plain = 'الحمد لله رب العالمين';

    expect(normalizeArabic(uthmani)).toEqual(['ءلحمد', 'لله', 'رب', 'ءلعلمين']);
    expect(normalizeArabic(imlaei)).toEqual(normalizeArabic(uthmani));
    expect(normalizeArabic(plain)).toEqual(normalizeArabic(uthmani));
  });

  it('is idempotent: normalising normalised words changes nothing', () => {
    for (const verse of [...UTHMANI_SAMPLE, ...IMLAEI_SAMPLE]) {
      const once = normalizeArabic(verse.text);
      expect(normalizeArabic(once.join(' '))).toEqual(once);
    }
  });
});

describe('Rule 1.1 — removes vowel marks, Quranic annotation marks and the tatweel', () => {
  it('removes short vowels, shadda, sukun and tanwin', () => {
    expect(word('مُّحَمَّدٌ')).toBe('محمد');
    expect(word('كِتَابًا')).toBe('كتبا');
  });

  it('removes pause marks attached to a word', () => {
    expect(normalizeArabic('رَيۡبَۛ فِيهِۛ')).toEqual(['ريب', 'فيه']);
  });

  it('drops a pause mark or an ornament standing alone: it is not a word', () => {
    expect(normalizeArabic('رَبِّهِمْ ۖ وَأُولَٰئِكَ')).toEqual(['ربهم', 'وءولءك']);
    expect(normalizeArabic('۞ وَإِذَا')).toEqual(['وءذا']);
  });

  it('removes the tatweel, wherever it is', () => {
    expect(word(`الحـ${TATWEEL}${TATWEEL}ـمد`)).toBe('ءلحمد');
    expect(normalizeArabic(TATWEEL)).toEqual([]);
  });
});

describe('Rule 1.2 — unifies the forms of alef and hamza, ya / alef maqsura, ta marbuta', () => {
  it('writes every hamza the same way, whatever carries it', () => {
    expect(word('أَنْعَمْتَ')).toBe('ءنعمت');
    expect(word('إِنَّ')).toBe('ءن');
    expect(word('مُؤْمِنُونَ')).toBe('مءمنون');
    expect(word('شَيْئًا')).toBe('شيءا');
    expect(word('مَاءٍ')).toBe('مء');
  });

  it('reads the alef that starts a word as a hamza, so a transcript may omit the hamza', () => {
    expect(word('ان')).toBe(word('أَنْ'));
    expect(word('الى')).toBe(word('إِلَىٰ'));
    expect(word('امنوا')).toBe(word('آمَنُوا'));
    expect(word('ٱهۡدِنَا')).toBe(word('اهدنا'));
  });

  it('reads alef with madda as a hamza followed by a long a', () => {
    expect(word('الْقُرْآنَ')).toBe('ءلقرءن');
    expect(word('ٱلۡقُرۡءَانَ')).toBe('ءلقرءن');
    expect(word('آمَنُوا')).toBe(word('ءَامَنُواْ'));
  });

  it('reads a hamza sign on a tatweel as a hamza of its own', () => {
    // Uthmani شَيۡـٔٗا and imla'i شَيْئًا; Uthmani لَتُسۡـَٔلُنَّ and imla'i لَتُسْأَلُنَّ.
    expect(word('شَيۡـٔٗا')).toBe('شيءا');
    expect(word('لَتُسۡـَٔلُنَّ')).toBe(word('لَتُسْأَلُنَّ'));
  });

  it('reads a decomposed hamza (letter followed by a hamza sign) like the single character', () => {
    expect(word(`ا${HAMZA_ABOVE}ن`)).toBe(word('أن'));
    expect(word(`اِ${HAMZA_BELOW}ن`)).toBe(word('إن'));
    expect(word(`مو${HAMZA_ABOVE}منون`)).toBe(word('مؤمنون'));
    expect(word(`شيي${HAMZA_ABOVE}ا`)).toBe(word('شيئا'));
  });

  it('writes two hamzas in a row once', () => {
    expect(word('ءَأَنذَرۡتَهُمۡ')).toBe(word('أَأَنْذَرْتَهُمْ'));
  });

  it('unifies ya and alef maqsura', () => {
    expect(word('عَلَىٰ')).toBe('علي');
    expect(word('على')).toBe('علي');
    expect(word('علي')).toBe('علي');
    expect(word('هُدًى')).toBe(word('هدي'));
  });

  it('unifies ta marbuta and ha', () => {
    expect(word('رَحْمَةٌ')).toBe('رحمه');
    expect(word('رحمه')).toBe('رحمه');
  });

  it('maps Persian and Urdu letter shapes to the Arabic letters', () => {
    expect(word('کتب')).toBe(word('كتب'));
    expect(word('فی')).toBe(word('في'));
    expect(word('ہو')).toBe(word('هو'));
  });
});

describe("Rule 1.3 — superscript alef and other Uthmani / imla'i differences give the same form", () => {
  it.each([
    ['ٱلۡعَٰلَمِينَ', 'الْعَالَمِينَ'],
    ['مَٰلِكِ', 'مَالِكِ'],
    ['ٱلصِّرَٰطَ', 'الصِّرَاطَ'],
    ['ٱلۡكِتَٰبُ', 'الْكِتَابُ'],
    ['ٱلسَّمَٰوَٰتِ', 'السَّمَاوَاتِ'],
    ['ٱلۡمَلَـٰٓئِكَةِ', 'الْمَلَائِكَةِ'],
  ])('the small alef of %s is the full alef of %s', (uthmani, imlaei) => {
    expect(word(uthmani)).toBe(word(imlaei));
  });

  it.each([
    ['ٱلرَّحۡمَٰنِ', 'الرحمن'],
    ['هَٰذَا', 'هذا'],
    ['ذَٰلِكَ', 'ذلك'],
    ['أُوْلَـٰٓئِكَ', 'أولئك'],
    ['إِلَٰهِ', 'إله'],
    ['وَلَٰكِنَّ', 'ولكن'],
  ])('%s equals %s, which modern spelling writes without any alef', (uthmani, modern) => {
    expect(word(uthmani)).toBe(word(modern));
  });

  it.each([
    ['ٱلصَّلَوٰةَ', 'الصَّلَاةَ'],
    ['ٱلزَّكَوٰةَ', 'الزَّكَاةَ'],
    ['ٱلۡحَيَوٰةِ', 'الْحَيَاةِ'],
    ['أَلۡهَىٰكُمُ', 'أَلْهَاكُمُ'],
    ['ٱلتَّوۡرَىٰةَ', 'التَّوْرَاةَ'],
  ])('the waw or ya of %s only carries the long a of %s', (uthmani, imlaei) => {
    expect(word(uthmani)).toBe(word(imlaei));
  });

  it('keeps a waw that is a real consonant before a small alef', () => {
    expect(word('ٱلسَّمَٰوَٰتِ')).toBe('ءلسموت');
  });

  it('drops the silent alef after a final waw', () => {
    expect(word('ءَامَنُواْ')).toBe('ءمنو');
    expect(word('قَالُوا')).toBe('قلو');
    // Uthmani writes it where imla'i does not, and the reverse.
    expect(word('يَدۡعُواْ')).toBe(word('يَدْعُو'));
    expect(word('يَبۡدَؤُاْ')).toBe(word('يَبْدَأُ'));
  });

  it('keeps an alef that ends a word: it tells ما from م and فيها from فيه', () => {
    expect(word('مَا')).toBe('ما');
    expect(word('فِيهَا')).toBe('فيها');
    expect(word('فِيهِ')).toBe('فيه');
    expect(word('أَنَا۠')).toBe(word('أَنَا'));
  });

  it("drops the small waw and ya that lengthen a pronoun, which imla'i does not write", () => {
    expect(word('لَّهُۥ')).toBe(word('لَهُ'));
    expect(word('بِهِۦ')).toBe(word('بِهِ'));
  });

  it("keeps the small letters that imla'i writes as full letters", () => {
    expect(word('دَاوُۥدَ')).toBe(word('دَاوُودَ'));
    expect(word('إِبۡرَٰهِـۧمَ')).toBe(word('إِبْرَاهِيمَ'));
  });

  it('gives identical words for every sample verse except the one cut differently', () => {
    const different = UTHMANI_SAMPLE.filter((verse, index) => {
      const imlaei = IMLAEI_SAMPLE[index]?.text ?? '';
      return normalizeArabic(verse.text).join(' ') !== normalizeArabic(imlaei).join(' ');
    }).map((verse) => `${verse.surah}:${verse.verse}`);

    // 109:1 — Uthmani writes يَـٰٓأَيُّهَا as one word, imla'i as two (يا أيها): see rule 1.4.
    expect(different).toEqual(['109:1']);
  });

  it('gives the same words for every sample verse with or without vowel marks', () => {
    for (const verse of IMLAEI_SAMPLE) {
      expect(normalizeArabic(withoutMarks(verse.text))).toEqual(normalizeArabic(verse.text));
    }
  });
});

describe('Rule 1.4 — never merges nor cuts words', () => {
  it('keeps as one word what the text writes as one word', () => {
    expect(normalizeArabic('قُلۡ يَـٰٓأَيُّهَا ٱلۡكَٰفِرُونَ')).toEqual(['قل', 'يءيها', 'ءلكفرون']);
  });

  it('keeps as two words what the text writes as two words', () => {
    expect(normalizeArabic('قُلْ يَا أَيُّهَا الْكَافِرُونَ')).toEqual(['قل', 'يا', 'ءيها', 'ءلكفرون']);
  });

  it('returns as many words as the text has, for every sample verse', () => {
    for (const verse of UTHMANI_SAMPLE) {
      expect(normalizeArabic(verse.text)).toHaveLength(verse.text.split(' ').length);
    }
  });

  it('separates words on spaces, line breaks, punctuation and digits', () => {
    expect(normalizeArabic('قل\nهو\tالله')).toHaveLength(3);
    expect(normalizeArabic('الحمد،لله')).toEqual(['ءلحمد', 'لله']);
    expect(normalizeArabic('قل ١٢ هو (الله) أحد.')).toEqual(['قل', 'هو', 'ءلله', 'ءحد']);
  });

  it('does not cut a word on an invisible character or on the thin space of 2:72', () => {
    expect(normalizeArabic(`الح${ZERO_WIDTH_JOINER}مد`)).toEqual(['ءلحمد']);
    expect(normalizeArabic(`فَٱدَّٰرَ${THIN_SPACE}ٰٔتُمۡ`)).toHaveLength(1);
  });

  it('keeps a letter of another language inside its word', () => {
    expect(normalizeArabic('پاک')).toHaveLength(1);
  });
});

describe('Rule 1 — edges and invalid input', () => {
  it('returns no word for an empty text', () => {
    expect(normalizeArabic('')).toEqual([]);
    expect(normalizeArabic('   \n ')).toEqual([]);
  });

  it('returns no word for a text that is not Arabic', () => {
    expect(normalizeArabic('Bismillah ar-Rahman 123 !?')).toEqual([]);
  });

  it('keeps only the Arabic words of a mixed text', () => {
    expect(normalizeArabic('surah الفاتحة (7 verses)')).toEqual(['ءلفتحه']);
  });

  it('throws a TypeError when the text is not a string', () => {
    // @ts-expect-error invalid input on purpose
    expect(() => normalizeArabic(null)).toThrow(TypeError);
    // @ts-expect-error invalid input on purpose
    expect(() => normalizeArabic(['قل'])).toThrow(TypeError);
  });
});

describe('Rule 1.5 — accent-tolerant key groups the letters that non-Arabic speakers confuse', () => {
  it.each([
    ['ح / ه', 'الحمد', 'الهمد'],
    ['ع / ء', 'عليم', 'أليم'],
    ['ق / ك', 'قلب', 'كلب'],
    ['ص / س', 'الصراط', 'السراط'],
    ['ض / د', 'الضالين', 'الدالين'],
    ['ط / ت', 'الصراط', 'الصرات'],
    ['ذ / ز', 'ذلك', 'زلك'],
    ['ذ / ظ', 'ذلك', 'ظلك'],
    ['ث / س', 'ثم', 'سم'],
  ])('%s: the two words get the same key', (_group, word1, word2) => {
    expect(normalizeArabic(word1)).not.toEqual(normalizeArabic(word2));
    expect(toAccentKey(word1)).toBe(toAccentKey(word2));
  });

  it('keeps apart words that differ by letters of different groups', () => {
    expect(toAccentKey('رب')).not.toBe(toAccentKey('رد'));
    expect(toAccentKey('من')).not.toBe(toAccentKey('في'));
  });

  it('accepts a raw word as well as a normalised one', () => {
    expect(toAccentKey('ٱلصِّرَٰطَ')).toBe(toAccentKey(word('الصراط')));
  });

  it('throws a TypeError unless given exactly one Arabic word', () => {
    expect(() => toAccentKey('')).toThrow(TypeError);
    expect(() => toAccentKey('hello')).toThrow(TypeError);
    expect(() => toAccentKey('قل هو')).toThrow(TypeError);
  });
});
