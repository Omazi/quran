/**
 * The passage search on what Whisper typically writes for three verses everyone recites:
 * Al-Fatiha, Al-Ikhlas and Ayat al-Kursi. Whisper writes plain spelling, sometimes with vowels,
 * often without hamza, and mixes the endings ة / ه and ى / ي; tiny drops or bends a word now and
 * then. Each passage must be found, at the right place, as the words arrive one by one, and
 * never another one. Needs the generated Uthmani text; skipped without it.
 */
import { createVerseIndex, normalizeArabic, type VerseIndex } from '../../recognition';
import { loadUthmaniCorpus } from '../../recognition/test-support/corpus';
import { searchHeardWords } from '../heard-search';

describe('the spellings Whisper writes are the words of the Quran', () => {
  const same = (heard: string, quran: string) =>
    expect(normalizeArabic(heard)).toEqual(normalizeArabic(quran));

  it('with or without vowels', () => same('بسم الله الرحمن الرحيم', 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ'));
  it('with any alef or hamza form', () => {
    same('احد', 'أَحَدٌ');
    same('إياك', 'إِيَّاكَ');
    same('اياك', 'إِيَّاكَ');
  });
  it('with ه for ة, and ي for ى', () => {
    same('سنه', 'سِنَةٞ');
    same('عليم', 'عَلِيمٌ');
    same('الذي', 'ٱلَّذِى');
  });
  it('with the long a written in full where the Uthmani script only marks it', () => {
    same('العالمين', 'ٱلۡعَٰلَمِينَ');
    same('السماوات', 'ٱلسَّمَٰوَٰتِ');
  });
});

const uthmani = loadUthmaniCorpus();
const describeWithCorpus = uthmani === null ? describe.skip : describe;

/** What the screen shows: the first `found` while the words arrive, or null. */
function firstFound(index: VerseIndex, heard: readonly string[]) {
  for (let count = 1; count <= heard.length; count += 1) {
    const result = searchHeardWords(index, heard.slice(0, count));
    if (result.status === 'found') return { ...result.candidates[0]!.start, after: count };
  }
  return null;
}

/** Typical Whisper output, each with the kind of mistake it makes. */
const RECITATIONS = [
  {
    name: 'Al-Fatiha 1:2–4, without vowels or hamza',
    heard: 'الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين',
    surah: 1,
    verses: [2, 4],
  },
  {
    name: 'Al-Fatiha 1:5–7, a word bent (نستعين → نستعن)',
    heard: 'اياك نعبد واياك نستعن اهدنا الصراط المستقيم صراط الذين انعمت عليهم',
    surah: 1,
    verses: [5, 7],
  },
  {
    name: 'Al-Ikhlas 112:1–4, with vowels as Whisper sometimes writes them',
    heard: 'قُلْ هُوَ اللَّهُ أَحَدٌ اللَّهُ الصَّمَدُ لَمْ يَلِدْ وَلَمْ يُولَدْ',
    surah: 112,
    verses: [1, 3],
  },
  {
    name: 'Al-Ikhlas, a word dropped (أحد) and the end of verse 4',
    heard: 'قل هو الله الله الصمد لم يلد ولم يولد ولم يكن له كفوا احد',
    surah: 112,
    verses: [1, 4],
  },
  {
    name: 'Ayat al-Kursi 2:255, ة written ه, no hamza (تاخذه, اله, الارض)',
    heard: 'الله لا اله الا هو الحي القيوم لا تاخذه سنه ولا نوم له ما في السماوات وما في الارض',
    surah: 2,
    verses: [255, 255],
  },
  {
    name: 'Ayat al-Kursi, from its middle, a word mangled (يشفع → يشفا)',
    heard: 'من ذا الذي يشفا عنده الا باذنه يعلم ما بين ايديهم وما خلفهم',
    surah: 2,
    verses: [255, 255],
  },
] as const;

describeWithCorpus('three verses everyone recites, as Whisper writes them', () => {
  let index: VerseIndex;
  beforeAll(() => {
    index = createVerseIndex(uthmani ?? []);
  });

  it.each(RECITATIONS)('$name: found, at the right place', ({ heard, surah, verses }) => {
    const found = firstFound(index, heard.split(' '));
    expect(found).not.toBeNull();
    expect(found).toMatchObject({ surah });
    expect(found!.verse).toBeGreaterThanOrEqual(verses[0]);
    expect(found!.verse).toBeLessThanOrEqual(verses[1]);
  });

  it('Whisper writing over silence (one stray word) names no passage', () => {
    expect(firstFound(index, ['الله'])).toBeNull();
    expect(firstFound(index, ['و'])).toBeNull();
  });
});
