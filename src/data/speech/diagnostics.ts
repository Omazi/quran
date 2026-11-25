/**
 * What the voice saw on this phone, for the hidden diagnostics of the settings (long press on the
 * version): whether the model file is in the app, whether Whisper loaded, the microphone
 * permission, the last level, the last raw transcription and the last error. In memory only,
 * never stored nor sent: the owner reads it on the phone and says what fails.
 */
import type { MicrophonePermission, SpeechFailure } from '@/domain/listening';

export interface VoiceDiagnostics {
  /** The model file in the app, as the native module found it; null until asked. */
  readonly modelFile: { readonly present: boolean; readonly bytes: number | null } | null;
  /** Whether Whisper loaded the model; null until a listening tried. */
  readonly whisperLoaded: boolean | null;
  readonly permission: MicrophonePermission | null;
  /** The last level: 0 to 1, and in dB of full scale when it was measured on a chunk. */
  readonly lastLevel: { readonly level: number; readonly db: number | null } | null;
  /** Pieces of audio received since the app started. */
  readonly audioChunks: number;
  /** What Whisper last wrote, exactly. */
  readonly lastTranscript: string | null;
  readonly lastError: { readonly failure: SpeechFailure; readonly message: string } | null;
  /** What the native module says of the microphone (input format, session), when asked. */
  readonly native: Readonly<Record<string, string | number | boolean>> | null;
}

/** A change: `audioChunks` is added to the count, every other field replaces the value. */
export type VoiceDiagnosticsUpdate = Partial<VoiceDiagnostics>;

const EMPTY: VoiceDiagnostics = Object.freeze({
  modelFile: null,
  whisperLoaded: null,
  permission: null,
  lastLevel: null,
  audioChunks: 0,
  lastTranscript: null,
  lastError: null,
  native: null,
});

export interface VoiceDiagnosticsStore {
  get(): VoiceDiagnostics;
  record(update: VoiceDiagnosticsUpdate): void;
  subscribe(listener: () => void): () => void;
  /** For tests. */
  reset(): void;
}

export function createVoiceDiagnosticsStore(): VoiceDiagnosticsStore {
  let current: VoiceDiagnostics = EMPTY;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    record(update) {
      const { audioChunks, ...rest } = update;
      current = {
        ...current,
        ...rest,
        audioChunks: current.audioChunks + (audioChunks ?? 0),
      };
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reset() {
      current = EMPTY;
    },
  };
}

/** The one store of the app. */
export const voiceDiagnostics: VoiceDiagnosticsStore = createVoiceDiagnosticsStore();
