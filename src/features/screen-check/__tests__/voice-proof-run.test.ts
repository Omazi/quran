import type { SpeechEngine, SpeechEndReason } from '@/domain/listening';
import { createVerseIndex } from '@/domain/recognition';

import { describeResult, proofClipOf, runVoiceProof, type ProofClip } from '../voice-proof-run';

describe('proofClipOf', () => {
  it('reads the passage a clip holds from its name', () => {
    expect(proofClipOf('faraj-2__83-1-3.wav', 'file:///d/faraj-2__83-1-3.wav')).toEqual({
      name: 'faraj-2__83-1-3.wav',
      path: 'file:///d/faraj-2__83-1-3.wav',
      surah: 83,
      firstVerse: 1,
      lastVerse: 3,
    });
  });

  it('ignores any other file', () => {
    expect(proofClipOf('notes.txt', '/x')).toBeNull();
    expect(proofClipOf('a__83-1-3.mp3', '/x')).toBeNull();
    expect(proofClipOf('a__115-1-3.wav', '/x')).toBeNull();
    expect(proofClipOf('a__83-3-1.wav', '/x')).toBeNull();
    expect(proofClipOf('../a__83-1-3.wav', '/x')).toBeNull();
  });
});

/** An engine that gives `words` in batches, then ends. */
function scriptedEngine(
  batches: readonly string[][],
  onReading: (ms: number) => void,
  checkHeard?: SpeechEngine['checkHeard'],
): SpeechEngine {
  const wordListeners: ((words: readonly string[]) => void)[] = [];
  const endListeners: ((reason: SpeechEndReason) => void)[] = [];
  let stopped = false;
  return {
    getMicrophonePermission: async () => 'granted',
    requestMicrophonePermission: async () => 'granted',
    async start() {
      setTimeout(() => {
        for (const batch of batches) {
          if (stopped) return;
          onReading(300);
          for (const listener of wordListeners) listener(batch);
        }
        if (!stopped) for (const listener of endListeners) listener('finished');
      }, 0);
    },
    async stop() {
      stopped = true;
    },
    onLevel: () => () => undefined,
    onWords: (listener) => {
      wordListeners.push(listener);
      return () => undefined;
    },
    onEnd: (listener) => {
      endListeners.push(listener);
      return () => undefined;
    },
    ...(checkHeard === undefined ? {} : { checkHeard }),
  };
}

describe('runVoiceProof', () => {
  const index = createVerseIndex([
    { surah: 112, verse: 1, text: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ' },
    { surah: 112, verse: 2, text: 'ٱللَّهُ ٱلصَّمَدُ' },
    { surah: 112, verse: 3, text: 'لَمْ يَلِدْ وَلَمْ يُولَدْ' },
    { surah: 112, verse: 4, text: 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ' },
    { surah: 113, verse: 1, text: 'قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ' },
    { surah: 113, verse: 2, text: 'مِن شَرِّ مَا خَلَقَ' },
  ]);
  const clip = (name: string): ProofClip => proofClipOf(name, `/d/${name}`)!;

  it('writes one line per clip, the passage found, and DONE with the count', async () => {
    const lines: string[] = [];
    let clock = 0;
    const results = await runVoiceProof({
      clips: [clip('a__112-1-4.wav'), clip('b__113-1-2.wav')],
      loadIndex: async () => index,
      createEngine: (c, onReading) =>
        c.surah === 112
          ? scriptedEngine(
              [
                ['قل', 'هو'],
                ['الله', 'احد', 'الله', 'الصمد'],
              ],
              onReading,
            )
          : scriptedEngine([['ما']], onReading),
      now: () => (clock += 1000),
      log: (line) => lines.push(line),
    });
    expect(results[0]?.found?.start).toMatchObject({ surah: 112, verse: 1 });
    expect(lines[0]).toBe('voice-proof: start, 2 clips');
    expect(lines[1]).toMatch(/a__112-1-4\.wav expected 112:1-4 \| found 112:1-112:/);
    expect(lines[1]).toMatch(/2 readings, median 300 ms/);
    expect(lines[1]).toMatch(/\| OK$/);
    expect(lines[2]).toMatch(
      /b__113-1-2\.wav .*nothing found \(1 words heard\).*finished \| MISS$/,
    );
    expect(lines[3]).toBe('voice-proof: DONE right 1/2, wrong 0');
  });

  it('runs the audio check when the words alone name nothing, and says so', async () => {
    const lines: string[] = [];
    const texts = {
      text: ({ surah, verse }: { surah: number; verse: number }) =>
        surah === 112
          ? ['قل هو الله أحد', 'الله الصمد', 'لم يلد ولم يولد', 'ولم يكن له كفوا أحد'][verse - 1]
          : 'قل أعوذ برب الفلق',
      verseCount: (surah: number) => (surah === 112 ? 4 : 2),
    };
    let onHeld: (ms: number) => void = () => undefined;
    // Held to 112, the audio costs little; held to anything else, a lot.
    const checkHeard = jest.fn(async (held: readonly string[]) => {
      onHeld(900);
      return {
        freeText: 'قالوا هو الله',
        readings: held.map((text) =>
          /^112 1 /m.test(text)
            ? {
                text: 'قُلْ هُوَ اللَّهُ أَحَدٌ اللَّهُ الصَّمَدُ',
                cost: 2,
                letters: 20,
                freeLetters: 0,
                abandoned: false,
              }
            : { text: 'قُلْ', cost: 90, letters: 2, freeLetters: 0, abandoned: false },
        ),
      };
    });
    const results = await runVoiceProof({
      clips: [clip('a__112-1-4.wav')],
      loadIndex: async () => index,
      loadHeldTexts: async () => texts,
      createEngine: (_c, onReading, onHeldReading) => {
        onHeld = onHeldReading;
        return scriptedEngine([['قالوا', 'هو', 'الله']], onReading, checkHeard);
      },
      now: () => 0,
      log: (line) => lines.push(line),
    });
    expect(checkHeard).toHaveBeenCalled();
    expect(results[0]?.byCheck).toBe(true);
    expect(lines[1]).toMatch(/1 audio checks, max 900 ms, answer by the check/);
    expect(lines[1]).toMatch(/\| OK$/);
  });

  it('says WRONG when another passage is announced', () => {
    const line = describeResult({
      clip: clip('c__113-1-2.wav'),
      found: {
        start: { surah: 112, verse: 1, word: 0 },
        end: { surah: 112, verse: 2, word: 1 },
      } as never,
      foundAtMs: 2500,
      words: 5,
      readingsMs: [],
      ending: 'stopped at the answer',
    });
    expect(line).toMatch(/found 112:1-112:2 at 2\.5 s after 5 words \| no reading .*\| WRONG$/);
  });
});
