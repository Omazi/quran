/**
 * Public API of the listening module: the interface of a speech engine, the states of the
 * listening screen, and where a recognised passage is. Everything else in this folder is
 * private. See docs/specs/listening.md and ./README.md.
 */
export { INITIAL_LISTENING_STATE, listeningPhase, transition } from './listening-machine';
export type {
  ListeningEvent,
  ListeningPhase,
  ListeningState,
  NothingFoundReason,
  TiedPassages,
} from './listening-machine';
export { HEARD_SEARCH, searchHeardWords, searchWithPartialWords } from './heard-search';
export { locatePassage } from './passage-location';
export { followRecitation, startFollowing } from './recitation-follow';
export type { FollowState } from './recitation-follow';
export type { PassageLocation } from './passage-location';
export { SpeechEngineError, failureOf } from './types';
export {
  AUDIO_CHECK,
  audioCheckCandidates,
  decideByAudio,
  heldText,
  minLettersFor,
} from './audio-check';
export type { AudioCheckCandidate, AudioCheckDecision } from './audio-check';
export type {
  MicrophonePermission,
  SpeechActivity,
  SpeechEndReason,
  SpeechEngine,
  SpeechFailure,
  HeldCheck,
  HeldReading,
  Unsubscribe,
} from './types';
