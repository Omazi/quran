/**
 * The sounds and haptics of the reader's moments, by name (validated mockup of 27 November 2026:
 * the purple labels of shots 21 and 22). The reader only says which moment happened; the feedback
 * service (`@/features/feedback`) decides what plays, following the person's settings.
 *
 * - `drop`: a page counted and its drop starts to fall (the mockup's sound "goutte").
 * - `drop-received`: the drop lands in the glass pill (the mockup's sound "goutte reçue" and a
 *   light haptic, playing-haptics.md › Best practices: a short haptic for a discrete event,
 *   complementing what is seen). With Reduce Motion there is no fall: only this one plays.
 */

import type { FeedbackEvent } from '@/features/feedback';

export { playFeedback } from '@/features/feedback';
export type ReaderFeedbackEvent = Extract<FeedbackEvent, 'drop' | 'drop-received'>;
