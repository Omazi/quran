import type { HapticKind, SoundName } from './recipes';
import type { HapticsPort, SoundsPort } from './service';

/** How loud the sounds play, of the volume the person set on the phone (the files peak near -4 dBFS). */
export const FEEDBACK_VOLUME = 0.8;

// ---------------------------------------------------------------------------------------------
// Haptics (expo-haptics, MIT)
// ---------------------------------------------------------------------------------------------

/** The part of `expo-haptics` that is used (what a test replaces). */
export interface ExpoHapticsModule {
  selectionAsync(): Promise<void>;
  impactAsync(style: unknown): Promise<void>;
  notificationAsync(type: unknown): Promise<void>;
  readonly ImpactFeedbackStyle: { readonly Light: unknown; readonly Medium: unknown };
  readonly NotificationFeedbackType: { readonly Success: unknown; readonly Warning: unknown };
}

/**
 * The haptics of the phone. iOS plays nothing when the person turned the system's haptics off
 * (playing-haptics.md › Make haptics optional), and a rejected call is not an error for the app.
 */
export function createExpoHaptics(haptics: ExpoHapticsModule): HapticsPort {
  // A call that fails, or answers nothing (a test double, an old binary), is not an error here.
  const swallow = (done: Promise<void> | undefined) => {
    Promise.resolve(done).catch(() => undefined);
  };
  return {
    play(kind: HapticKind) {
      switch (kind) {
        case 'selection':
          swallow(haptics.selectionAsync());
          return;
        case 'light':
          swallow(haptics.impactAsync(haptics.ImpactFeedbackStyle.Light));
          return;
        case 'medium':
          swallow(haptics.impactAsync(haptics.ImpactFeedbackStyle.Medium));
          return;
        case 'success':
          swallow(haptics.notificationAsync(haptics.NotificationFeedbackType.Success));
          return;
        case 'warning':
          swallow(haptics.notificationAsync(haptics.NotificationFeedbackType.Warning));
          return;
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Sounds (expo-audio, MIT)
// ---------------------------------------------------------------------------------------------

/** One sound loaded: the part of an `expo-audio` player that is used. */
export interface ExpoAudioPlayer {
  volume: number;
  seekTo(seconds: number): Promise<void>;
  play(): void;
  remove(): void;
}

/** The part of `expo-audio` that is used (what a test replaces). */
export interface ExpoAudioModule {
  setAudioModeAsync(mode: {
    playsInSilentMode: boolean;
    interruptionMode: 'mixWithOthers' | 'duckOthers' | 'doNotMix' | 'doNotMixPersistent';
    allowsRecording: boolean;
    shouldPlayInBackground: boolean;
  }): Promise<void>;
  createAudioPlayer(
    source: number,
    options?: { updateInterval?: number; keepAudioSessionActive?: boolean },
  ): ExpoAudioPlayer;
}

/** The asset ids of the files (what `require('x.m4a')` gives under Metro). */
export type SoundFiles = Readonly<Partial<Record<SoundName, number>>>;

export interface ExpoSoundsOptions {
  /** Gives `expo-audio`. Throws when it is not there: the palette is then silent. */
  readonly loadAudio: () => ExpoAudioModule;
  /** Gives the files. Called when the sounds are prepared, not when this module loads. */
  readonly loadFiles: () => SoundFiles;
}

/**
 * The sounds of the phone, with `expo-audio`: one player per sound, created in advance and
 * rewound to the start for each play, so that a sound starts at once.
 *
 * The session is set to "ambient" (`playsInSilentMode: false` with mixing): the ring/silent
 * switch silences the palette, the person's music or podcast keeps playing under it, and the
 * session never asks for the microphone.
 */
export function createExpoSounds({ loadAudio, loadFiles }: ExpoSoundsOptions): SoundsPort {
  const players = new Map<SoundName, ExpoAudioPlayer>();
  let audio: ExpoAudioModule | null | undefined;

  function module(): ExpoAudioModule | null {
    if (audio === undefined) {
      try {
        audio = loadAudio();
      } catch {
        audio = null;
      }
    }
    return audio;
  }

  return {
    async configureSession() {
      const expoAudio = module();
      if (expoAudio === null) return;
      try {
        await expoAudio.setAudioModeAsync({
          playsInSilentMode: false,
          interruptionMode: 'mixWithOthers',
          allowsRecording: false,
          shouldPlayInBackground: false,
        });
      } catch {
        // The session stays as it is: sounds may play louder or quieter than meant, not break.
      }
    },

    async prepare(sounds) {
      const expoAudio = module();
      if (expoAudio === null) return;
      let files: SoundFiles;
      try {
        files = loadFiles();
      } catch {
        return;
      }
      for (const name of sounds) {
        const file = files[name];
        if (file === undefined || players.has(name)) continue;
        try {
          const player = expoAudio.createAudioPlayer(file, {
            updateInterval: 1000,
            keepAudioSessionActive: true,
          });
          player.volume = FEEDBACK_VOLUME;
          players.set(name, player);
        } catch {
          // One file that does not load leaves a hole in the palette, not a crash.
        }
      }
    },

    play(sound) {
      const player = players.get(sound);
      if (player === undefined) return;
      try {
        // A finished sound stays at its end: rewind, then play. Both calls go to the same queue.
        player.seekTo(0).catch(() => undefined);
        player.play();
      } catch {
        // The player was released or the audio is unavailable.
      }
    },
  };
}
