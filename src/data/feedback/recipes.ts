/**
 * What each moment of the app does to the senses: a sound of the palette (assets/sounds), a
 * haptic, both or one of them. The events are the ones of the validated "wow" mockup
 * (mockups-wow/js/fx.js and docs/design/maquette-wow): the screens only say what happened
 * (`playFeedback('grow')`), this table decides how it is felt.
 */

/** A moment of the app that is felt. */
export const FEEDBACK_EVENTS = [
  'drop',
  'drop-received',
  'grow',
  'open',
  'page',
  'found',
  'splash',
  'celebrate',
  'encourage',
  'select',
  'error',
] as const;

export type FeedbackEvent = (typeof FEEDBACK_EVENTS)[number];

/** The ten sounds of the palette: one file each in `assets/sounds`. */
export const SOUND_NAMES = [
  'drop',
  'plop',
  'grow',
  'open',
  'page',
  'found',
  'splash',
  'celebrate',
  'encourage',
  'error',
] as const;

export type SoundName = (typeof SOUND_NAMES)[number];

/**
 * The haptics used (Apple's playing-haptics guidance): a selection tick, a light impact for a
 * small physical event, a success or a warning notification for an outcome.
 */
export type HapticKind = 'selection' | 'light' | 'medium' | 'success' | 'warning';

export interface FeedbackRecipe {
  /** The sound played, or null for an event felt only through the hand. */
  readonly sound: SoundName | null;
  /** The haptic played, or null for an event heard only. */
  readonly haptic: HapticKind | null;
  /**
   * The shortest time between two plays of this event: a repeat inside it is dropped, so that a
   * fast swipe or a stuttering screen never turns into a rattle.
   */
  readonly minIntervalMs: number;
}

export const FEEDBACK_RECIPES: Readonly<Record<FeedbackEvent, FeedbackRecipe>> = Object.freeze({
  // The drop forms and falls: heard, not felt (the touch is for the moment it lands).
  drop: { sound: 'drop', haptic: null, minIntervalMs: 400 },
  // It lands in the garden's pill: a soft plop and a light touch.
  'drop-received': { sound: 'plop', haptic: 'light', minIntervalMs: 400 },
  // The tree grows a step.
  grow: { sound: 'grow', haptic: 'light', minIntervalMs: 600 },
  // A screen opens out of its button (reader, listening, a friend's garden).
  open: { sound: 'open', haptic: 'light', minIntervalMs: 500 },
  // A page turns, a page is passed: the lightest of the palette.
  page: { sound: 'page', haptic: 'selection', minIntervalMs: 120 },
  // A passage is found.
  found: { sound: 'found', haptic: 'success', minIntervalMs: 800 },
  splash: { sound: 'splash', haptic: 'light', minIntervalMs: 500 },
  // A hizb or a khatma is completed.
  celebrate: { sound: 'celebrate', haptic: 'success', minIntervalMs: 2000 },
  // A heart sent to a friend.
  encourage: { sound: 'encourage', haptic: 'success', minIntervalMs: 800 },
  // A choice under the finger (a switch, a segment, a step): the hand only.
  select: { sound: null, haptic: 'selection', minIntervalMs: 60 },
  error: { sound: 'error', haptic: 'warning', minIntervalMs: 800 },
});

/** True for a name of `FEEDBACK_EVENTS`. */
export function isFeedbackEvent(value: unknown): value is FeedbackEvent {
  return typeof value === 'string' && (FEEDBACK_EVENTS as readonly string[]).includes(value);
}
