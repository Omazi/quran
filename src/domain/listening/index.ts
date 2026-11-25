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
export { HEARD_SEARCH, searchHeardWords } from './heard-search';
export { locatePassage } from './passage-location';
export { followRecitation, startFollowing } from './recitation-follow';
export type { FollowState } from './recitation-follow';
export type { PassageLocation } from './passage-location';
export { SpeechEngineError, failureOf } from './types';
export type {
  MicrophonePermission,
  SpeechActivity,
  SpeechEndReason,
  SpeechEngine,
  SpeechFailure,
  Unsubscribe,
} from './types';
