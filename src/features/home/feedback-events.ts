/**
 * The sound and haptic moments of the home garden (maquette-wow, the purple labels of shot 25:
 * « son : pousse », « vibration : légère »). The feedback service (work/wow-feedback,
 * src/data/feedback) plays them; until it is wired here, an event is only told, never played.
 */

/** `grow`: the plant grows one step at the end of the return glide (a sound and a light haptic). */
export type HomeFeedbackEvent = 'grow';

/** Plays the sound and the haptic of an event. Never throws: feedback is never in the way. */
export function playFeedback(event: HomeFeedbackEvent): void {
  // Wired by the feedback service (work/wow-feedback); nothing plays before it.
  void event;
}
