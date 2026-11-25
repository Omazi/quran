/**
 * Public API of the recognition module (text only, no audio). Everything else in this
 * folder is private. See docs/specs/recognition.md and ./README.md.
 */
export { RECOGNITION_CONFIG } from './config';
export { isSameWordHeard } from './comparable-word';
export { createFollowSession } from './follow-session';
export { normalizeArabic, toAccentKey } from './normalize';
export { createVerseIndex } from './verse-index';
export type {
  FollowSession,
  FollowSnapshot,
  NotFoundReason,
  PassageCandidate,
  SearchLimits,
  SearchOptions,
  SearchResult,
  VerseIndex,
  VerseText,
  WordRef,
  WordStatus,
} from './types';
