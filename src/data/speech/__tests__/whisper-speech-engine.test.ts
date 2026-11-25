import type { MicrophonePermission, SpeechEndReason } from '@/domain/listening';

import { SPEECH_ENGINE_CONFIG } from '../config';
import {
  createWhisperSpeechEngine,
  type AudioCapture,
  type AudioListeners,
  type Transcriber,
} from '../whisper-speech-engine';

const { chunkMs, sampleRate, passEveryMs, phraseEndSilenceMs } = SPEECH_ENGINE_CONFIG;
const SAMPLES_PER_CHUNK = (sampleRate * chunkMs) / 1000;

function voiceChunk(): Int16Array {
  const samples = new Int16Array(SAMPLES_PER_CHUNK);
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = Math.round(Math.sin((2 * Math.PI * 220 * i) / sampleRate) * 0.1 * 32767);
  }
  return samples;
}
const silentChunk = () => new Int16Array(SAMPLES_PER_CHUNK);

/** Lets the engine's promises run. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

interface FakeCapture extends AudioCapture {
  readonly isOpen: () => boolean;
  /** Sends `ms` of voice or silence, one chunk at a time, letting the engine work in between. */
  readonly feed: (kind: 'voice' | 'silence', ms: number) => Promise<void>;
  readonly endFromSystem: (reason: SpeechEndReason) => void;
  readonly stopCalls: () => number;
}

function fakeCapture(
  permission: MicrophonePermission = 'granted',
  answer: MicrophonePermission = 'granted',
): FakeCapture {
  let current = permission;
  let listeners: AudioListeners | null = null;
  let stops = 0;
  return {
    getPermission: async () => current,
    requestPermission: async () => {
      if (current === 'undetermined') current = answer;
      return current;
    },
    start: async (given) => {
      listeners = given;
    },
    stop: async () => {
      stops += 1;
      listeners = null;
    },
    isOpen: () => listeners !== null,
    feed: async (kind, ms) => {
      for (let elapsed = 0; elapsed < ms; elapsed += chunkMs) {
        listeners?.onAudio(kind === 'voice' ? voiceChunk() : silentChunk());
        await settle();
      }
    },
    endFromSystem: (reason) => listeners?.onEnd(reason),
    stopCalls: () => stops,
  };
}

const SURAH_112 = ['قُلْ', 'هُوَ', 'اللَّهُ', 'أَحَدٌ', 'اللَّهُ', 'الصَّمَدُ'];

/**
 * A transcriber that hears one word of 112:1–2 for every 400 ms of audio it is given, as Whisper
 * would on a recitation that grows. It records how much audio each pass received.
 */
function fakeTranscriber(words: readonly string[] = SURAH_112) {
  const passes: number[] = [];
  const transcriber: Transcriber & { passes: number[] } = {
    passes,
    prepare: jest.fn(async () => undefined),
    transcribe: jest.fn(async (samples: Int16Array) => {
      const ms = (samples.length * 1000) / sampleRate;
      passes.push(ms);
      return ` ${words.slice(0, Math.floor(ms / 400)).join(' ')}`;
    }),
  };
  return transcriber;
}

function record(engine: ReturnType<typeof createWhisperSpeechEngine>) {
  const heard: string[] = [];
  const levels: number[] = [];
  const ends: SpeechEndReason[] = [];
  engine.onWords((words) => heard.push(...words));
  engine.onLevel((level) => levels.push(level));
  engine.onEnd((reason) => ends.push(reason));
  return { heard, levels, ends };
}

describe('the microphone permission', () => {
  it('is the capture’s, asked only through it', async () => {
    const capture = fakeCapture('undetermined', 'denied');
    const engine = createWhisperSpeechEngine({ capture, transcriber: fakeTranscriber() });
    expect(await engine.getMicrophonePermission()).toBe('undetermined');
    expect(await engine.requestMicrophonePermission()).toBe('denied');
    expect(await engine.getMicrophonePermission()).toBe('denied');
  });

  it('must be granted to start', async () => {
    const capture = fakeCapture('denied');
    const engine = createWhisperSpeechEngine({ capture, transcriber: fakeTranscriber() });
    await expect(engine.start()).rejects.toThrow(/microphone/i);
    expect(capture.isOpen()).toBe(false);
  });
});

describe('starting', () => {
  it('loads the model before opening the microphone', async () => {
    const capture = fakeCapture();
    const transcriber = fakeTranscriber();
    const engine = createWhisperSpeechEngine({ capture, transcriber });
    await engine.start();
    expect(transcriber.prepare).toHaveBeenCalledTimes(1);
    expect(capture.isOpen()).toBe(true);
  });

  it('fails without opening the microphone when the model cannot be loaded', async () => {
    const capture = fakeCapture();
    const transcriber = fakeTranscriber();
    (transcriber.prepare as jest.Mock).mockRejectedValueOnce(new Error('no model file'));
    const engine = createWhisperSpeechEngine({ capture, transcriber });
    await expect(engine.start()).rejects.toThrow('no model file');
    expect(capture.isOpen()).toBe(false);
  });
});

describe('listening', () => {
  it('gives the level of every piece of audio, from 0 to 1', async () => {
    const capture = fakeCapture();
    const engine = createWhisperSpeechEngine({ capture, transcriber: fakeTranscriber() });
    const { levels } = record(engine);
    await engine.start();
    await capture.feed('silence', 200);
    await capture.feed('voice', 200);
    expect(levels).toHaveLength(4);
    expect(levels.slice(0, 2)).toEqual([0, 0]);
    expect(levels[2]).toBeGreaterThan(0.5);
    expect(levels[3]).toBeLessThanOrEqual(1);
  });

  it('never gives silence to Whisper, which would write words over it', async () => {
    const capture = fakeCapture();
    const transcriber = fakeTranscriber();
    const engine = createWhisperSpeechEngine({ capture, transcriber });
    await engine.start();
    await capture.feed('silence', 5000);
    expect(transcriber.transcribe).not.toHaveBeenCalled();
  });

  it('gives words while the recitation goes on, each once two passes agree on it', async () => {
    const capture = fakeCapture();
    const transcriber = fakeTranscriber();
    const engine = createWhisperSpeechEngine({ capture, transcriber });
    const { heard } = record(engine);
    await engine.start();
    await capture.feed('voice', passEveryMs);
    expect(heard).toEqual([]);
    await capture.feed('voice', passEveryMs);
    // Two passes, over 1.2 s and 2.4 s of voice: they agree on the first three words.
    expect(heard).toEqual(SURAH_112.slice(0, 3));
    expect(transcriber.passes.length).toBe(2);
  });

  it('gives the last words of a phrase as soon as the reciter pauses', async () => {
    const capture = fakeCapture();
    const engine = createWhisperSpeechEngine({ capture, transcriber: fakeTranscriber() });
    const { heard } = record(engine);
    await engine.start();
    await capture.feed('voice', 1800);
    await capture.feed('silence', phraseEndSilenceMs + chunkMs);
    expect(heard).toEqual(SURAH_112.slice(0, 5));
  });

  it('starts each phrase afresh: the next phrase is transcribed alone', async () => {
    const capture = fakeCapture();
    const transcriber = fakeTranscriber();
    const engine = createWhisperSpeechEngine({ capture, transcriber });
    await engine.start();
    await capture.feed('voice', 1500);
    await capture.feed('silence', 1000);
    const passesOfFirstPhrase = transcriber.passes.length;
    await capture.feed('voice', passEveryMs);
    const [firstPassOfSecondPhrase] = transcriber.passes.slice(passesOfFirstPhrase);
    expect(firstPassOfSecondPhrase).toBeLessThanOrEqual(passEveryMs + 400);
  });

  it('closes a phrase that grows too long without a pause', async () => {
    const capture = fakeCapture();
    const transcriber = fakeTranscriber();
    const engine = createWhisperSpeechEngine({ capture, transcriber, mode: 'follow' });
    await engine.start();
    await capture.feed('voice', SPEECH_ENGINE_CONFIG.maxPhraseMs + 3000);
    expect(Math.max(...transcriber.passes)).toBeLessThanOrEqual(
      SPEECH_ENGINE_CONFIG.maxPhraseMs + 1000,
    );
  });
});

describe('ending by itself, when finding a passage', () => {
  it('ends after a silence once a voice was heard, its last words given first', async () => {
    const capture = fakeCapture();
    const engine = createWhisperSpeechEngine({ capture, transcriber: fakeTranscriber() });
    const events: string[] = [];
    engine.onWords((words) => events.push(...words));
    engine.onEnd((reason) => events.push(`end:${reason}`));
    await engine.start();
    await capture.feed('voice', 1800);
    await capture.feed('silence', SPEECH_ENGINE_CONFIG.search.endAfterSilenceMs + chunkMs);
    expect(events).toEqual([...SURAH_112.slice(0, 5), 'end:finished']);
    expect(capture.isOpen()).toBe(false);
  });

  it('ends when no voice came at all, without transcribing anything', async () => {
    const capture = fakeCapture();
    const transcriber = fakeTranscriber();
    const engine = createWhisperSpeechEngine({ capture, transcriber });
    const { ends, heard } = record(engine);
    await engine.start();
    await capture.feed('silence', SPEECH_ENGINE_CONFIG.search.endWithoutVoiceMs + chunkMs);
    expect(ends).toEqual(['finished']);
    expect(heard).toEqual([]);
    expect(transcriber.transcribe).not.toHaveBeenCalled();
  });

  it('ends after its time limit even if the voice goes on', async () => {
    const capture = fakeCapture();
    const engine = createWhisperSpeechEngine({ capture, transcriber: fakeTranscriber() });
    const { ends } = record(engine);
    await engine.start();
    await capture.feed('voice', SPEECH_ENGINE_CONFIG.search.maxListenMs + 2000);
    expect(ends).toEqual(['finished']);
  });

  it('when following a recitation, keeps listening through a long pause', async () => {
    const capture = fakeCapture();
    const engine = createWhisperSpeechEngine({
      capture,
      transcriber: fakeTranscriber(),
      mode: 'follow',
    });
    const { ends } = record(engine);
    await engine.start();
    await capture.feed('voice', 1000);
    await capture.feed('silence', SPEECH_ENGINE_CONFIG.search.endAfterSilenceMs + 1000);
    expect(ends).toEqual([]);
    expect(capture.isOpen()).toBe(true);
  });
});

describe('ending because of something else', () => {
  it('says the system took the microphone away', async () => {
    const capture = fakeCapture();
    const engine = createWhisperSpeechEngine({ capture, transcriber: fakeTranscriber() });
    const { ends } = record(engine);
    await engine.start();
    await capture.feed('voice', 300);
    capture.endFromSystem('interrupted');
    await settle();
    expect(ends).toEqual(['interrupted']);
    await capture.feed('voice', 2000);
    expect(ends).toEqual(['interrupted']);
  });

  it('fails, and closes the microphone, when Whisper fails', async () => {
    const capture = fakeCapture();
    const transcriber = fakeTranscriber();
    (transcriber.transcribe as jest.Mock).mockRejectedValueOnce(new Error('out of memory'));
    const engine = createWhisperSpeechEngine({ capture, transcriber });
    const { ends } = record(engine);
    await engine.start();
    await capture.feed('voice', passEveryMs + chunkMs);
    expect(ends).toEqual(['failed']);
    expect(capture.isOpen()).toBe(false);
  });
});

describe('stopping', () => {
  it('closes the microphone; nothing is given after, not even the end', async () => {
    const capture = fakeCapture();
    const engine = createWhisperSpeechEngine({ capture, transcriber: fakeTranscriber() });
    const { heard, levels, ends } = record(engine);
    await engine.start();
    await capture.feed('voice', passEveryMs);
    await engine.stop();
    expect(capture.isOpen()).toBe(false);
    const counts = [heard.length, levels.length];
    await capture.feed('voice', 3000);
    expect([heard.length, levels.length]).toEqual(counts);
    expect(ends).toEqual([]);
  });

  it('drops the words of a pass that was still running', async () => {
    const capture = fakeCapture();
    let finishPass: (text: string) => void = () => undefined;
    let calls = 0;
    const transcriber: Transcriber = {
      prepare: async () => undefined,
      // The first pass answers at once; the second, which would confirm its words, waits.
      transcribe: () => {
        calls += 1;
        if (calls === 1) return Promise.resolve('قُلْ هُوَ');
        return new Promise<string>((resolve) => {
          finishPass = resolve;
        });
      },
    };
    const engine = createWhisperSpeechEngine({ capture, transcriber });
    const { heard } = record(engine);
    await engine.start();
    await capture.feed('voice', 2 * passEveryMs);
    expect(calls).toBe(2);
    await engine.stop();
    finishPass('قُلْ هُوَ');
    await settle();
    expect(heard).toEqual([]);
  });

  it('is harmless when not listening, and the engine can listen again', async () => {
    const capture = fakeCapture();
    const engine = createWhisperSpeechEngine({ capture, transcriber: fakeTranscriber() });
    const { heard } = record(engine);
    await engine.stop();
    await engine.start();
    await capture.feed('voice', 1800);
    await engine.stop();
    heard.length = 0;
    await engine.start();
    await capture.feed('voice', 1800);
    await capture.feed('silence', 1000);
    expect(heard).toEqual(SURAH_112.slice(0, 5));
  });
});
