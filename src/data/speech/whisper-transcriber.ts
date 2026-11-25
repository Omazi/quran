/**
 * Whisper on the phone, through whisper.rn (MIT; whisper.cpp inside, with Metal on iOS). The
 * model is the file bundled with the app (`voice-model.ts`). One context serves every listening:
 * loading the model takes a moment, transcribing with it does not.
 */
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
 * How Whisper decodes (docs/DECISIONS.md, D42): Arabic only, greedy, without the text of the
 * previous pass as a prompt (each pass reads the whole phrase again). The number of threads is
 * whisper.rn's choice for the phone (2 on a 4-core chip, else up to 4).
 */
export const WHISPER_OPTIONS = Object.freeze({
  language: 'ar',
  translate: false,
  temperature: 0,
  maxContext: 0,
});

export function createWhisperTranscriber(loadBinding: () => WhisperBinding): Transcriber {
  let context: Promise<WhisperContextLike> | null = null;

  function loaded(): Promise<WhisperContextLike> {
    if (context === null) {
      const loading = Promise.resolve().then(() =>
        loadBinding().initWhisper({
          filePath: VOICE_MODEL.file,
          isBundleAsset: true,
          useGpu: true,
          // No Core ML encoder is shipped: Metal runs the GGML model directly.
          useCoreMLIos: false,
        }),
      );
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
    async transcribe(samples) {
      const whisper = await loaded();
      const data = samples.buffer.slice(
        samples.byteOffset,
        samples.byteOffset + samples.byteLength,
      ) as ArrayBuffer;
      const { result } = await whisper.transcribeData(data, { ...WHISPER_OPTIONS }).promise;
      return result;
    },
  };
}
