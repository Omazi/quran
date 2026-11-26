import { SpeechEngineError, type SpeechEndReason } from '@/domain/listening';

import { createNativeAudioCapture, type NativeVoiceCapture } from '../native-audio-capture';
import { createWhisperTranscriber, type WhisperBinding } from '../whisper-transcriber';
import { bytesToBase64 } from '../test-support/base64';
import { VOICE_MODEL } from '../voice-model';

type Listener = (event: Record<string, string>) => void;

function fakeNative(permission = 'undetermined', answer = 'granted') {
  const listeners = new Map<string, Set<Listener>>();
  let current = permission;
  const native = {
    getPermission: jest.fn(async () => current),
    requestPermission: jest.fn(async () => {
      if (current === 'undetermined') current = answer;
      return current;
    }),
    start: jest.fn(async (_sampleRate: number, _chunkMs: number) => undefined),
    stop: jest.fn(async () => undefined),
    addListener: jest.fn((event: string, listener: Listener) => {
      const set = listeners.get(event) ?? new Set<Listener>();
      set.add(listener);
      listeners.set(event, set);
      return { remove: () => set.delete(listener) };
    }),
    emit: (event: string, payload: Record<string, string>) => {
      for (const listener of listeners.get(event) ?? []) listener(payload);
    },
    listenerCount: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
  };
  return native;
}

function fakeAppState() {
  let listener: ((state: string) => void) | null = null;
  return {
    addEventListener: jest.fn((_type: 'change', given: (state: string) => void) => {
      listener = given;
      return {
        remove: () => {
          listener = null;
        },
      };
    }),
    change: (state: string) => listener?.(state),
    isListening: () => listener !== null,
  };
}

describe('the native microphone', () => {
  it('reads the permission as the domain names it', async () => {
    const native = fakeNative('undetermined', 'denied');
    const capture = createNativeAudioCapture(native as unknown as NativeVoiceCapture);
    expect(await capture.getPermission()).toBe('undetermined');
    expect(await capture.requestPermission()).toBe('denied');
  });

  it('treats an answer it does not know as not asked yet', async () => {
    const native = fakeNative('restricted-by-something-new');
    const capture = createNativeAudioCapture(native as unknown as NativeVoiceCapture);
    expect(await capture.getPermission()).toBe('undetermined');
  });

  it('records at 16 kHz and gives the samples it receives as base64', async () => {
    const native = fakeNative('granted');
    const capture = createNativeAudioCapture(native as unknown as NativeVoiceCapture);
    const chunks: Int16Array[] = [];
    await capture.start({ onAudio: (samples) => chunks.push(samples), onEnd: () => undefined });
    expect(native.start).toHaveBeenCalledWith(16000, 100);
    native.emit('onAudio', { pcm: bytesToBase64([0x01, 0x00, 0xff, 0xff]) });
    expect(chunks.map((chunk) => Array.from(chunk))).toEqual([[1, -1]]);
  });

  it('passes on the end the system decided, and stops listening to the module after', async () => {
    const native = fakeNative('granted');
    const capture = createNativeAudioCapture(native as unknown as NativeVoiceCapture);
    const ends: SpeechEndReason[] = [];
    await capture.start({ onAudio: () => undefined, onEnd: (reason) => ends.push(reason) });
    native.emit('onEnd', { reason: 'interrupted' });
    native.emit('onEnd', { reason: 'failed' });
    expect(ends).toEqual(['interrupted']);
    expect(native.listenerCount()).toBe(0);
  });

  it('closes the microphone when the app leaves the screen, as an interruption', async () => {
    const native = fakeNative('granted');
    const appState = fakeAppState();
    const capture = createNativeAudioCapture(native as unknown as NativeVoiceCapture, appState);
    const ends: SpeechEndReason[] = [];
    await capture.start({ onAudio: () => undefined, onEnd: (reason) => ends.push(reason) });
    appState.change('inactive');
    expect(ends).toEqual([]);
    appState.change('background');
    expect(ends).toEqual(['interrupted']);
    expect(native.stop).toHaveBeenCalled();
    expect(appState.isListening()).toBe(false);
  });

  it('gives the level the module measures, on the same scale as the chunks', async () => {
    const native = fakeNative('granted');
    const capture = createNativeAudioCapture(native as unknown as NativeVoiceCapture);
    const levels: number[] = [];
    await capture.start({
      onAudio: () => undefined,
      onLevel: (level) => levels.push(level),
      onEnd: () => undefined,
    });
    // Silence, the floor (−55 dB), half way (−35 dB), the ceiling (−15 dB) and beyond.
    for (const rms of [0, 10 ** (-55 / 20), 10 ** (-35 / 20), 10 ** (-15 / 20), 1]) {
      native.emit('onLevel', { rms, peak: rms } as unknown as Record<string, string>);
    }
    expect(levels.map((level) => Math.round(level * 100) / 100)).toEqual([0, 0, 0.5, 1, 1]);
  });

  it('passes on why the module failed', async () => {
    const native = fakeNative('granted');
    const capture = createNativeAudioCapture(native as unknown as NativeVoiceCapture);
    const ends: [SpeechEndReason, string | undefined][] = [];
    await capture.start({
      onAudio: () => undefined,
      onEnd: (reason, message) => ends.push([reason, message]),
    });
    native.emit('onEnd', { reason: 'failed', message: 'conversion failed 5 times' });
    expect(ends).toEqual([['failed', 'conversion failed 5 times']]);
  });

  it('removes its listeners when stopped', async () => {
    const native = fakeNative('granted');
    const appState = fakeAppState();
    const capture = createNativeAudioCapture(native as unknown as NativeVoiceCapture, appState);
    await capture.start({ onAudio: () => undefined, onEnd: () => undefined });
    await capture.stop();
    expect(native.stop).toHaveBeenCalledTimes(1);
    expect(native.listenerCount()).toBe(0);
    expect(appState.isListening()).toBe(false);
  });
});

function fakeWhisper(text = ' قُلْ هُوَ ') {
  const context = {
    transcribeData: jest.fn((_data: ArrayBuffer, _options: Record<string, unknown>) => ({
      stop: async () => undefined,
      promise: Promise.resolve({ result: text, isAborted: false }),
    })),
  };
  const binding = { initWhisper: jest.fn(async (_options: Record<string, unknown>) => context) };
  return { binding, context };
}

describe('Whisper', () => {
  it('loads the model bundled with the app once, on the GPU', async () => {
    const { binding } = fakeWhisper();
    const transcriber = createWhisperTranscriber(() => binding as unknown as WhisperBinding);
    await transcriber.prepare();
    await transcriber.prepare();
    expect(binding.initWhisper).toHaveBeenCalledTimes(1);
    expect(binding.initWhisper).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: VOICE_MODEL.file, isBundleAsset: true, useGpu: true }),
    );
  });

  it('tries again after a model that could not be loaded', async () => {
    const { binding } = fakeWhisper();
    binding.initWhisper.mockRejectedValueOnce(new Error('missing'));
    const transcriber = createWhisperTranscriber(() => binding as unknown as WhisperBinding);
    await expect(transcriber.prepare()).rejects.toThrow('missing');
    await transcriber.prepare();
    expect(binding.initWhisper).toHaveBeenCalledTimes(2);
  });

  it('says model-failed when Whisper cannot load the model', async () => {
    const { binding } = fakeWhisper();
    binding.initWhisper.mockRejectedValueOnce(new Error('Failed to load the model'));
    const transcriber = createWhisperTranscriber(() => binding as unknown as WhisperBinding);
    await expect(transcriber.prepare()).rejects.toMatchObject({ failure: 'model-failed' });
  });

  it('says model-missing, without opening Whisper, when the file is not in the app', async () => {
    const { binding } = fakeWhisper();
    const checkModel = jest.fn(async () => {
      throw new SpeechEngineError('model-missing', 'not in the app');
    });
    const transcriber = createWhisperTranscriber(() => binding as unknown as WhisperBinding, {
      checkModel,
    });
    await expect(transcriber.prepare()).rejects.toMatchObject({ failure: 'model-missing' });
    expect(binding.initWhisper).not.toHaveBeenCalled();
  });

  it('reads one piece of audio at a time: whisper.rn refuses a second reading on a busy context', async () => {
    const answers: ((text: string) => void)[] = [];
    let running = 0;
    let mostAtOnce = 0;
    const context = {
      transcribeData: jest.fn(() => {
        running += 1;
        mostAtOnce = Math.max(mostAtOnce, running);
        return {
          stop: async () => undefined,
          promise: new Promise<{ result: string }>((resolve) => {
            answers.push((result) => {
              running -= 1;
              resolve({ result });
            });
          }),
        };
      }),
    };
    const binding = { initWhisper: async () => context };
    const transcriber = createWhisperTranscriber(() => binding as unknown as WhisperBinding);
    const first = transcriber.transcribe(new Int16Array(4));
    const second = transcriber.transcribe(new Int16Array(4));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(context.transcribeData).toHaveBeenCalledTimes(1);
    answers[0]!('one');
    expect(await first).toBe('one');
    await new Promise((resolve) => setTimeout(resolve, 0));
    answers[1]!('two');
    expect(await second).toBe('two');
    expect(mostAtOnce).toBe(1);
  });

  it('transcribes the samples in Arabic, as 16-bit PCM', async () => {
    const { binding, context } = fakeWhisper();
    const transcriber = createWhisperTranscriber(() => binding as unknown as WhisperBinding);
    const samples = new Int16Array([1, -1, 300]).subarray(1);
    expect(await transcriber.transcribe(samples)).toBe(' قُلْ هُوَ ');
    const [data, options] = context.transcribeData.mock.calls[0]!;
    expect(Array.from(new Int16Array(data))).toEqual([-1, 300]);
    expect(options).toEqual(expect.objectContaining({ language: 'ar', translate: false }));
  });

  it('reads each pass once: greedy, without the temperature fallback (D45)', async () => {
    const { binding, context } = fakeWhisper();
    const transcriber = createWhisperTranscriber(() => binding as unknown as WhisperBinding);
    await transcriber.transcribe(new Int16Array([1, 2]));
    const [, options] = context.transcribeData.mock.calls[0]!;
    expect(options).toEqual(
      expect.objectContaining({ temperature: 0, temperatureInc: 0, maxContext: 0 }),
    );
    expect(options).not.toHaveProperty('beamSize');
    expect(options).not.toHaveProperty('prompt');
  });
});
