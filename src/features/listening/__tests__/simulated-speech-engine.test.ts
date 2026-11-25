import type { SpeechEndReason } from '@/domain/listening';

import {
  createSimulatedSpeechEngine,
  recitationSteps,
  type SimulatedScript,
} from '../simulated/simulated-speech-engine';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

/** Listens to everything an engine says, in order. */
function record(engine: ReturnType<typeof createSimulatedSpeechEngine>) {
  const events: string[] = [];
  engine.onLevel((level) => events.push(`level ${level}`));
  engine.onWords((words) => events.push(`words ${words.join(' ')}`));
  engine.onEnd((reason: SpeechEndReason) => events.push(`end ${reason}`));
  return events;
}

const SCRIPT: SimulatedScript = {
  permission: 'granted',
  steps: [
    { at: 100, level: 0.6 },
    { at: 200, words: ['قل', 'هو'] },
    { at: 300, end: 'finished' },
  ],
};

describe('the simulated engine', () => {
  it('replays the levels, the words and the end of its script, in time, once started', async () => {
    const engine = createSimulatedSpeechEngine(SCRIPT);
    const events = record(engine);
    await engine.start();
    jest.advanceTimersByTime(150);
    expect(events).toEqual(['level 0.6']);
    jest.advanceTimersByTime(200);
    expect(events).toEqual(['level 0.6', 'words قل هو', 'end finished']);
  });

  it('says nothing before it is started', () => {
    const engine = createSimulatedSpeechEngine(SCRIPT);
    const events = record(engine);
    jest.advanceTimersByTime(1000);
    expect(events).toEqual([]);
  });

  it('says nothing more once stopped, and no end for a stop', async () => {
    const engine = createSimulatedSpeechEngine(SCRIPT);
    const events = record(engine);
    await engine.start();
    jest.advanceTimersByTime(150);
    await engine.stop();
    jest.advanceTimersByTime(1000);
    expect(events).toEqual(['level 0.6']);
  });

  it('stops being heard by a listener that unsubscribed', async () => {
    const engine = createSimulatedSpeechEngine(SCRIPT);
    const levels: number[] = [];
    const unsubscribe = engine.onLevel((level) => levels.push(level));
    unsubscribe();
    unsubscribe();
    await engine.start();
    jest.advanceTimersByTime(1000);
    expect(levels).toEqual([]);
  });

  it('asks for the microphone once, and keeps the answer of its script', async () => {
    const engine = createSimulatedSpeechEngine({ ...SCRIPT, permission: 'undetermined' });
    expect(await engine.getMicrophonePermission()).toBe('undetermined');
    expect(await engine.requestMicrophonePermission()).toBe('granted');
    expect(await engine.getMicrophonePermission()).toBe('granted');
  });

  it('can be refused the microphone, and then refuses to start', async () => {
    const engine = createSimulatedSpeechEngine({
      ...SCRIPT,
      permission: 'undetermined',
      answer: 'denied',
    });
    expect(await engine.requestMicrophonePermission()).toBe('denied');
    await expect(engine.start()).rejects.toThrow(/microphone/i);
  });

  it('can fail to start, as a broken engine would', async () => {
    const engine = createSimulatedSpeechEngine({ ...SCRIPT, startFails: true });
    await expect(engine.start()).rejects.toThrow();
  });

  it('starts its script again from the beginning on every start', async () => {
    const engine = createSimulatedSpeechEngine(SCRIPT);
    const events = record(engine);
    await engine.start();
    jest.advanceTimersByTime(1000);
    await engine.start();
    jest.advanceTimersByTime(1000);
    expect(events.filter((event) => event.startsWith('words'))).toHaveLength(2);
  });

  it('replays a looping script until it is stopped', async () => {
    const engine = createSimulatedSpeechEngine({
      permission: 'granted',
      steps: [{ at: 0, level: 0.5 }],
      loopEvery: 1000,
    });
    const events = record(engine);
    await engine.start();
    jest.advanceTimersByTime(3500);
    expect(events).toHaveLength(4);
    await engine.stop();
    jest.advanceTimersByTime(3000);
    expect(events).toHaveLength(4);
  });

  it('refuses a level outside 0 to 1 in its script', () => {
    expect(() =>
      createSimulatedSpeechEngine({ permission: 'granted', steps: [{ at: 0, level: 1.2 }] }),
    ).toThrow(RangeError);
  });

  it('refuses a looping script that ends', () => {
    expect(() =>
      createSimulatedSpeechEngine({
        permission: 'granted',
        steps: [{ at: 0, end: 'finished' }],
        loopEvery: 1000,
      }),
    ).toThrow(RangeError);
  });
});

describe('a simulated recitation', () => {
  const WORDS = ['الحمد', 'لله', 'رب', 'العالمين'];

  it('gives every word once, in order, each after the voice said it', () => {
    const steps = recitationSteps(WORDS, { startAt: 500, seed: 7 });
    const words = steps.flatMap((step) => ('words' in step ? step.words : []));
    expect(words).toEqual(WORDS);
    const firstLevel = steps.find((step) => 'level' in step);
    const firstWords = steps.find((step) => 'words' in step);
    expect(firstLevel?.at).toBeGreaterThanOrEqual(500);
    expect(firstWords?.at).toBeGreaterThan(firstLevel?.at ?? Infinity);
  });

  it('is the same for the same seed, so tests and trials can be replayed', () => {
    expect(recitationSteps(WORDS, { startAt: 0, seed: 3 })).toEqual(
      recitationSteps(WORDS, { startAt: 0, seed: 3 }),
    );
  });

  it('keeps every level between 0 and 1, in time order', () => {
    const steps = recitationSteps(WORDS, { startAt: 0, seed: 11 });
    for (const step of steps) {
      if ('level' in step) {
        expect(step.level).toBeGreaterThanOrEqual(0);
        expect(step.level).toBeLessThanOrEqual(1);
      }
    }
    const times = steps.map((step) => step.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});
