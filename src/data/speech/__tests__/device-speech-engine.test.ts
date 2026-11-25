import { createDeviceSpeechEngine } from '../device-speech-engine';
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
