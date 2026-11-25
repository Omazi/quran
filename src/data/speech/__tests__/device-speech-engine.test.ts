import { checkModelFile, createDeviceSpeechEngine } from '../device-speech-engine';
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
