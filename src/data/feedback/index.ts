/**
 * The feel of the app: sounds and haptics for its moments (the "wow" experience). A screen says
 * what happened (`playFeedback('grow')`, from `@/features/feedback`); the recipes decide which
 * sound and which haptic, the service applies the person's settings, the silences and the
 * throttling, and the device adapters play them (expo-audio, expo-haptics).
 */
export {
  FEEDBACK_EVENTS,
  FEEDBACK_RECIPES,
  SOUND_NAMES,
  isFeedbackEvent,
  type FeedbackEvent,
  type FeedbackRecipe,
  type HapticKind,
  type SoundName,
} from './recipes';
export {
  DEFAULT_FEEDBACK_PREFERENCES,
  MIN_HAPTIC_GAP_MS,
  createFeedbackService,
  type FeedbackPreferences,
  type FeedbackService,
  type FeedbackServiceOptions,
  type HapticsPort,
  type SoundsPort,
} from './service';
export {
  appSuppression,
  createSuppression,
  type Suppression,
  type SuppressionListener,
  type SuppressionReason,
} from './suppression';
export { deviceFeedback } from './device-feedback';
