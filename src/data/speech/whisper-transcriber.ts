/**
 * Whisper on the phone, through whisper.rn (MIT; whisper.cpp inside, with Metal on iOS). The
 * model is the file bundled with the app (`voice-model.ts`). One context serves every listening:
 * loading the model takes a moment, transcribing with it does not.
 */
import { SpeechEngineError, failureOf } from '@/domain/listening';

import type { Transcriber } from './whisper-speech-engine';
import { VOICE_MODEL } from './voice-model';

interface WhisperContextLike {
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
 * temperatures, five candidates each, when it doubts its first reading; on recitations it doubted
 * often (noise, telephone band, ordinary readers) and a doubted pass took up to 40 times longer,
 * for the same words: measured on 612 clips, the same passages found and 7 times less computing
 * (tools/voice-bench). The number of threads is whisper.rn's choice for the phone (2 on a 4-core
 * chip, else up to 4).
 */
export const WHISPER_OPTIONS = Object.freeze({
  language: 'ar',
  translate: false,
  temperature: 0,
  temperatureInc: 0,
  maxContext: 0,
});

export interface WhisperTranscriberOptions {
  /**
   * Checks the model file is in the app before Whisper opens it; rejects with a
   * `SpeechEngineError` of `model-missing` when it is not (Whisper would only say "Failed to load
   * the model", the same words for a missing file and a broken one).
   */
  readonly checkModel?: () => Promise<void>;
}

/**
 * Whisper on the phone. One context, shared by every engine of the app: its readings run one
 * after the other (whisper.rn refuses a second reading on a context that is busy, "Context is
 * already transcribing", which a new listening could otherwise meet while the last reading of the
 * previous one ends).
 */
export function createWhisperTranscriber(
  loadBinding: () => WhisperBinding,
  { checkModel }: WhisperTranscriberOptions = {},
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

  return {
    async prepare() {
      await loaded();
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
