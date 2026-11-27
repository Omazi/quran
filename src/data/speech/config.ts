/**
 * Named settings of the speech engine on the phone (docs/DECISIONS.md, D5 and D42). Times are in
 * milliseconds, loudness in dB of full scale (0 dB is the loudest a microphone sample can be).
 */
export const SPEECH_ENGINE_CONFIG = Object.freeze({
  /** Whisper hears 16 kHz mono: the native capture converts the microphone to it. */
  sampleRate: 16000,
  /** The native capture sends the audio in pieces this long: also how often the level moves. */
  chunkMs: 100,

  /** The level shown on screen is 0 at or below this loudness… */
  levelFloorDb: -55,
  /** …and 1 at or above this one. */
  levelCeilingDb: -15,

  /** A sound quieter than this is never a voice, however quiet the room is. */
  minSpeechDb: -50,
  /** A voice is at least this much louder than the room's own noise. */
  speechAboveRoomDb: 9,
  /** The noise of the room as first assumed, before anything is measured. */
  initialRoomDb: -60,
  /** How fast the estimate of the room's noise rises towards a louder chunk (share per chunk). */
  roomRiseShare: 0.01,

  /**
   * Whisper writes words even over silence (measured: one word on a silent clip, D42). So the
   * audio is only transcribed once it holds at least this much voice.
   */
  minSpeechToTranscribeMs: 500,
  /** While someone recites, the audio heard so far is transcribed again every this often. */
  passEveryMs: 1200,
  /** A pause this long after a voice closes a phrase: its last words are given at once. */
  phraseEndSilenceMs: 700,
  /** Audio kept before the first voice of a phrase, so its first syllable is not cut. */
  preRollMs: 300,
  /** Silence kept after the last voice of a phrase; the rest is not given to Whisper. */
  tailSilenceMs: 300,
  /**
   * Whisper reads at most 30 seconds at a time. A phrase longer than this is closed here, even
   * without a pause, keeping a margin for the time a pass takes.
   */
  maxPhraseMs: 24000,
  /**
   * The same word repeated more often than this in a row is Whisper looping, not a recitation
   * (the Quran repeats a word at most twice in a row, as in 89:21 « دكا دكا »).
   */
  maxRepeatedWord: 2,

  /** A voice stays "heard" on screen through gaps between syllables shorter than this. */
  voiceHoldMs: 400,

  /**
   * Limits on the clock, so that nothing hangs without saying so (the limits above count the
   * audio received, and count nothing when no audio comes):
   * - no sound at all this long after the microphone opened: the microphone gives nothing;
   */
  noAudioMs: 3000,
  /**
   * - loading the model takes longer than this: it is treated as failed. A minute: on a phone it
   *   takes about a second, but the iOS check's simulator (Mac CPU, first load) took more than
   *   30 s (D47); the screen says "preparing" meanwhile, and the model is loaded ahead of time
   *   (`preloadVoiceModel`) so that the person rarely waits for it;
   */
  prepareTimeoutMs: 60000,
  /** - one reading by Whisper takes longer than this: it is treated as failed; */
  transcribeTimeoutMs: 20000,
  /** - the listening outlasts its own `maxListenMs` by this much on the clock: it ends. */
  clockSlackMs: 3000,

  /** Finding a passage (`/listening`): the engine ends by itself after this long… */
  search: {
    maxListenMs: 30000,
    /** …or after this much silence once a voice was heard (a slow reciter breathes between
     * verses)… */
    endAfterSilenceMs: 4000,
    /** …or when no voice came at all for this long. */
    endWithoutVoiceMs: 8000,
  },
  /** Following a recitation (`/voice-follow`, the reader): it listens until stopped… */
  follow: {
    maxListenMs: Number.POSITIVE_INFINITY,
    /** …unless nobody recites for this long. */
    endAfterSilenceMs: 60000,
    endWithoutVoiceMs: 60000,
  },
});

/** What the engine listens for: a passage to find, or a recitation to follow. */
export type SpeechEngineMode = 'search' | 'follow';
