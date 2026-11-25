import { createVerseIndex } from '../../recognition';
import { UTHMANI_SAMPLE } from '../../recognition/__fixtures__/uthmani-sample';
import { HEARD_SEARCH, searchHeardWords } from '../heard-search';

const index = createVerseIndex(UTHMANI_SAMPLE);

/** Arabic words that are in none of the sample's verses: what a noisy transcription adds. */
const NOISE = 'سيارة كبيرة جميلة حمراء سريعة جديدة قديمة غالية رخيصة واسعة نظيفة'.split(' ');
/** 112:1–4 as Whisper writes it: plain spelling, vowels. */
const SURAH_112 = 'قُلْ هُوَ اللَّهُ أَحَدٌ اللَّهُ الصَّمَدُ لَمْ يَلِدْ وَلَمْ يُولَدْ'.split(' ');

describe('searchHeardWords', () => {
  it('finds a passage recited after words too noisy to place', () => {
    const heard = [...NOISE, ...SURAH_112.slice(0, HEARD_SEARCH.recentWords)];
    // Over all the words heard, the passage explains too few of them…
    expect(index.search(heard).status).toBe('not-found');
    // …but the latest words, alone, name it.
    const result = searchHeardWords(index, heard);
    expect(result.status).toBe('found');
    expect(result.candidates[0]?.start).toMatchObject({ surah: 112, verse: 1 });
  });

  it('keeps the answer for all the words when it found the passage', () => {
    const heard = SURAH_112;
    expect(searchHeardWords(index, heard)).toEqual(index.search(heard));
  });

  it('leaves a tie as it is: places the words cannot tell apart stay ambiguous', () => {
    // 113:1 and 114:1 start with the same three words.
    const heard = 'قُلْ أَعُوذُ بِرَبِّ'.split(' ');
    expect(searchHeardWords(index, heard).status).toBe('ambiguous');
  });

  it('gives the answer for all the words when the latest ones find nothing either', () => {
    const heard = [...NOISE, ...NOISE];
    expect(searchHeardWords(index, heard)).toEqual(index.search(heard));
  });
});
