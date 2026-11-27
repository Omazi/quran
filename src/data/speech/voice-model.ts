/**
 * The Whisper model of the app (docs/DECISIONS.md, D42, then D49): Tarteel's Whisper base
 * fine-tuned on Quran recitation, in the GGML format of whisper.cpp (q5_1, 59.7 MB; before D49,
 * tiny q8_0: `voice-model.tiny.json` is the way back). The file is not in the repository: the
 * config plugin of `modules/voice-capture` downloads it while the iOS project is generated,
 * checks its SHA-256 and puts it in the app, where Whisper finds it by name.
 */
import manifest from '../../../modules/voice-capture/voice-model.json';

export interface VoiceModel {
  /** The file name inside the app. */
  readonly file: string;
  readonly bytes: number;
  readonly sha256: string;
  /** Where the build may download it from, in order. Each copy is checked against `sha256`. */
  readonly urls: readonly string[];
  /** The model it is made from, on Hugging Face, and the revision converted. */
  readonly model: string;
  readonly revision: string;
  readonly license: string;
}

export const VOICE_MODEL: VoiceModel = Object.freeze({ ...manifest });
