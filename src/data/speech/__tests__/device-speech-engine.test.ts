import { appSuppression } from '@/data/feedback';

import {
  checkModelFile,
  createDeviceSpeechEngine,
  createFileSpeechEngine,
} from '../device-speech-engine';
import { voiceDiagnostics } from '../diagnostics';
import { VOICE_MODEL } from '../voice-model';
import type { NativeVoiceCapture } from '../native-audio-capture';
import type { WhisperBinding } from '../whisper-transcriber';

const native = {
  getPermission: async () => 'granted',
  requestPermission: async () => 'granted',
  start: jest.fn(async () => undefined),
  stop: jest.fn(async () => undefined),
  addListener: () => ({ remove: () => undefined }),
} as unknown as NativeVoiceCapture;

function whisper() {
  const context = {
    transcribeData: () => ({ promise: Promise.resolve({ result: '' }) }),
  };
  return { initWhisper: jest.fn(async () => context) };
}

describe('createDeviceSpeechEngine', () => {
  it('is null where the app was built without the native microphone (web, Android, tests)', () => {
    expect(createDeviceSpeechEngine('search', { findNative: () => null })).toBeNull();
    const throwing = () => {
      throw new Error('cannot look it up');
    };
    expect(createDeviceSpeechEngine('search', { findNative: throwing })).toBeNull();
  });

  it('never loads whisper.rn just to be created', () => {
    const loadWhisper = jest.fn(whisper);
    const engine = createDeviceSpeechEngine('follow', { findNative: () => native, loadWhisper });
    expect(engine).not.toBeNull();
    expect(loadWhisper).not.toHaveBeenCalled();
  });

  it('opens the native microphone and loads the model when it starts', async () => {
    const binding = whisper();
    const engine = createDeviceSpeechEngine('search', {
      findNative: () => native,
      loadWhisper: () => binding as unknown as WhisperBinding,
    });
    await engine?.start();
    expect(binding.initWhisper).toHaveBeenCalledTimes(1);
    expect(native.start).toHaveBeenCalledTimes(1);
    await engine?.stop();
    expect(native.stop).toHaveBeenCalledTimes(1);
  });

  it('keeps the interface sounds and haptics silent while the microphone is open', async () => {
    const engine = createDeviceSpeechEngine('search', {
      findNative: () => native,
      loadWhisper: () => whisper() as unknown as WhisperBinding,
    });
    expect(appSuppression.isSuppressed()).toBe(false);
    await engine?.start();
    expect(appSuppression.isSuppressed()).toBe(true);
    await engine?.stop();
    expect(appSuppression.isSuppressed()).toBe(false);
  });
});

describe('createFileSpeechEngine (the voice proof of the check build)', () => {
  it('is null without the native module, or when the module cannot read a file', () => {
    expect(createFileSpeechEngine('/x.wav', { findNative: () => null })).toBeNull();
    expect(createFileSpeechEngine('/x.wav', { findNative: () => native })).toBeNull();
  });

  it('reads the file instead of the microphone, asks no permission, and times each reading', async () => {
    const startFile = jest.fn(async () => undefined);
    const requestPermission = jest.fn(async () => 'denied');
    let sendAudio: (event: { pcm: string }) => void = () => undefined;
    const fileNative = {
      ...native,
      getPermission: async () => 'undetermined',
      requestPermission,
      startFile,
      addListener: (event: string, listener: (event: { pcm: string }) => void) => {
        if (event === 'onAudio') sendAudio = listener;
        return { remove: () => undefined };
      },
    } as unknown as NativeVoiceCapture;
    const context = {
      transcribeData: jest.fn(() => ({ promise: Promise.resolve({ result: 'قل هو الله احد' }) })),
    };
    const readings: [number, string][] = [];
    let clock = 0;
    const engine = createFileSpeechEngine('file:///docs/voice-proof/a.wav', {
      findNative: () => fileNative,
      loadWhisper: () => ({ initWhisper: async () => context }) as unknown as WhisperBinding,
      onReading: (ms, text) => readings.push([ms, text]),
      now: () => (clock += 250),
    });
    await engine?.start();
    expect(startFile).toHaveBeenCalledWith('file:///docs/voice-proof/a.wav', 16000, 100);
    expect(requestPermission).not.toHaveBeenCalled();
    // One second of a loud tone (a voice), then silence: one reading at the pause.
    const loud = new Int16Array(1600).map((_, i) => (i % 2 === 0 ? 8000 : -8000));
    const toBase64 = (samples: Int16Array) =>
      btoa(String.fromCharCode(...new Uint8Array(samples.buffer)));
    for (let i = 0; i < 10; i += 1) sendAudio({ pcm: toBase64(loud) });
    for (let i = 0; i < 8; i += 1) sendAudio({ pcm: toBase64(new Int16Array(1600)) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(context.transcribeData).toHaveBeenCalled();
    expect(readings[0]).toEqual([250, 'قل هو الله احد']);
    await engine?.stop();
  });
});

describe('the model file in the app', () => {
  const withDiagnostics = (answer: Record<string, unknown>) =>
    ({ ...native, getDiagnostics: jest.fn(async () => answer) }) as unknown as NativeVoiceCapture;

  it('is accepted when present at its size, and recorded for the diagnostics', async () => {
    voiceDiagnostics.reset();
    await expect(
      checkModelFile(withDiagnostics({ modelPresent: true, modelBytes: VOICE_MODEL.bytes })),
    ).resolves.toBeUndefined();
    expect(voiceDiagnostics.get().modelFile).toEqual({ present: true, bytes: VOICE_MODEL.bytes });
  });

  it('is model-missing when absent', async () => {
    await expect(
      checkModelFile(withDiagnostics({ modelPresent: false, modelBytes: 0 })),
    ).rejects.toMatchObject({ failure: 'model-missing' });
  });

  it('is model-missing when of another size (a cut file)', async () => {
    await expect(
      checkModelFile(withDiagnostics({ modelPresent: true, modelBytes: 1234 })),
    ).rejects.toMatchObject({ failure: 'model-missing' });
  });

  it('is left to Whisper on a build whose module cannot answer', async () => {
    await expect(checkModelFile(native)).resolves.toBeUndefined();
  });

  it('stops a start before Whisper opens anything when the file is missing', async () => {
    const binding = whisper();
    const engine = createDeviceSpeechEngine('search', {
      findNative: () => withDiagnostics({ modelPresent: false, modelBytes: 0 }),
      loadWhisper: () => binding as unknown as WhisperBinding,
    });
    await expect(engine?.start()).rejects.toMatchObject({ failure: 'model-missing' });
    expect(binding.initWhisper).not.toHaveBeenCalled();
  });
});
