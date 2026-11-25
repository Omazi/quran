import { requireOptionalNativeModule } from 'expo';
import { AppState } from 'react-native';

import type { SpeechEngine } from '@/domain/listening';

import type { SpeechEngineMode } from './config';
import {
  createNativeAudioCapture,
  VOICE_CAPTURE_MODULE_NAME,
  type NativeVoiceCapture,
} from './native-audio-capture';
import { createWhisperSpeechEngine, type Transcriber } from './whisper-speech-engine';
import { createWhisperTranscriber, type WhisperBinding } from './whisper-transcriber';

export interface DeviceSpeechEngineOptions {
  /** Finds the native microphone module, or null when the app was built without it. */
  readonly findNative?: () => NativeVoiceCapture | null;
  /** Loads whisper.rn. Called on the first start only, never at import time. */
  readonly loadWhisper?: () => WhisperBinding;
}

function findLinkedNative(): NativeVoiceCapture | null {
  return requireOptionalNativeModule<NativeVoiceCapture>(VOICE_CAPTURE_MODULE_NAME);
}

function loadWhisperRn(): WhisperBinding {
  // Loaded on first use: whisper.rn needs its native module, absent from tests and the web.
  // `whisper.rn/index`: the package's `exports` map has no entry for its bare name.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('whisper.rn/index') as WhisperBinding;
}

/** One Whisper context for the whole app: the model is loaded once. */
let sharedTranscriber: Transcriber | null = null;

/**
 * The speech engine of this phone: the native microphone and Whisper (D42). Null where the app
 * was built without the native module (the web, Android for now, the tests): there is then no
 * real engine, and a published build shows no listening screen.
 */
export function createDeviceSpeechEngine(
  mode: SpeechEngineMode,
  { findNative = findLinkedNative, loadWhisper }: DeviceSpeechEngineOptions = {},
): SpeechEngine | null {
  let native: NativeVoiceCapture | null = null;
  try {
    native = findNative();
  } catch {
    // A module that cannot even be looked up is a module that is not there.
  }
  if (native === null) return null;
  const transcriber =
    loadWhisper === undefined
      ? (sharedTranscriber ??= createWhisperTranscriber(loadWhisperRn))
      : createWhisperTranscriber(loadWhisper);
  return createWhisperSpeechEngine({
    capture: createNativeAudioCapture(native, AppState),
    transcriber,
    mode,
  });
}
