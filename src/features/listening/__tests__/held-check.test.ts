import type { HeldCheck, SpeechEngine } from '@/domain/listening';
import { createVerseIndex } from '@/domain/recognition';
import { IMLAEI_SAMPLE } from '@/domain/recognition/__fixtures__/imlaei-sample';
import { UTHMANI_SAMPLE } from '@/domain/recognition/__fixtures__/uthmani-sample';

import { checkHeardWords, type HeldTexts } from '../held-check';

const index = createVerseIndex(UTHMANI_SAMPLE);
const texts: HeldTexts = {
  text: ({ surah, verse }) =>
    IMLAEI_SAMPLE.find((v) => v.surah === surah && v.verse === verse)?.text,
  verseCount: (surah) => UTHMANI_SAMPLE.filter((v) => v.surah === surah).length,
};
const SURAH_112 = 'قُلْ هُوَ اللَّهُ أَحَدٌ اللَّهُ الصَّمَدُ';

function engineWith(answer: (texts: readonly string[]) => HeldCheck['readings']): {
  engine: SpeechEngine;
  calls: { texts: readonly string[]; same: boolean }[];
} {
  const calls: { texts: readonly string[]; same: boolean }[] = [];
  const audio = new Int16Array(4);
  const engine = {
    checkHeard: async (held: readonly string[], sameAudioAs?: HeldCheck) => {
      calls.push({ texts: held, same: sameAudioAs?.audio === audio });
      return { readings: answer(held), freeText: 'كلام غير مفهوم', audio };
    },
  } as unknown as SpeechEngine;
  return { engine, calls };
}

describe('checkHeardWords', () => {
  it('reads the same audio held to the whole Quran when the words propose nothing usable', async () => {
    const { engine, calls } = engineWith((held) =>
      held.map((text) =>
        text.includes('\n1 1 ') && text.includes('\n114 ')
          ? // The whole Quran: the audio follows 112.
            { text: SURAH_112, cost: 6, letters: 20, freeLetters: 0, abandoned: false }
          : /^112 1 /m.test(text)
            ? { text: SURAH_112, cost: 3, letters: 20, freeLetters: 0, abandoned: false }
            : { text: 'نص', cost: 90, letters: 2, freeLetters: 0, abandoned: false },
      ),
    );
    // Words too misheard for the search to propose 112.
    const result = await checkHeardWords(engine, index, texts, ['سيارة', 'كبيرة', 'جميلة']);
    expect(result?.status).toBe('found');
    expect(result?.candidates[0]?.start).toMatchObject({ surah: 112 });
    // The whole Quran, then the passages its reading proposes, on the same audio.
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls.slice(1).every((call) => call.same)).toBe(true);
  });

  it('gives null when even the second chance stays unsure', async () => {
    const { engine } = engineWith((held) =>
      held.map(() => ({ text: 'نص', cost: 90, letters: 2, freeLetters: 0, abandoned: false })),
    );
    expect(await checkHeardWords(engine, index, texts, ['سيارة', 'كبيرة', 'جميلة'])).toBeNull();
  });
});
