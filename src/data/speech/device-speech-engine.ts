import { requireOptionalNativeModule } from 'expo';
import { AppState } from 'react-native';

import { SpeechEngineError, type SpeechEngine } from '@/domain/listening';

import type { SpeechEngineMode } from './config';
import { voiceDiagnostics } from './diagnostics';
import {
  createNativeAudioCapture,
  VOICE_CAPTURE_MODULE_NAME,
  type NativeVoiceCapture,
} from './native-audio-capture';
import { createWhisperSpeechEngine, type Transcriber } from './whisper-speech-engine';
import { VOICE_MODEL } from './voice-model';
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
 * Asks the native module whether the model file is in the app, and records the answer and what
 * the module says of the microphone for the diagnostics. Null when the build is older than this
 * question (the check is then Whisper's own).
 */
export async function readNativeDiagnostics(
  native: NativeVoiceCapture,
): Promise<{ present: boolean; bytes: number | null } | null> {
  if (native.getDiagnostics === undefined) return null;
  const answer = await native.getDiagnostics(VOICE_MODEL.file);
  const present = answer.modelPresent === true;
  const bytes = typeof answer.modelBytes === 'number' ? answer.modelBytes : null;
  const modelFile = { present, bytes };
  voiceDiagnostics.record({ modelFile, native: answer });
  return modelFile;
}

/** Rejects with `model-missing` when the model file is absent from the app or of another size. */
export async function checkModelFile(native: NativeVoiceCapture): Promise<void> {
  const file = await readNativeDiagnostics(native).catch(() => null);
  if (file === null) return;
  if (!file.present) {
    throw new SpeechEngineError('model-missing', `${VOICE_MODEL.file} is not in the app`);
  }
  if (file.bytes !== null && file.bytes !== VOICE_MODEL.bytes) {
    throw new SpeechEngineError(
      'model-missing',
      `${VOICE_MODEL.file} has ${file.bytes} bytes, not ${VOICE_MODEL.bytes}`,
    );
  }
}

/** The native module of this build, for the diagnostics; null where there is none. */
export function findVoiceCapture(): NativeVoiceCapture | null {
  try {
    return findLinkedNative();
  } catch {
    return null;
  }
}

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
  const linked = native;
  const checkModel = () => checkModelFile(linked);
  const transcriber =
    loadWhisper === undefined
      ? (sharedTranscriber ??= createWhisperTranscriber(loadWhisperRn, { checkModel }))
      : createWhisperTranscriber(loadWhisper, { checkModel });
  return createWhisperSpeechEngine({
    capture: createNativeAudioCapture(native, AppState),
    transcriber,
    mode,
    record: voiceDiagnostics.record,
  });
}

export interface FileSpeechEngineOptions extends DeviceSpeechEngineOptions {
  /** Told how long each reading by Whisper took, in milliseconds (the clock of the phone). */
  readonly onReading?: (ms: number, text: string) => void;
  /** Told how long each held reading (the audio check, D47) took, and of how many texts. */
  readonly onHeldReading?: (ms: number, texts: number) => void;
  readonly now?: () => number;
}

/**
 * CHECK BUILD ONLY (the voice proof of `src/features/screen-check`, never called elsewhere): the
 * engine of the listening screen, with a recording of the app's `voice-proof` folder played
 * instead of the microphone (`startFile` of the native module: same converter, same chunks, real
 * time). Same Whisper context, same settings, same passes. Null without the native module or in a
 * build whose module cannot read a file.
 */
export function createFileSpeechEngine(
  path: string,
  {
    findNative = findLinkedNative,
    loadWhisper,
    onReading,
    onHeldReading,
    now = Date.now,
  }: FileSpeechEngineOptions = {},
): SpeechEngine | null {
  let native: NativeVoiceCapture | null = null;
  try {
    native = findNative();
  } catch {
    // Not there.
  }
  if (native === null || native.startFile === undefined) return null;
  const linked = native;
  const readFile = native.startFile.bind(native);
  // The file needs no microphone: nothing is asked of the person.
  const fromFile: NativeVoiceCapture = {
    getPermission: async () => 'granted',
    requestPermission: async () => 'granted',
    start: (sampleRate, chunkMs) => readFile(path, sampleRate, chunkMs),
    stop: () => linked.stop(),
    addListener: ((event: 'onAudio', listener: (event: { pcm: string }) => void) =>
      linked.addListener(event, listener)) as NativeVoiceCapture['addListener'],
  };
  const checkModel = () => checkModelFile(linked);
  const whisper =
    loadWhisper === undefined
      ? (sharedTranscriber ??= createWhisperTranscriber(loadWhisperRn, { checkModel }))
      : createWhisperTranscriber(loadWhisper, { checkModel });
  const timed: { -readonly [K in keyof Transcriber]: Transcriber[K] } = {
    prepare: () => whisper.prepare(),
    async transcribe(samples) {
      const started = now();
      const text = await whisper.transcribe(samples);
      onReading?.(now() - started, text);
      return text;
    },
  };
  if (whisper.readHeld !== undefined) {
    const readHeld = whisper.readHeld.bind(whisper);
    timed.readHeld = async (samples, texts, minLetters) => {
      const started = now();
      const readings = await readHeld(samples, texts, minLetters);
      onHeldReading?.(now() - started, texts.length);
      return readings;
    };
  }
  return createWhisperSpeechEngine({
    capture: createNativeAudioCapture(fromFile),
    transcriber: timed,
    mode: 'search',
    record: voiceDiagnostics.record,
  });
}
