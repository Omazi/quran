/**
 * Sounds and haptics for the moments of the app (docs/design/maquette-wow). A screen says what
 * happened and never how it is felt:
 *
 *   playFeedback('grow');
 *
 * The person's switches ("Sons", "Vibrations"), the phone's silent switch, the silence while the
 * microphone listens, and the throttling are all handled below this call, which never throws and
 * never waits. See src/data/feedback.
 */
import { deviceFeedback, type FeedbackEvent, type HapticKind } from '@/data/feedback';

export { FEEDBACK_EVENTS, type FeedbackEvent } from '@/data/feedback';
export { useFeedbackSetup } from './use-feedback-setup';
export { startFeedback, type AppStateSource, type StartFeedbackOptions } from './start-feedback';

/** Feels an event: its sound and its haptic, as the person's settings allow. */
export function playFeedback(event: FeedbackEvent): void {
  deviceFeedback.play(event);
}

/**
 * A haptic with no sound, for a gesture that only ever had one (a press, a bookmark). It follows
 * the "Vibrations" switch and the same silences as `playFeedback`.
 */
export function playHaptic(kind: HapticKind): void {
  deviceFeedback.haptic(kind);
}
