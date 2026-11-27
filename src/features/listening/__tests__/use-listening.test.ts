import { act, renderHook } from '@testing-library/react-native';

import {
  SpeechEngineError,
  type SpeechActivity,
  type SpeechEndReason,
  type SpeechEngine,
  type SpeechFailure,
} from '@/domain/listening';
import type { VerseIndex } from '@/domain/recognition';

import { createScenarioEngine } from '../simulated/scenarios';
import { createSimulatedSpeechEngine, recitationSteps } from '../simulated/simulated-speech-engine';
import { useListening } from '../use-listening';
import { loadQuranVerseIndex } from '../verse-index-source';

let index: VerseIndex;

beforeAll(async () => {
  // Built once with real timers: the whole Quran, as the app builds it.
  index = await loadQuranVerseIndex();
});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const loadVerseIndex = () => Promise.resolve(index);

/** Lets promises settle, then moves the clock on. */
async function wait(milliseconds: number) {
  await act(async () => {
    for (let elapsed = 0; elapsed < milliseconds; elapsed += 100) {
      jest.advanceTimersByTime(100);
      await Promise.resolve();
      await Promise.resolve();
    }
  });
}

async function listenWith(engine: SpeechEngine, load = loadVerseIndex) {
  return await renderHook(() => useListening({ engine, loadVerseIndex: load, autoStart: true }));
}

describe('a listening opened by a link', () => {
  it('does not open the microphone until it is asked to', async () => {
    const engine = createScenarioEngine('found');
    const start = jest.spyOn(engine, 'start');
    const { result } = await renderHook(() =>
      useListening({ engine, loadVerseIndex, autoStart: false }),
    );
    await wait(1000);
    expect(start).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe('idle');
    await act(async () => result.current.listenAgain());
    await wait(100);
    expect(start).toHaveBeenCalledTimes(1);
  });
});

describe('a listening, with the simulated engine and the real passage search', () => {
  it('voice then a single passage: found, and the microphone is closed at once', async () => {
    const engine = createScenarioEngine('found');
    const stop = jest.spyOn(engine, 'stop');
    const { result } = await listenWith(engine);
    await wait(100);
    expect(result.current.state.status).toBe('listening');
    await wait(20000);
    expect(result.current.state).toMatchObject({
      status: 'found',
      passage: { start: { surah: 2, verse: 255 } },
    });
    expect(stop).toHaveBeenCalled();
  });

  it('an ambiguous passage: every tied place, in the order of the mushaf', async () => {
    const { result } = await listenWith(createScenarioEngine('several'));
    await wait(20000);
    const { state } = result.current;
    expect(state.status).toBe('ambiguous');
    if (state.status !== 'ambiguous') return;
    expect(state.passages.candidates.map((passage) => passage.start.surah)).toEqual([
      1, 6, 10, 37, 39, 40,
    ]);
    expect(state.passages.isComplete).toBe(true);
  });

  it('a passage recited after words too noisy to place: found by its latest words', async () => {
    // What a transcription of an ordinary reader can look like: a mangled opening, then 112:1–4.
    const noisy = 'سيارة كبيرة جميلة حمراء سريعة جديدة قديمة غالية رخيصة واسعة نظيفة'.split(' ');
    const surah112 = 'قل هو الله أحد الله الصمد لم يلد ولم يولد'.split(' ');
    const steps = recitationSteps([...noisy, ...surah112], { startAt: 500, seed: 3 });
    const engine = createSimulatedSpeechEngine({
      permission: 'granted',
      steps: [...steps, { at: (steps[steps.length - 1]?.at ?? 0) + 1500, end: 'finished' }],
    });
    const { result } = await listenWith(engine);
    await wait(60000);
    expect(result.current.state).toMatchObject({
      status: 'found',
      passage: { start: { surah: 112, verse: 1 } },
    });
  });

  it('words that are not from the Quran: nothing found, and why', async () => {
    const { result } = await listenWith(createScenarioEngine('nothing'));
    await wait(20000);
    expect(result.current.state).toEqual({ status: 'not-found', reason: 'no-match' });
  });

  it('nothing said before the engine ends: nothing heard', async () => {
    const { result } = await listenWith(createScenarioEngine('silence'));
    await wait(8000);
    expect(result.current.state).toEqual({ status: 'not-found', reason: 'nothing-heard' });
  });

  it('asks for the microphone, and says so when it is refused', async () => {
    const engine = createScenarioEngine('denied');
    const request = jest.spyOn(engine, 'requestMicrophonePermission');
    const start = jest.spyOn(engine, 'start');
    const { result } = await listenWith(engine);
    await wait(100);
    expect(request).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe('microphone-denied');
  });

  it('does not ask again once the person already said yes', async () => {
    const engine = createSimulatedSpeechEngine({ permission: 'granted', steps: [] });
    const request = jest.spyOn(engine, 'requestMicrophonePermission');
    await listenWith(engine);
    await wait(100);
    expect(request).not.toHaveBeenCalled();
  });

  it('an engine that cannot start: failed', async () => {
    const { result } = await listenWith(createScenarioEngine('failed'));
    await wait(100);
    expect(result.current.state.status).toBe('failed');
  });

  it('a passage search that cannot be built: failed, never a guess', async () => {
    const engine = createScenarioEngine('found');
    const { result } = await listenWith(engine, () => Promise.reject(new Error('no text')));
    await wait(20000);
    expect(result.current.state.status).toBe('failed');
  });

  it('words heard before the search is ready are searched once it is', async () => {
    let finish: (value: VerseIndex) => void = () => undefined;
    const slow = new Promise<VerseIndex>((resolve) => {
      finish = resolve;
    });
    const engine = createSimulatedSpeechEngine({
      permission: 'granted',
      steps: recitationSteps('قل هو الله أحد'.split(' '), { startAt: 0, seed: 1 }),
    });
    const { result } = await listenWith(engine, () => slow);
    await wait(10000);
    expect(result.current.state.status).toBe('listening');
    await act(async () => finish(index));
    expect(result.current.state).toMatchObject({
      status: 'found',
      passage: { start: { surah: 112, verse: 1 } },
    });
  });

  it('stop before a word: the screen closes, and the microphone with it', async () => {
    const engine = createScenarioEngine('found');
    const stop = jest.spyOn(engine, 'stop');
    const { result } = await listenWith(engine);
    await wait(500);
    await act(async () => result.current.stop());
    expect(result.current.state.status).toBe('closed');
    expect(stop).toHaveBeenCalled();
  });

  it('stop after a shared beginning: the places it fits, not a guess', async () => {
    const { result } = await listenWith(createScenarioEngine('several'));
    // The four words are said by then; the engine has not ended yet.
    await wait(4800);
    await act(async () => result.current.stop());
    expect(result.current.state.status).toBe('ambiguous');
  });

  it('listens again from nothing after a result', async () => {
    const engine = createScenarioEngine('nothing');
    const { result } = await listenWith(engine);
    await wait(20000);
    expect(result.current.state.status).toBe('not-found');
    await act(async () => result.current.listenAgain());
    await wait(100);
    expect(result.current.state).toEqual({
      status: 'listening',
      heardWordCount: 0,
      latestResult: null,
      voice: false,
      transcribing: false,
      partial: [],
    });
    expect(result.current.heardWords).toEqual([]);
  });

  it('closes the microphone when the screen goes away', async () => {
    const engine = createScenarioEngine('listening');
    const stop = jest.spyOn(engine, 'stop');
    const { unmount } = await listenWith(engine);
    await wait(500);
    await unmount();
    expect(stop).toHaveBeenCalled();
  });
});

/** An engine driven by the test: what it hears, what it does and how it ends. */
function handEngine(startError?: Error) {
  const activity = new Set<(activity: SpeechActivity) => void>();
  const words = new Set<(words: readonly string[]) => void>();
  const ends = new Set<(reason: SpeechEndReason, failure?: SpeechFailure) => void>();
  const listen =
    <Listener>(set: Set<Listener>) =>
    (listener: Listener) => {
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    };
  const engine: SpeechEngine = {
    getMicrophonePermission: async () => 'granted',
    requestMicrophonePermission: async () => 'granted',
    start: async () => {
      if (startError !== undefined) throw startError;
    },
    stop: async () => undefined,
    onLevel: () => () => undefined,
    onWords: listen(words),
    onEnd: listen(ends),
    onActivity: listen(activity),
  };
  return {
    engine,
    act: (change: Partial<SpeechActivity>) => {
      for (const listener of activity) {
        listener({ voice: false, transcribing: false, partial: [], ...change });
      }
    },
    hear: (heard: readonly string[]) => {
      for (const listener of words) listener(heard);
    },
    end: (reason: SpeechEndReason, failure?: SpeechFailure) => {
      for (const listener of ends) listener(reason, failure);
    },
  };
}

describe('what the person sees while the engine works', () => {
  it('the voice heard, then the words not final yet, then the final ones', async () => {
    const hand = handEngine();
    const { result } = await listenWith(hand.engine);
    await wait(100);
    expect(result.current.state).toMatchObject({ status: 'listening', voice: false });
    await act(async () => hand.act({ voice: true }));
    expect(result.current.state).toMatchObject({ voice: true });
    await act(async () => hand.act({ transcribing: true, partial: ['قل', 'هو'] }));
    expect(result.current.heardWords).toEqual(['قل', 'هو']);
    await act(async () => hand.hear(['قل', 'هو']));
    await wait(100);
    await act(async () => hand.act({ partial: ['الله'] }));
    expect(result.current.heardWords).toEqual(['قل', 'هو', 'الله']);
  });

  it('the words not final yet are searched too: a passage they complete is found at once (D45)', async () => {
    const hand = handEngine();
    const { result } = await listenWith(hand.engine);
    await wait(100);
    await act(async () => hand.hear(['ايه', 'الكرسي']));
    await wait(100);
    expect(result.current.state).toMatchObject({ status: 'listening' });
    // Ayat al-Kursi's opening, still being read: not final, yet the passage is certain.
    await act(async () =>
      hand.act({ partial: 'الله لا اله الا هو الحي القيوم لا تاخذه سنه'.split(' ') }),
    );
    await wait(100);
    expect(result.current.state).toMatchObject({
      status: 'found',
      passage: { start: { surah: 2, verse: 255 } },
    });
  });

  it('words not final yet that find nothing change nothing', async () => {
    const hand = handEngine();
    const { result } = await listenWith(hand.engine);
    await wait(100);
    await act(async () => hand.act({ partial: ['قل', 'هو'] }));
    await wait(100);
    expect(result.current.state).toMatchObject({ status: 'listening', heardWordCount: 0 });
    await act(async () => hand.hear(['قل']));
    await wait(100);
    expect(result.current.state).toMatchObject({ status: 'listening', heardWordCount: 1 });
  });

  it('a start refused with a reason: failed, with that reason', async () => {
    const hand = handEngine(new SpeechEngineError('model-missing', 'not in the app'));
    const { result } = await listenWith(hand.engine);
    await wait(100);
    expect(result.current.state).toEqual({ status: 'failed', failure: 'model-missing' });
  });

  it('an engine that breaks while listening: failed, with what broke', async () => {
    const hand = handEngine();
    const { result } = await listenWith(hand.engine);
    await wait(100);
    await act(async () => hand.end('failed', 'no-audio'));
    await wait(100);
    expect(result.current.state).toEqual({ status: 'failed', failure: 'no-audio' });
  });

  it('a start that fails without saying why: failed, unknown', async () => {
    const hand = handEngine(new Error('something'));
    const { result } = await listenWith(hand.engine);
    await wait(100);
    expect(result.current.state).toEqual({ status: 'failed', failure: 'unknown' });
  });
});

describe('the audio check (D47)', () => {
  /**
   * 83:2–3 as Whisper read an ordinary reader of the voice benchmark (faraj-64): the words alone
   * name no passage.
   */
  const MISHEARD = 'وَلَيُوعَدَ النَّاحِ يَخْتَوْا فُونَ وَإِذَا كَالُوهُمْ أَوَّزَنُهُمْ يُخْفِرُونَ'.split(' ');
  const HELD_83 = 'النَّاسِ يَسْتَوْفُونَ وَإِذَا كَالُوهُمْ أَوْ وَزَنُوهُمْ يُخْسِرُونَ';
  const SURAH_83 = [
    'ويل للمطففين',
    'الذين إذا اكتالوا على الناس يستوفون',
    'وإذا كالوهم أو وزنوهم يخسرون',
    'ألا يظن أولئك أنهم مبعوثون',
  ];
  const texts = {
    text: ({ surah, verse }: { surah: number; verse: number }) =>
      surah === 83 ? SURAH_83[verse - 1] : 'نص',
    verseCount: (surah: number) => (surah === 83 ? 4 : 7),
  };

  /** Stable, as the screen's loader is (a new function each render would restart the hook). */
  const loadHeldTexts = async () => texts;

  function checkedEngine(endAfterWords: boolean) {
    const checkHeard = jest.fn(async (held: readonly string[]) => ({
      freeText: MISHEARD.join(' '),
      // Held to 83, the audio costs little; held to anything else, a lot.
      readings: held.map((text) =>
        /^83 [1-4] /m.test(text)
          ? { text: HELD_83, cost: 3, letters: 33, freeLetters: 0, abandoned: false }
          : { text: 'نص', cost: 90, letters: 2, freeLetters: 0, abandoned: false },
      ),
    }));
    const steps = recitationSteps(MISHEARD, { startAt: 200, seed: 3 });
    const last = steps[steps.length - 1]!.at;
    const simulated = createSimulatedSpeechEngine({
      permission: 'granted',
      steps: endAfterWords ? [...steps, { at: last + 500, end: 'finished' }] : steps,
    });
    const engine: SpeechEngine = { ...simulated, checkHeard };
    return { engine, checkHeard };
  }

  it('names the passage the audio says when the words alone do not', async () => {
    expect(index.search(MISHEARD).status).not.toBe('found');
    const { engine, checkHeard } = checkedEngine(false);
    const { result } = await renderHook(() =>
      useListening({
        engine,
        loadVerseIndex,
        autoStart: true,
        loadHeldTexts,
      }),
    );
    await wait(20000);
    expect(checkHeard).toHaveBeenCalled();
    expect(result.current.state).toMatchObject({
      status: 'found',
      passage: { start: { surah: 83 } },
    });
  });

  it('checks before saying nothing was found when the engine ends', async () => {
    const { engine, checkHeard } = checkedEngine(true);
    const { result } = await renderHook(() =>
      useListening({
        engine,
        loadVerseIndex,
        autoStart: true,
        loadHeldTexts,
      }),
    );
    await wait(20000);
    expect(checkHeard).toHaveBeenCalled();
    expect(result.current.state.status).toBe('found');
  });

  it('goes by the words alone without the imla’i texts', async () => {
    const { engine, checkHeard } = checkedEngine(true);
    const { result } = await renderHook(() =>
      useListening({ engine, loadVerseIndex, autoStart: true }),
    );
    await wait(20000);
    expect(checkHeard).not.toHaveBeenCalled();
    expect(result.current.state.status).not.toBe('found');
  });
});
