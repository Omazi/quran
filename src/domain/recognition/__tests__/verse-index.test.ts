import { IMLAEI_SAMPLE } from '../__fixtures__/imlaei-sample';
import { UNRELATED_SENTENCES } from '../__fixtures__/unrelated-sentences';
import { UTHMANI_SAMPLE } from '../__fixtures__/uthmani-sample';
import { createVerseIndex, normalizeArabic, type SearchResult, type VerseText } from '../index';
import { imlaeiText, span, uthmaniWords, withoutMarks, wordRef } from '../test-support/sample';

const index = createVerseIndex(UTHMANI_SAMPLE);

/** Searches a transcript given as one string. */
function search(transcript: string, options?: Parameters<typeof index.search>[1]): SearchResult {
  return index.search(transcript.split(' '), options);
}

/** The places of the candidates that explain the input equally well, as "s:v.w-s:v.w". */
function tiedSpans(result: SearchResult): string[] {
  return result.candidates.slice(0, result.tiedCount).map(span);
}

/** Verses 2 to 5 of the Fatiha in plain spelling: 13 words, found nowhere else in the sample. */
const FATIHA_2_TO_5 = 'الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين إياك نعبد وإياك نستعين';

describe('Rule 2 — createVerseIndex', () => {
  it('reads the verses as one sequence of words', () => {
    const words = UTHMANI_SAMPLE.reduce((count, verse) => count + verse.text.split(' ').length, 0);

    expect(index.verseCount).toBe(UTHMANI_SAMPLE.length);
    expect(index.wordCount).toBe(words);
  });

  it('accepts the Verse objects of the Quran module as they are', () => {
    const verses = UTHMANI_SAMPLE.map((verse) => ({
      ...verse,
      key: `${verse.surah}:${verse.verse}`,
    }));

    expect(createVerseIndex(verses).verseCount).toBe(UTHMANI_SAMPLE.length);
  });

  it('throws on a list that is empty or not a list', () => {
    expect(() => createVerseIndex([])).toThrow(RangeError);
    // @ts-expect-error invalid input on purpose
    expect(() => createVerseIndex('قل هو الله أحد')).toThrow(TypeError);
  });

  it('throws on verses that are out of order or given twice', () => {
    const [first, second] = UTHMANI_SAMPLE;
    if (first === undefined || second === undefined) throw new Error('sample too small');

    expect(() => createVerseIndex([second, first])).toThrow(/mushaf order/);
    expect(() => createVerseIndex([first, first])).toThrow(RangeError);
  });

  it.each([
    ['surah 0', { surah: 0, verse: 1, text: 'قل' }],
    ['surah 115', { surah: 115, verse: 1, text: 'قل' }],
    ['verse 0', { surah: 1, verse: 0, text: 'قل' }],
    ['verse 1.5', { surah: 1, verse: 1.5, text: 'قل' }],
    ['a text without any Arabic word', { surah: 1, verse: 1, text: 'hello' }],
    ['an empty text', { surah: 1, verse: 1, text: '' }],
  ])('throws a RangeError on %s', (_case, verse: VerseText) => {
    expect(() => createVerseIndex([verse])).toThrow(RangeError);
  });

  it('throws a TypeError on a verse without text', () => {
    // @ts-expect-error invalid input on purpose
    expect(() => createVerseIndex([{ surah: 1, verse: 1 }])).toThrow(TypeError);
    // @ts-expect-error invalid input on purpose
    expect(() => createVerseIndex([null])).toThrow(TypeError);
  });
});

describe('Rule 2.1 — the input may start and end in the middle of a verse and span several verses', () => {
  it('finds a unique passage that spans several verses', () => {
    const result = search('قل هو الله أحد الله الصمد لم يلد');

    expect(result.status).toBe('found');
    expect(result.candidates[0]?.start).toEqual(wordRef(112, 1, 1));
    expect(result.candidates[0]?.end).toEqual(wordRef(112, 3, 2));
  });

  it('finds a passage that starts and ends in the middle of one verse', () => {
    const result = search('أنعمت عليهم غير المغضوب');

    expect(result.status).toBe('found');
    expect(tiedSpans(result)).toEqual(['1:7.3-1:7.6']);
  });

  it('finds a passage from the middle of a verse to the middle of a later one', () => {
    const result = search('ما خلق ومن شر غاسق إذا وقب ومن شر');

    expect(result.status).toBe('found');
    expect(tiedSpans(result)).toEqual(['113:2.3-113:4.2']);
  });

  it('accepts words in Uthmani script, with all their marks', () => {
    const result = index.search(uthmaniWords(94, 1, 3));

    expect(result.status).toBe('found');
    expect(tiedSpans(result)).toEqual(['94:1.1-94:3.3']);
    expect(result.candidates[0]?.score).toBe(1);
  });

  it('accepts already normalised words', () => {
    const result = index.search(normalizeArabic(imlaeiText(94, 1, 3)));

    expect(tiedSpans(result)).toEqual(['94:1.1-94:3.3']);
  });

  it('accepts entries that hold several words', () => {
    expect(tiedSpans(index.search([imlaeiText(94, 1, 3)]))).toEqual(['94:1.1-94:3.3']);
  });

  describe("imla'i sample as a stand-in for speech output", () => {
    const versesLongEnough = IMLAEI_SAMPLE.filter(
      (verse) => normalizeArabic(verse.text).length >= 3,
    );

    it.each([
      ['with vowel marks', (text: string) => text],
      ['without any mark', withoutMarks],
    ])('finds every verse of the sample at its place, %s', (_case, spell) => {
      expect(versesLongEnough.length).toBeGreaterThan(60);
      for (const verse of versesLongEnough) {
        const result = index.search([spell(verse.text)]);
        const lastWord = uthmaniWords(verse.surah, verse.verse).length;
        const place = `${verse.surah}:${verse.verse}.1-${verse.surah}:${verse.verse}.${lastWord}`;

        expect(result.status).not.toBe('not-found');
        expect(tiedSpans(result)).toContain(place);
        expect(result.candidates[0]?.score).toBe(1);
      }
    });
  });
});

describe('Rule 2.2 — tolerates wrong, missing and extra words', () => {
  const PLACE = '1:2.1-1:5.4';

  it('finds the passage when nothing is wrong (reference case)', () => {
    const result = search(FATIHA_2_TO_5);

    expect(result.status).toBe('found');
    expect(tiedSpans(result)).toEqual([PLACE]);
    expect(result.candidates[0]?.score).toBe(1);
  });

  it('tolerates a replaced word', () => {
    const result = search(FATIHA_2_TO_5.replace('مالك', 'كتاب'));

    expect(result.status).toBe('found');
    expect(tiedSpans(result)).toEqual([PLACE]);
    expect(result.candidates[0]?.score).toBeCloseTo(12 / 13);
  });

  it('tolerates a missing word', () => {
    const result = search(FATIHA_2_TO_5.replace('يوم ', ''));

    expect(result.status).toBe('found');
    expect(tiedSpans(result)).toEqual([PLACE]);
    expect(result.candidates[0]?.score).toBeCloseTo(12 / 13);
  });

  it('tolerates an extra word', () => {
    const result = search(FATIHA_2_TO_5.replace('مالك', 'قال مالك'));

    expect(result.status).toBe('found');
    expect(tiedSpans(result)).toEqual([PLACE]);
    expect(result.candidates[0]?.score).toBeCloseTo(13 / 14);
  });

  it('tolerates letters confused by a foreign accent (ح/ه, ع/ء, ص/س, ض/د, ط/ت, ق/ك)', () => {
    const result = search(
      'الهمد لله رب الآلمين الرهمن الرهيم مالك يوم الدين إياك نأبد وإياك نستئين',
    );

    expect(result.status).toBe('found');
    expect(tiedSpans(result)).toEqual([PLACE]);
    expect(result.candidates[0]?.score).toBeGreaterThan(0.9);
    expect(result.candidates[0]?.score).toBeLessThan(1);
  });

  it('tolerates a wrong letter in a word', () => {
    const result = search(
      FATIHA_2_TO_5.replace('العالمين', 'العالمون').replace('نستعين', 'نستعيم'),
    );

    expect(result.status).toBe('found');
    expect(tiedSpans(result)).toEqual([PLACE]);
  });

  it('tolerates three errors at once: a replaced, a missing and an extra word', () => {
    const noisy = FATIHA_2_TO_5.replace('رب', 'ربنا يا')
      .replace('مالك ', '')
      .replace('نعبد', 'نذهب');
    const result = search(noisy);

    expect(result.status).toBe('found');
    expect(tiedSpans(result)).toEqual([PLACE]);
    expect(result.candidates[0]?.score).toBeGreaterThan(0.6);
  });

  it('finds the Fatiha read by a learner: no hamza, س for ص, د for ض, a word missing', () => {
    const learner =
      'الحمد لله رب العالمين الرحمان الرحيم مالك يوم الدين اياك نعبد واياك نستعين ' +
      'اهدنا السراط المستقيم سراط الذين انعمت عليهم غير المغدوب ولا الدالين';
    const result = search(learner);

    expect(result.status).toBe('found');
    expect(tiedSpans(result)).toEqual(['1:2.1-1:7.9']);
    expect(result.candidates[0]?.score).toBeGreaterThan(0.85);
  });

  it('matches two heard words with one word of the text (يا أيها is one word in Uthmani)', () => {
    const result = search('قل يا أيها الكافرون لا أعبد ما تعبدون');

    expect(result.status).toBe('found');
    expect(tiedSpans(result)).toEqual(['109:1.1-109:2.4']);
    expect(result.candidates[0]?.score).toBe(1);
  });

  it('matches one heard word with two words of the text (words glued by the speech engine)', () => {
    const result = search('قلهو الله أحد الله الصمد');

    expect(result.status).toBe('found');
    expect(tiedSpans(result)).toEqual(['112:1.1-112:2.2']);
    expect(result.candidates[0]?.score).toBe(1);
  });

  it('matches a glued word whose second half starts with the article (ربالعالمين)', () => {
    const result = search('الحمد لله ربالعالمين الرحمن الرحيم');

    expect(result.status).toBe('found');
    expect(tiedSpans(result)).toEqual(['1:2.1-1:3.2']);
    expect(result.candidates[0]?.score).toBe(1);
  });

  it('keeps the places of a repeated passage tied when two of its words are glued', () => {
    // 95:6 and 103:3 share these words; آمنوا وعملوا heard as one word.
    const result = search('إلا الذين آمنواوعملوا الصالحات');

    expect(result.status).toBe('ambiguous');
    expect(tiedSpans(result)).toEqual(['95:6.1-95:6.5', '103:3.1-103:3.5']);
  });
});

describe('Rule 2.3 — each candidate has a start, an end and a score between 0 and 1', () => {
  it('gives the first and last word of the passage, numbered from 1', () => {
    const [candidate] = search('الرحمن الرحيم مالك يوم الدين').candidates;

    expect(candidate?.start).toEqual({ surah: 1, verse: 3, word: 1 });
    expect(candidate?.end).toEqual({ surah: 1, verse: 4, word: 3 });
  });

  it('scores 1 a passage heard word for word', () => {
    expect(search(FATIHA_2_TO_5).candidates[0]?.score).toBe(1);
  });

  it('counts the heard words that the passage does not explain', () => {
    // 8 words of 113:1-2 followed by 2 words that are not there.
    const result = search('قل أعوذ برب الفلق من شر ما خلق كتاب جديد');

    expect(tiedSpans(result)).toEqual(['113:1.1-113:2.4']);
    expect(result.candidates[0]?.score).toBeCloseTo(8 / 10);
  });

  it('counts the words of the passage that were not heard', () => {
    // 113:1-3 has 13 words; "غاسق" is not said.
    const result = search('قل أعوذ برب الفلق من شر ما خلق ومن شر إذا وقب');

    expect(tiedSpans(result)).toEqual(['113:1.1-113:3.5']);
    expect(result.candidates[0]?.score).toBeCloseTo(12 / 13);
  });

  it('keeps every score and confidence between 0 and 1', () => {
    const transcripts = [
      FATIHA_2_TO_5,
      'فبأي آلاء ربكما تكذبان',
      'قل أعوذ برب الناس ملك كتاب إله الناس',
    ];
    for (const transcript of transcripts) {
      for (const candidate of search(transcript, { minScore: 0.3 }).candidates) {
        expect(candidate.score).toBeGreaterThan(0);
        expect(candidate.score).toBeLessThanOrEqual(1);
        expect(candidate.confidence).toBeGreaterThan(0);
        expect(candidate.confidence).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('Rule 2.4 — ambiguity: a repeated passage is reported as such, with every place listed', () => {
  it('a passage repeated word for word in one surah (55:13 and following)', () => {
    const result = search('فبأي آلاء ربكما تكذبان');

    expect(result.status).toBe('ambiguous');
    expect(result.tiedCount).toBe(6);
    expect(tiedSpans(result)).toEqual([
      '55:13.1-55:13.4',
      '55:16.1-55:16.4',
      '55:18.1-55:18.4',
      '55:21.1-55:21.4',
      '55:23.1-55:23.4',
      '55:25.1-55:25.4',
    ]);
  });

  it('a verse opening shared by several surahs (113:1 and 114:1)', () => {
    const result = search('قل أعوذ برب');

    expect(result.status).toBe('ambiguous');
    expect(tiedSpans(result)).toEqual(['113:1.1-113:1.3', '114:1.1-114:1.3']);
  });

  it('a passage repeated in two surahs (95:6 and 103:3)', () => {
    const result = search('إلا الذين آمنوا وعملوا الصالحات');

    expect(result.status).toBe('ambiguous');
    expect(tiedSpans(result)).toEqual(['95:6.1-95:6.5', '103:3.1-103:3.5']);
  });

  it('two identical verses of one surah (109:3 and 109:5)', () => {
    const result = search('ولا أنتم عابدون ما أعبد');

    expect(result.status).toBe('ambiguous');
    expect(tiedSpans(result)).toEqual(['109:3.1-109:3.5', '109:5.1-109:5.5']);
  });

  it('a phrase repeated a few words further (102:3 and 102:4)', () => {
    const result = search('كلا سوف تعلمون');

    expect(result.status).toBe('ambiguous');
    expect(tiedSpans(result)).toEqual(['102:3.1-102:3.3', '102:4.2-102:4.4']);
  });

  it('stays ambiguous when the repeated passage is heard with noise', () => {
    const result = search('فبأي الاء ربكم تكذبان');

    expect(result.status).toBe('ambiguous');
    expect(result.tiedCount).toBe(6);
  });

  it('never chooses at random: tied places come in mushaf order, and the same input gives the same result', () => {
    const first = search('فبأي آلاء ربكما تكذبان');
    const second = search('فبأي آلاء ربكما تكذبان');

    expect(second).toEqual(first);
    const verses = first.candidates.map((candidate) => candidate.start.verse);
    expect(verses).toEqual([...verses].sort((a, b) => a - b));
  });

  it('shares the confidence between the tied places instead of pretending to be sure', () => {
    const two = search('قل أعوذ برب');
    const six = search('فبأي آلاء ربكما تكذبان');

    expect(two.candidates.map((candidate) => candidate.score)).toEqual([1, 1]);
    expect(two.candidates.map((candidate) => candidate.confidence)).toEqual([0.5, 0.5]);
    for (const candidate of six.candidates) expect(candidate.confidence).toBeCloseTo(1 / 6);
  });

  it('gives a unique passage a confidence equal to its score', () => {
    const [candidate] = search(FATIHA_2_TO_5.replace('يوم ', '')).candidates;

    expect(candidate?.confidence).toBeCloseTo(12 / 13);
  });

  describe('more words tell the places apart', () => {
    it('the next word of 113:1 settles between 113:1 and 114:1', () => {
      const result = search('قل أعوذ برب الفلق');

      expect(result.status).toBe('found');
      expect(tiedSpans(result)).toEqual(['113:1.1-113:1.4']);
    });

    it('the next words of 95:6 settle between 95:6 and 103:3', () => {
      const result = search('إلا الذين آمنوا وعملوا الصالحات فلهم أجر');

      expect(result.status).toBe('found');
      expect(tiedSpans(result)).toEqual(['95:6.1-95:6.7']);
    });

    it('the verse that follows a refrain of surah 55 tells which refrain it was', () => {
      const result = search('فبأي آلاء ربكما تكذبان رب المشرقين ورب المغربين');

      expect(result.status).toBe('found');
      expect(tiedSpans(result)).toEqual(['55:16.1-55:17.4']);
    });

    it('the confidence in the right passage never drops as the transcript grows', () => {
      const transcript = 'قل أعوذ برب الناس ملك الناس إله الناس من شر الوسواس الخناس'.split(' ');
      let previousConfidence = 0;
      for (let length = 3; length <= transcript.length; length += 1) {
        const result = index.search(transcript.slice(0, length));
        const right = result.candidates.find(
          (candidate) => candidate.start.surah === 114 && candidate.start.verse === 1,
        );

        expect(right).toBeDefined();
        expect(right?.confidence ?? 0).toBeGreaterThanOrEqual(previousConfidence);
        previousConfidence = right?.confidence ?? 0;
      }
      expect(previousConfidence).toBe(1);
    });
  });

  it('does not call ambiguous a place that explains one whole word less, but lists it and lowers the confidence', () => {
    // 95:6 up to its sixth word; 103:3 has the first five words only.
    const result = search('إلا الذين آمنوا وعملوا الصالحات فلهم');

    expect(result.status).toBe('found');
    expect(result.tiedCount).toBe(1);
    expect(result.candidates.map(span)).toEqual(['95:6.1-95:6.6', '103:3.1-103:3.5']);
    expect(result.candidates.map((candidate) => candidate.score)).toEqual([1, 5 / 6]);
    // One word of evidence makes 95:6 eight times more likely (`oddsPerExplainedWord`).
    expect(result.candidates[0]?.confidence).toBeCloseTo(8 / 9);
    expect(result.candidates[1]?.confidence).toBeCloseTo((5 / 6) * (1 / 9));
  });

  it('returns at most `maxAlternatives` places after the best ones', () => {
    const transcript = 'إلا الذين آمنوا وعملوا الصالحات فلهم';

    expect(search(transcript).candidates).toHaveLength(2);
    expect(search(transcript, { maxAlternatives: 0 }).candidates).toHaveLength(1);
    expect(search('قل أعوذ برب', { maxAlternatives: 0 }).candidates).toHaveLength(2);
  });
});

describe('Rule 2.5 — below the minimal score or the minimal number of words, the result is "not found"', () => {
  it('an input that is too short is not searched', () => {
    expect(search('قل هو')).toEqual({
      status: 'not-found',
      reason: 'too-few-words',
      candidates: [],
      tiedCount: 0,
    });
  });

  it('an empty input, or one without any Arabic word, is too short', () => {
    expect(index.search([]).status).toBe('not-found');
    expect(index.search(['', '  ']).status).toBe('not-found');
    expect(search('in the name of God the most merciful')).toMatchObject({
      status: 'not-found',
      reason: 'too-few-words',
    });
  });

  it.each(UNRELATED_SENTENCES)('an input unrelated to the Quran is not found: %s', (sentence) => {
    expect(search(sentence)).toEqual({
      status: 'not-found',
      reason: 'no-match',
      candidates: [],
      tiedCount: 0,
    });
  });

  it('words of the sample in an order found nowhere are not found', () => {
    expect(search('الناس الفلق الدين الصمد العالمين الكافرون التكاثر').status).toBe('not-found');
  });

  it('a short input must be explained almost entirely: one wrong word in four is not enough', () => {
    const result = search('قل هو كتاب أحد');

    expect(result.status).toBe('not-found');
    // The caller may decide otherwise.
    expect(search('قل هو كتاب أحد', { minScore: 0.6 }).status).toBe('found');
  });

  it('a passage that explains too little of a long input is not found', () => {
    // Four words of 112:1 lost among nine others.
    expect(search('ذهبت إلى السوق قل هو الله أحد ثم رجعت إلى البيت مع أخي').status).toBe(
      'not-found',
    );
  });

  it('`minWords` and `minScore` can be changed by the caller', () => {
    expect(search('الله الصمد').status).toBe('not-found');
    expect(tiedSpans(search('الله الصمد', { minWords: 2 }))).toEqual(['112:2.1-112:2.2']);
    expect(search(FATIHA_2_TO_5.replace('يوم ', ''), { minScore: 0.95 }).status).toBe('not-found');
  });

  it.each([
    ['minWords 0', { minWords: 0 }],
    ['minWords 2.5', { minWords: 2.5 }],
    ['minScore below 0', { minScore: -0.1 }],
    ['minScore above 1', { minScore: 1.1 }],
    ['minScore NaN', { minScore: Number.NaN }],
    ['maxAlternatives below 0', { maxAlternatives: -1 }],
    ['maxAlternatives 1.5', { maxAlternatives: 1.5 }],
  ])('throws a RangeError on %s', (_case, options) => {
    expect(() => search(FATIHA_2_TO_5, options)).toThrow(RangeError);
  });

  it('throws a TypeError when the words are not a list of strings', () => {
    // @ts-expect-error invalid input on purpose
    expect(() => index.search('قل هو الله أحد')).toThrow(TypeError);
    // @ts-expect-error invalid input on purpose
    expect(() => index.search(['قل', 3])).toThrow(TypeError);
  });
});

describe('Précisions — never sure by mistake', () => {
  it('ties the places that noise cannot tell apart (113:1 and 114:1 heard with an accent)', () => {
    const result = search('كل اعوز برب');

    expect(result.status).toBe('ambiguous');
    expect(tiedSpans(result)).toEqual(['113:1.1-113:1.3', '114:1.1-114:1.3']);
    expect(result.candidates[0]?.confidence).toBe(result.candidates[1]?.confidence);
  });

  it('ties the places that hold the same words when one word is wrong (95:6 and 103:3)', () => {
    const result = search('إلا الذين آمنوا وعملوا الطيبات');

    expect(result.status).toBe('ambiguous');
    expect(tiedSpans(result)).toEqual(['95:6.1-95:6.4', '103:3.1-103:3.4']);
  });

  it('lists every tied place, whatever `maxAlternatives` says', () => {
    const result = search('فبأي آلاء ربكما تكذبان', { maxAlternatives: 0 });

    expect(result.tiedCount).toBe(6);
    expect(result.candidates).toHaveLength(6);
  });

  it('says nothing about truncation when the list is complete and the input was searched whole', () => {
    expect(Object.keys(search('فبأي آلاء ربكما تكذبان')).sort()).toEqual([
      'candidates',
      'status',
      'tiedCount',
    ]);
  });
});

describe('Précisions — bounded input', () => {
  const tooLong = 'قل'.repeat(16); // 32 letters

  it('says when an input of more than 300 words was cut, even when nothing is found', () => {
    const words = (count: number): string[] => new Array<string>(count).fill('مدرسة');

    expect(index.search(words(300))).toEqual({
      status: 'not-found',
      reason: 'no-match',
      candidates: [],
      tiedCount: 0,
    });
    expect(index.search(words(301))).toEqual({
      status: 'not-found',
      reason: 'no-match',
      candidates: [],
      tiedCount: 0,
      inputTruncated: true,
    });
  });

  it('searches the most recent words of an input of more than 300 words', () => {
    const before = new Array<string>(300).fill('مدرسة');

    const result = index.search([...before, ...FATIHA_2_TO_5.split(' ')], { minScore: 0.01 });

    expect(result.inputTruncated).toBe(true);
    expect(result.candidates[0]).toMatchObject({
      start: wordRef(1, 2, 1),
      end: wordRef(1, 5, 4),
    });
  });

  it('never counts a heard "word" of more than 30 letters as a word of a passage', () => {
    const result = search(`قل هو الله أحد ${tooLong}`, { minScore: 0.5 });

    expect(tiedSpans(result)).toEqual(['112:1.1-112:1.4']);
    expect(result.candidates[0]?.score).toBeCloseTo(4 / 5);
  });

  it('answers quickly to a single "word" of 65,536 letters', () => {
    const before = performance.now();
    const result = index.search(['قل', 'هو', 'ب'.repeat(65_536)]);

    expect(result.status).toBe('not-found');
    expect(performance.now() - before).toBeLessThan(1000);
  });

  it('refuses a corpus that holds a "word" of more than 30 letters', () => {
    expect(() => createVerseIndex([{ surah: 1, verse: 1, text: `قل ${tooLong}` }])).toThrow(
      RangeError,
    );
  });
});

describe('Précisions — invalid options give an explicit error of the module', () => {
  const words = FATIHA_2_TO_5.split(' ');

  it.each([
    ['null', null],
    ['a string', 'fast'],
    ['a number', 3],
    ['a list', [{ minWords: 3 }]],
  ])('throws a TypeError when the options are %s', (_case, options) => {
    // @ts-expect-error invalid input on purpose
    expect(() => index.search(words, options)).toThrow(TypeError);
    // @ts-expect-error invalid input on purpose
    expect(() => index.search(words, options)).toThrow(/options/);
  });

  it.each([
    ['minScore as text', { minScore: '0.5' }, /minScore/],
    ['minWords as text', { minWords: '3' }, /minWords/],
    ['maxAlternatives as text', { maxAlternatives: '2' }, /maxAlternatives/],
    ['minWords null', { minWords: null }, /minWords/],
    ['minScore infinite', { minScore: Number.POSITIVE_INFINITY }, /minScore/],
  ])('throws a RangeError naming the option on %s', (_case, options, message) => {
    // @ts-expect-error invalid input on purpose
    expect(() => index.search(words, options)).toThrow(RangeError);
    // @ts-expect-error invalid input on purpose
    expect(() => index.search(words, options)).toThrow(message);
  });

  it('accepts no options, undefined, an empty object and undefined values', () => {
    const expected = index.search(words);

    expect(index.search(words, undefined)).toEqual(expected);
    expect(index.search(words, {})).toEqual(expected);
    expect(index.search(words, { minWords: undefined, minScore: undefined })).toEqual(expected);
  });
});

describe("What readers say before the passage (isti'adha, basmala)", () => {
  const ISTIADHA = 'أعوذ بالله من الشيطان الرجيم';
  const BASMALA = 'بسم الله الرحمن الرحيم';

  it('a basmala followed by the start of a surah points to that surah, with a full score', () => {
    const result = search(`${BASMALA} قل هو الله أحد الله الصمد`);

    expect(result.status).toBe('found');
    expect(tiedSpans(result)).toEqual(['112:1.1-112:2.2']);
    expect(result.candidates[0]?.score).toBe(1);
  });

  it("a leading isti'adha is left out, with or without a basmala after it", () => {
    expect(tiedSpans(search(`${ISTIADHA} قل هو الله أحد الله الصمد`))).toEqual(['112:1.1-112:2.2']);
    expect(tiedSpans(search(`${ISTIADHA} ${BASMALA} قل هو الله أحد`))).toEqual(['112:1.1-112:1.4']);
  });

  it('the basmala of the Fatiha is part of the passage', () => {
    const result = search(`${BASMALA} الحمد لله رب العالمين الرحمن الرحيم`);

    expect(result.status).toBe('found');
    expect(tiedSpans(result)).toEqual(['1:1.1-1:3.2']);
  });

  it('a basmala alone is verse 1:1', () => {
    expect(tiedSpans(search(BASMALA))).toEqual(['1:1.1-1:1.4']);
  });

  it("an isti'adha alone is not a passage of the Quran", () => {
    expect(search(ISTIADHA)).toMatchObject({ status: 'not-found', reason: 'too-few-words' });
  });
});
