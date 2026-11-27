import { createVerseIndex } from '../../recognition';
import { IMLAEI_SAMPLE } from '../../recognition/__fixtures__/imlaei-sample';
import { UTHMANI_SAMPLE } from '../../recognition/__fixtures__/uthmani-sample';
import {
  AUDIO_CHECK,
  audioCheckCandidates,
  decideByAudio,
  followUpCandidates,
  heldText,
  letterCount,
  minLettersFor,
  passageWords,
  wholeQuranText,
  type AudioCheckCandidate,
} from '../audio-check';
import type { HeldReading } from '../types';

const index = createVerseIndex(UTHMANI_SAMPLE);
const verseCount = (surah: number) => UTHMANI_SAMPLE.filter((v) => v.surah === surah).length;
const imlaei = ({ surah, verse }: { surah: number; verse: number }) =>
  IMLAEI_SAMPLE.find((v) => v.surah === surah && v.verse === verse)?.text;

const SURAH_112 = 'قُلْ هُوَ اللَّهُ أَحَدٌ اللَّهُ الصَّمَدُ لَمْ يَلِدْ وَلَمْ يُولَدْ';
/** 112 as an ordinary reader's free reading may come out: the search is not sure of it. */
const MISHEARD_112 = 'قَالُوا هُوَ اللَّهُ أَحَدٌ اللَّهُ الصَّمَدُ';

function reading(text: string, cost: number, extra: Partial<HeldReading> = {}): HeldReading {
  return { text, cost, letters: letterCount(text), freeLetters: 0, abandoned: false, ...extra };
}

function candidate(surah: number, from: number, to: number): AudioCheckCandidate {
  const ref = (verse: number) => ({ surah, verse, word: 1 });
  return {
    passage: { start: ref(from), end: ref(to), score: 0.5, confidence: 0.5 },
    first: { surah, verse: from },
    last: { surah, verse: to },
  };
}

describe('audioCheckCandidates', () => {
  it('proposes the passages the search ranks, a verse around each, none overlapping', () => {
    const candidates = audioCheckCandidates(index, MISHEARD_112.split(' '), verseCount);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThanOrEqual(AUDIO_CHECK.maxCandidates);
    const first = candidates[0]!;
    expect(first.first.surah).toBe(112);
    expect(first.first.verse).toBe(1);
    expect(first.last.verse).toBeLessThanOrEqual(4);
    for (const [i, a] of candidates.entries()) {
      for (const b of candidates.slice(i + 1)) {
        const apart =
          a.last.surah * 1000 + a.last.verse < b.first.surah * 1000 + b.first.verse ||
          b.last.surah * 1000 + b.last.verse < a.first.surah * 1000 + a.first.verse;
        expect(apart).toBe(true);
      }
    }
  });

  it('proposes nothing for too few words', () => {
    expect(audioCheckCandidates(index, ['قُلْ'], verseCount)).toEqual([]);
  });
});

describe('heldText', () => {
  it('writes the opening formulas, then one line per verse, in imla’i spelling', () => {
    const text = heldText(candidate(112, 1, 2), imlaei);
    const lines = text.split('\n');
    expect(lines.slice(0, AUDIO_CHECK.formulas.length)).toEqual(
      AUDIO_CHECK.formulas.map((f) => `formula ${f}`),
    );
    expect(lines.slice(AUDIO_CHECK.formulas.length)).toEqual([
      `112 1 ${imlaei({ surah: 112, verse: 1 })}`,
      `112 2 ${imlaei({ surah: 112, verse: 2 })}`,
    ]);
  });

  it('stops at the end of the surah', () => {
    const lines = heldText(candidate(112, 3, 9), imlaei).split('\n');
    expect(lines.filter((line) => line.startsWith('112 '))).toHaveLength(2);
  });
});

describe('letters', () => {
  it('counts Arabic letters only, as the native side does', () => {
    expect(letterCount('قُلْ هُوَ')).toBe(4);
    expect(minLettersFor('قُلْ هُوَ اللَّهُ أَحَدٌ')).toBe(Math.floor(11 * AUDIO_CHECK.minLetterShare));
  });

  it('leaves out the free words at the start of a reading', () => {
    expect(passageWords(reading('قَالُوا أَحَدٌ اللَّهُ', 3, { freeLetters: 5 }))).toEqual(['أَحَدٌ', 'اللَّهُ']);
  });
});

describe('decideByAudio', () => {
  const right = candidate(112, 1, 4);
  const other = candidate(113, 1, 5);

  it('names the cheap passage when every other one costs far more', () => {
    const decision = decideByAudio(
      index,
      [right, other],
      [reading(SURAH_112, 4), reading('قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ', 80)],
      MISHEARD_112,
    );
    expect(decision.status).toBe('found');
    if (decision.status !== 'found') return;
    expect(decision.candidate).toBe(right);
    expect(decision.result.status).toBe('found');
    expect(decision.result.candidates[0]?.start).toMatchObject({ surah: 112, verse: 1 });
  });

  it('is unsure when another passage costs nearly as little', () => {
    const decision = decideByAudio(
      index,
      [right, other],
      [reading(SURAH_112, 4), reading('قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ', 4 + AUDIO_CHECK.minLead - 1)],
      MISHEARD_112,
    );
    expect(decision.status).toBe('unsure');
  });

  it('is unsure when even the best reading had to be forced on the audio', () => {
    const tooMuch =
      AUDIO_CHECK.maxCostBase + AUDIO_CHECK.maxCostPerLetter * letterCount(MISHEARD_112);
    const decision = decideByAudio(index, [right], [reading(SURAH_112, tooMuch + 1)], MISHEARD_112);
    expect(decision.status).toBe('unsure');
  });

  it('counts a reading stopped early as far enough behind', () => {
    const decision = decideByAudio(
      index,
      [right, other],
      [reading(SURAH_112, 4), reading('', 44, { abandoned: true })],
      MISHEARD_112,
    );
    expect(decision.status).toBe('found');
  });

  it('is unsure when the words of the best reading are said in several places', () => {
    // "قُلْ أَعُوذُ بِرَبِّ" opens both 113 and 114: the reading cannot tell them apart.
    const decision = decideByAudio(index, [other], [reading('قُلْ أَعُوذُ بِرَبِّ', 1)], 'قُلْ أَعُوذُ بِرَبِّ');
    expect(decision.status).toBe('unsure');
  });

  it('is unsure when the reading names another place than its candidate', () => {
    const decision = decideByAudio(index, [other], [reading(SURAH_112, 1)], SURAH_112);
    expect(decision.status).toBe('unsure');
  });

  it('is unsure without readings for every candidate', () => {
    expect(decideByAudio(index, [right, other], [reading(SURAH_112, 1)], SURAH_112).status).toBe(
      'unsure',
    );
    expect(decideByAudio(index, [], [], SURAH_112).status).toBe('unsure');
  });
});

describe('the second chance', () => {
  it('holds a reading to the whole Quran: the formulas, then every verse', () => {
    const lines = wholeQuranText(imlaei, verseCount).split('\n');
    expect(lines[0]).toBe(`formula ${AUDIO_CHECK.formulas[0]}`);
    expect(lines).toContain(`112 4 ${imlaei({ surah: 112, verse: 4 })}`);
    expect(lines.filter((line) => line.startsWith('112 '))).toHaveLength(4);
  });

  it('proposes the passages of the whole-Quran reading not read already', () => {
    const fromWhole = reading(SURAH_112, 20);
    expect(followUpCandidates(index, fromWhole, [], verseCount)[0]?.first).toEqual({
      surah: 112,
      verse: 1,
    });
    expect(followUpCandidates(index, fromWhole, [candidate(112, 1, 4)], verseCount)).toEqual([]);
  });
});
