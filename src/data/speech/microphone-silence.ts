import { appSuppression, type Suppression } from '@/data/feedback';
import type { SpeechEngine } from '@/domain/listening';

/**
 * Makes the interface feedback (sounds and haptics) silent for as long as the engine listens: a
 * sound would enter the recitation, and iOS mutes haptics while the microphone is open anyway.
 * The engine is given back as it was; only `start` and `stop` also tell the suppression.
 *
 * The microphone counts as open from the start of `start` (the native module takes the audio
 * session then), until `stop` is done, `start` fails, or the engine ends by itself.
 */
export function silenceWhileListening(
  engine: SpeechEngine,
  suppression: Suppression = appSuppression,
): SpeechEngine {
  const open = (isOpen: boolean) => suppression.set('microphone', isOpen);
  engine.onEnd(() => open(false));
  return {
    getMicrophonePermission: () => engine.getMicrophonePermission(),
    requestMicrophonePermission: () => engine.requestMicrophonePermission(),
    async start() {
      open(true);
      try {
        await engine.start();
      } catch (error) {
        open(false);
        throw error;
      }
    },
    async stop() {
      try {
        await engine.stop();
      } finally {
        open(false);
      }
    },
    onLevel: (listener) => engine.onLevel(listener),
    onWords: (listener) => engine.onWords(listener),
    onEnd: (listener) => engine.onEnd(listener),
    onActivity: engine.onActivity?.bind(engine),
  };
}
