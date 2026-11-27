/**
 * The sounds and haptics of the reader's moments, by name (validated mockup of 27 November 2026:
 * the purple labels of shots 21 and 22). The reader only says which moment happened; what plays
 * is decided elsewhere (the sound and haptics work, branch `work/wow-feedback`, wires this stub).
 *
 * - `drop`: a page counted and its drop starts to fall (the mockup's sound "goutte").
 * - `drop-received`: the drop lands in the glass pill (the mockup's sound "goutte reçue" and a
 *   light haptic, playing-haptics.md › Best practices: a short haptic for a discrete event,
 *   complementing what is seen). With Reduce Motion there is no fall: only this one plays.
 */

export type ReaderFeedbackEvent = 'drop' | 'drop-received';

/** Plays the sound or haptic of a moment. A stub until the feedback work wires it: it does nothing. */
export function playFeedback(event: ReaderFeedbackEvent): void {
  void event;
}
