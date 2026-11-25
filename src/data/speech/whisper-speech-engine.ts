/**
 * The real speech engine (docs/DECISIONS.md, D5 and D42): the microphone, cut into phrases by
 * the loudness of the voice, transcribed on the phone by Whisper, and given to the app as final
 * words. It implements the domain's `SpeechEngine`; the microphone and Whisper are reached
 * through two small interfaces, so this file is plain TypeScript, tested without a phone.
 *
 * How a recitation becomes words:
 * - audio arrives in chunks of `chunkMs`; each gives a level, and counts as voice or not;
 * - a phrase opens with the first voice (plus a little audio before it) and closes after a
 *   pause, or when it grows too long for Whisper;
 * - while the phrase grows, it is transcribed again every `passEveryMs`; a word is given once
 *   two passes agree on it, the rest when the phrase closes (`transcript.ts`);
 * - silence is never transcribed: Whisper writes words over silence.
 * Passes run one at a time; audio that arrives during a pass waits for the next.
 */
import type {
  MicrophonePermission,
  SpeechEndReason,
  SpeechEngine,
  Unsubscribe,
} from '@/domain/listening';

import { chunkLoudness, createVoiceActivity, type VoiceActivity } from './audio-level';
import { SPEECH_ENGINE_CONFIG, type SpeechEngineMode } from './config';
import { createTranscriptStabilizer, whisperWords, type TranscriptStabilizer } from './transcript';

export interface AudioListeners {
  /** 16 kHz mono 16-bit samples, `chunkMs` long, in the order they were recorded. */
  onAudio(samples: Int16Array): void;
  /** The system took the microphone away, or the capture broke. */
  onEnd(reason: SpeechEndReason): void;
}

/** The microphone (`native-audio-capture.ts` on the phone). */
export interface AudioCapture {
  getPermission(): Promise<MicrophonePermission>;
  requestPermission(): Promise<MicrophonePermission>;
  start(listeners: AudioListeners): Promise<void>;
  /** Harmless when not recording. */
  stop(): Promise<void>;
}

/** Whisper (`whisper-transcriber.ts` on the phone). */
export interface Transcriber {
  /** Loads the model; quick once it is loaded. */
  prepare(): Promise<void>;
  /** The text Whisper reads in 16 kHz mono 16-bit samples. */
  transcribe(samples: Int16Array): Promise<string>;
}

export interface WhisperSpeechEngineOptions {
  readonly capture: AudioCapture;
  readonly transcriber: Transcriber;
  /** What the engine listens for; it decides when the engine ends by itself. Default `search`. */
  readonly mode?: SpeechEngineMode;
}

type Action = 'pass' | 'close' | 'finish';

const config = SPEECH_ENGINE_CONFIG;
const msOf = (samples: number) => (samples * 1000) / config.sampleRate;

function concat(chunks: readonly Int16Array[], length: number): Int16Array {
  const all = new Int16Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    const part = chunk.subarray(0, Math.min(chunk.length, length - offset));
    all.set(part, offset);
    offset += part.length;
    if (offset >= length) break;
  }
  return all;
}

export function createWhisperSpeechEngine({
  capture,
  transcriber,
  mode = 'search',
}: WhisperSpeechEngineOptions): SpeechEngine {
  const limits = config[mode];
  const levelListeners = new Set<(level: number) => void>();
  const wordListeners = new Set<(words: readonly string[]) => void>();
  const endListeners = new Set<(reason: SpeechEndReason) => void>();

  /** Each listening has its number: what an earlier one finishes late is dropped. */
  let session = 0;
  let listening = false;
  let busy = false;

  // The state of one listening, reset by `start`.
  let activity: VoiceActivity = createVoiceActivity();
  let stabilizer: TranscriptStabilizer = createTranscriptStabilizer();
  let totalMs = 0;
  let voiceHeard = false;
  let silenceMs = 0;
  /** Audio before the phrase opens, at most `preRollMs`. */
  let preRoll: Int16Array[] = [];
  /** The open phrase: its chunks, and how many of its samples end with the last voice. */
  let phrase: Int16Array[] = [];
  let phraseSamples = 0;
  let phraseVoiceMs = 0;
  let samplesUpToLastVoice = 0;
  let samplesAtLastPass = 0;

  function reset(): void {
    activity = createVoiceActivity();
    stabilizer = createTranscriptStabilizer();
    totalMs = 0;
    voiceHeard = false;
    silenceMs = 0;
    preRoll = [];
    clearPhrase();
  }

  function clearPhrase(): void {
    phrase = [];
    phraseSamples = 0;
    phraseVoiceMs = 0;
    samplesUpToLastVoice = 0;
    samplesAtLastPass = 0;
  }

  function listen<Listener>(listeners: Set<Listener>, listener: Listener): Unsubscribe {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function giveWords(words: readonly string[]): void {
    if (words.length === 0) return;
    for (const listener of [...wordListeners]) listener(words);
  }

  /** Ends this listening: the microphone is closed, then the listeners are told why. */
  async function end(reason: SpeechEndReason): Promise<void> {
    if (!listening) return;
    listening = false;
    session += 1;
    await capture.stop().catch(() => undefined);
    for (const listener of [...endListeners]) listener(reason);
  }

  function onAudio(samples: Int16Array, current: number): void {
    if (!listening || current !== session) return;
    const { level } = chunkLoudness(samples);
    for (const listener of [...levelListeners]) listener(level);
    const isVoice = activity.isSpeech(samples);
    const ms = msOf(samples.length);
    totalMs += ms;
    if (isVoice) {
      voiceHeard = true;
      silenceMs = 0;
    } else {
      silenceMs += ms;
    }

    if (phrase.length === 0 && isVoice) {
      phrase = preRoll;
      phraseSamples = preRoll.reduce((sum, chunk) => sum + chunk.length, 0);
      preRoll = [];
    }
    if (phrase.length > 0) {
      phrase.push(samples);
      phraseSamples += samples.length;
      if (isVoice) {
        phraseVoiceMs += ms;
        samplesUpToLastVoice = phraseSamples;
      }
    } else {
      preRoll.push(samples);
      while (preRoll.length > 0 && msOf(preRoll.length * samples.length) > config.preRollMs) {
        preRoll.shift();
      }
    }
    void pump();
  }

  function nextAction(): Action | null {
    if (
      totalMs >= limits.maxListenMs ||
      (voiceHeard && silenceMs >= limits.endAfterSilenceMs) ||
      (!voiceHeard && totalMs >= limits.endWithoutVoiceMs)
    ) {
      return 'finish';
    }
    if (phrase.length === 0) return null;
    if (silenceMs >= config.phraseEndSilenceMs || msOf(phraseSamples) >= config.maxPhraseMs) {
      return 'close';
    }
    if (
      phraseVoiceMs >= config.minSpeechToTranscribeMs &&
      msOf(phraseSamples - samplesAtLastPass) >= config.passEveryMs
    ) {
      return 'pass';
    }
    return null;
  }

  /** The phrase's audio for Whisper: up to its last voice, plus a short tail of silence. */
  function phraseAudio(): Int16Array {
    const tail = (config.tailSilenceMs * config.sampleRate) / 1000;
    return concat(phrase, Math.min(phraseSamples, samplesUpToLastVoice + tail));
  }

  async function transcribeWords(audio: Int16Array): Promise<string[]> {
    return whisperWords(await transcriber.transcribe(audio));
  }

  async function pass(current: number): Promise<void> {
    samplesAtLastPass = phraseSamples;
    const words = await transcribeWords(phraseAudio());
    if (current === session) giveWords(stabilizer.update(words));
  }

  /** Closes the phrase: new audio starts the next one while this one is transcribed. */
  async function closePhrase(current: number): Promise<void> {
    const hasVoice = phraseVoiceMs >= config.minSpeechToTranscribeMs;
    const audio = phraseAudio();
    clearPhrase();
    const words = hasVoice ? await transcribeWords(audio) : [];
    if (current === session) giveWords(stabilizer.close(words));
  }

  async function pump(): Promise<void> {
    if (busy || !listening) return;
    const action = nextAction();
    if (action === null) return;
    const current = session;
    busy = true;
    try {
      if (action === 'pass') await pass(current);
      else if (action === 'close') await closePhrase(current);
      else {
        if (phrase.length > 0) await closePhrase(current);
        if (current === session) await end('finished');
      }
    } catch {
      if (current === session) await end('failed');
    } finally {
      busy = false;
    }
    if (current === session) void pump();
  }

  return {
    getMicrophonePermission: () => capture.getPermission(),
    requestMicrophonePermission: () => capture.requestPermission(),
    async start() {
      if (listening) await this.stop();
      if ((await capture.getPermission()) !== 'granted') {
        throw new Error('Speech engine: the microphone is not granted');
      }
      await transcriber.prepare();
      session += 1;
      const current = session;
      reset();
      busy = false;
      listening = true;
      try {
        await capture.start({
          onAudio: (samples) => onAudio(samples, current),
          onEnd: (reason) => {
            if (current === session) void end(reason);
          },
        });
      } catch (error) {
        listening = false;
        session += 1;
        throw error;
      }
    },
    async stop() {
      if (!listening) return;
      listening = false;
      session += 1;
      await capture.stop();
    },
    onLevel: (listener) => listen(levelListeners, listener),
    onWords: (listener) => listen(wordListeners, listener),
    onEnd: (listener) => listen(endListeners, listener),
  };
}
