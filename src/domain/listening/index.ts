/**
 * Public API of the listening module: the interface of a speech engine, the states of the
 * listening screen, and where a recognised passage is. Everything else in this folder is
 * private. See docs/specs/listening.md and ./README.md.
 */
export { INITIAL_LISTENING_STATE, transition } from './listening-machine';
export type {
  ListeningEvent,
  ListeningState,
  NothingFoundReason,
  TiedPassages,
} from './listening-machine';
export { locatePassage } from './passage-location';
export type { PassageLocation } from './passage-location';
export type { MicrophonePermission, SpeechEndReason, SpeechEngine, Unsubscribe } from './types';
