import { act, renderHook } from '@testing-library/react-native';

import type { SpeechEngine } from '@/domain/listening';
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
  return await renderHook(() => useListening({ engine, loadVerseIndex: load }));
}

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
    });
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
