/**
 * The reasons for the app to stay silent, whatever the person's settings say. Feedback is a
 * courtesy: it must never be heard over the person's recitation, nor when the app is not the one
 * the person is looking at.
 *
 *  - `microphone`: the speech engine listens (the listening screen, the reader's follow mode). A
 *    sound would enter the recording, and iOS mutes haptics while the microphone is open anyway.
 *  - `interruption`: a call, an alarm or another app took the audio session.
 *  - `app-inactive`: the app is in the background or covered (Control Center, a call banner).
 */
export type SuppressionReason = 'microphone' | 'interruption' | 'app-inactive';

export type SuppressionListener = (reason: SuppressionReason, active: boolean) => void;

export interface Suppression {
  /** Turns a reason on or off. Nothing happens, and nobody is told, when it does not change. */
  set(reason: SuppressionReason, active: boolean): void;
  /** True while at least one reason is on. */
  isSuppressed(): boolean;
  /** Told each time a reason changes; returns the way to stop. */
  subscribe(listener: SuppressionListener): () => void;
}

export function createSuppression(): Suppression {
  const reasons = new Set<SuppressionReason>();
  const listeners = new Set<SuppressionListener>();
  return {
    set(reason, active) {
      if (reasons.has(reason) === active) return;
      if (active) reasons.add(reason);
      else reasons.delete(reason);
      for (const listener of [...listeners]) listener(reason, active);
    },
    isSuppressed: () => reasons.size > 0,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * The one suppression of the app. The speech engine (src/data/speech) turns `microphone` on and
 * off on it; the feedback service reads it.
 */
export const appSuppression: Suppression = createSuppression();
