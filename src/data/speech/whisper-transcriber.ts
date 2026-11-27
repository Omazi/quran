/**
 * Whisper on the phone, through whisper.rn (MIT; whisper.cpp inside, with Metal on iOS). The
 * model is the file bundled with the app (`voice-model.ts`). One context serves every listening:
 * loading the model takes a moment, transcribing with it does not.
 */
import { AUDIO_CHECK, SpeechEngineError, failureOf, type HeldReading } from '@/domain/listening';

import type { Transcriber } from './whisper-speech-engine';
import { VOICE_MODEL } from './voice-model';

interface WhisperContextLike {
  /** whisper.rn's id of the context (the native functions take it). */
  readonly id?: number;
  transcribeData(
    data: ArrayBuffer,
    options: Record<string, unknown>,
  ): { promise: Promise<{ result: string; isAborted?: boolean }> };
}

/** The part of whisper.rn this file needs. */
export interface WhisperBinding {
  initWhisper(options: {
    filePath: string;
    isBundleAsset: boolean;
    useGpu: boolean;
    useCoreMLIos: boolean;
  }): Promise<WhisperContextLike>;
}

/**
 * How Whisper decodes (docs/DECISIONS.md, D42 and D45): Arabic only, greedy, without the text of
 * the previous pass as a prompt (each pass reads the whole phrase again), and **without the
 * temperature fallback**. whisper.cpp's default re-reads a pass up to five times at higher
 * temperatures, five candidates each, when it doubts its first reading; on recitations it doubts
 * now and then (noise, telephone band, a word cut at the end of the audio) and such a reading took
 * up to 16 s instead of 1.3 s on the benchmark's computer, for the same passages found (612 clips,
 * tools/voice-bench; D45). The number of threads is whisper.rn's choice for the phone (2 on a 4-core
 * chip, else up to 4).
 */
export const WHISPER_OPTIONS = Object.freeze({
  language: 'ar',
  translate: false,
  temperature: 0,
  temperatureInc: 0,
  maxContext: 0,
});

/**
 * The native function added to whisper.rn by `patches/whisper.rn+0.7.4.patch` (D49): reads the
 * audio again held to each text (`native/quran-decoding`), resolves with the readings as JSON.
 * Installed with whisper.rn's own functions; absent from a build without the patch.
 */
type ReadHeldFunction = (
  contextId: number,
  texts: readonly string[],
  options: Record<string, number>,
  audio: ArrayBuffer,
) => Promise<string>;

/** The native function, when this build has it. */
export function findReadHeld(scope: object = globalThis): ReadHeldFunction | null {
  const found = (scope as { whisperReadHeld?: unknown }).whisperReadHeld;
  return typeof found === 'function' ? (found as ReadHeldFunction) : null;
}

/** Checks the JSON of the native side: one reading per text, with the expected fields. */
export function parseHeldReadings(json: string, expected: number): HeldReading[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed) || parsed.length !== expected) {
    throw new Error(`Held readings: expected ${expected}, got ${String(json).slice(0, 80)}`);
  }
  return parsed.map((entry: unknown) => {
    const r = entry as Record<string, unknown>;
    if (
      typeof r.text !== 'string' ||
      typeof r.cost !== 'number' ||
      typeof r.letters !== 'number' ||
      typeof r.freeLetters !== 'number' ||
      typeof r.abandoned !== 'boolean'
    ) {
      throw new Error('Held readings: a reading is malformed');
    }
    return {
      text: r.text,
      cost: r.cost,
      letters: r.letters,
      freeLetters: r.freeLetters,
      abandoned: r.abandoned,
    };
  });
}

export interface WhisperTranscriberOptions {
  /**
   * Checks the model file is in the app before Whisper opens it; rejects with a
   * `SpeechEngineError` of `model-missing` when it is not (Whisper would only say "Failed to load
   * the model", the same words for a missing file and a broken one).
   */
  readonly checkModel?: () => Promise<void>;
  /** Finds the native held reading (tests replace it). */
  readonly findReadHeld?: () => ReadHeldFunction | null;
}

/**
 * Whisper on the phone. One context, shared by every engine of the app: its readings run one
 * after the other (whisper.rn refuses a second reading on a context that is busy, "Context is
 * already transcribing", which a new listening could otherwise meet while the last reading of the
 * previous one ends).
 */
export function createWhisperTranscriber(
  loadBinding: () => WhisperBinding,
  { checkModel, findReadHeld: find = findReadHeld }: WhisperTranscriberOptions = {},
): Transcriber {
  let context: Promise<WhisperContextLike> | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  function loaded(): Promise<WhisperContextLike> {
    if (context === null) {
      const loading = Promise.resolve()
        .then(() => checkModel?.())
        .then(() =>
          loadBinding().initWhisper({
            filePath: VOICE_MODEL.file,
            isBundleAsset: true,
            useGpu: true,
            // No Core ML encoder is shipped: Metal runs the GGML model directly.
            useCoreMLIos: false,
          }),
        )
        .catch((error: unknown) => {
          if (failureOf(error) !== 'unknown') throw error;
          throw new SpeechEngineError(
            'model-failed',
            error instanceof Error ? error.message : String(error),
          );
        });
      context = loading;
      loading.catch(() => {
        if (context === loading) context = null;
      });
    }
    return context;
  }

  /** Runs `job` after the readings already asked for, whatever their outcome. */
  function inTurn<T>(job: () => Promise<T>): Promise<T> {
    const turn = queue.then(job);
    queue = turn.catch(() => undefined);
    return turn;
  }

  return {
    async prepare() {
      await loaded();
    },
    readHeld(samples, texts, minLetters) {
      return inTurn(async () => {
        const whisper = await loaded();
        const read = find();
        if (read === null || typeof whisper.id !== 'number') return null;
        const data = samples.buffer.slice(
          samples.byteOffset,
          samples.byteOffset + samples.byteLength,
        ) as ArrayBuffer;
        const json = await read(whisper.id, texts, { ...AUDIO_CHECK.read, minLetters }, data);
        return parseHeldReadings(json, texts.length);
      });
    },
    transcribe(samples) {
      const reading = queue.then(async () => {
        const whisper = await loaded();
        const data = samples.buffer.slice(
          samples.byteOffset,
          samples.byteOffset + samples.byteLength,
        ) as ArrayBuffer;
        const { result } = await whisper.transcribeData(data, { ...WHISPER_OPTIONS }).promise;
        return result;
      });
      // The next reading waits for this one, whatever its outcome.
      queue = reading.catch(() => undefined);
      return reading;
    },
  };
}
