import {
  FEEDBACK_RECIPES,
  SOUND_NAMES,
  isFeedbackEvent,
  type FeedbackEvent,
  type HapticKind,
  type SoundName,
} from './recipes';
import type { Suppression } from './suppression';

/** What plays a haptic. It must never throw for a missing motor: a phone without one is silent. */
export interface HapticsPort {
  play(kind: HapticKind): void;
}

/** What plays the sounds of the palette. */
export interface SoundsPort {
  /**
   * Sets the audio session for short interface sounds: the silent switch is respected and other
   * audio keeps playing (iOS category "ambient", mixing).
   */
  configureSession(): Promise<void>;
  /** Loads the sounds, so that playing one later is immediate. */
  prepare(sounds: readonly SoundName[]): Promise<void>;
  /** Starts a sound from its beginning, at once. Does nothing for a sound not loaded yet. */
  play(sound: SoundName): void;
}

/** What the person chose (settings "Sons" and "Vibrations"). */
export interface FeedbackPreferences {
  readonly soundsEnabled: boolean;
  readonly hapticsEnabled: boolean;
}

/** The shortest time between two haptics of any kind: the Taptic Engine blurs anything closer. */
export const MIN_HAPTIC_GAP_MS = 40;

export interface FeedbackServiceOptions {
  readonly haptics: HapticsPort;
  readonly sounds: SoundsPort;
  readonly suppression: Suppression;
  /** The clock, in milliseconds. */
  readonly now: () => number;
  /** What is chosen at the start. Both on by default. */
  readonly preferences?: FeedbackPreferences;
}

export interface FeedbackService {
  /**
   * Feels an event: its sound and its haptic, each only if the person wants it, and nothing at all
   * while the microphone listens or the app is not in front. Never throws, never waits.
   */
  play(event: FeedbackEvent): void;
  /**
   * A haptic with no sound, for the places that only had a haptic before the palette existed
   * (onboarding, bookmarks): the same switch, silences and spacing as `play`.
   */
  haptic(kind: HapticKind): void;
  /** Applies the person's settings. */
  configure(preferences: FeedbackPreferences): void;
  /** Sets the audio session and loads the sounds. Safe to call again: it runs once. */
  prepare(): Promise<void>;
}

export const DEFAULT_FEEDBACK_PREFERENCES: FeedbackPreferences = {
  soundsEnabled: true,
  hapticsEnabled: true,
};

/**
 * True when `time` is less than `gap` after `before`. A clock that went backwards (the phone's
 * time was corrected) is never "too soon": the pause counts from the new time, not the old one.
 */
function isTooSoon(time: number, before: number, gap: number): boolean {
  const elapsed = time - before;
  return elapsed >= 0 && elapsed < gap;
}

export function createFeedbackService({
  haptics,
  sounds,
  suppression,
  now,
  preferences = DEFAULT_FEEDBACK_PREFERENCES,
}: FeedbackServiceOptions): FeedbackService {
  let current = preferences;
  let prepared: Promise<void> | null = null;
  const lastPlayed = new Map<FeedbackEvent, number>();
  let lastHapticAt = Number.NEGATIVE_INFINITY;

  // The microphone module sets its own audio category while it records. When it lets go, ours is
  // set again, before the next sound, instead of at the moment of the sound.
  suppression.subscribe((reason, active) => {
    if (reason === 'microphone' && !active) {
      sounds.configureSession().catch(() => undefined);
    }
  });

  return {
    play(event) {
      if (!isFeedbackEvent(event)) return;
      if (suppression.isSuppressed()) return;
      const wantsSound = current.soundsEnabled;
      const wantsHaptic = current.hapticsEnabled;
      if (!wantsSound && !wantsHaptic) return;
      const recipe = FEEDBACK_RECIPES[event];
      const sound = wantsSound ? recipe.sound : null;
      let haptic = wantsHaptic ? recipe.haptic : null;
      if (sound === null && haptic === null) return;

      const time = now();
      const before = lastPlayed.get(event);
      if (before !== undefined && isTooSoon(time, before, recipe.minIntervalMs)) return;
      // Two haptics too close are one smear: the sound of the second still plays.
      if (haptic !== null && isTooSoon(time, lastHapticAt, MIN_HAPTIC_GAP_MS)) haptic = null;
      if (sound === null && haptic === null) return;
      lastPlayed.set(event, time);

      if (sound !== null) {
        try {
          sounds.play(sound);
        } catch {
          // No audio: the app goes on.
        }
      }
      if (haptic !== null) {
        lastHapticAt = time;
        try {
          haptics.play(haptic);
        } catch {
          // No haptic engine: the app goes on.
        }
      }
    },

    haptic(kind) {
      if (!current.hapticsEnabled || suppression.isSuppressed()) return;
      const time = now();
      if (isTooSoon(time, lastHapticAt, MIN_HAPTIC_GAP_MS)) return;
      lastHapticAt = time;
      try {
        haptics.play(kind);
      } catch {
        // No haptic engine: the app goes on.
      }
    },

    configure(next) {
      current = next;
    },

    prepare() {
      prepared ??= (async () => {
        try {
          await sounds.configureSession();
          await sounds.prepare(SOUND_NAMES);
        } catch {
          // Without audio the palette stays silent; the haptics still work.
        }
      })();
      return prepared;
    },
  };
}
