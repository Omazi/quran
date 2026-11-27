/**
 * The listening screens (docs/specs/listening.md): finding a passage, and the parts of following a
 * recitation that the reader uses (the engine, the bar of voix.png),
 * with the phone's speech engine (D42), or the simulated one in development and test builds.
 */
export { ListeningScreen, type ListeningScreenProps } from './listening-screen';
export { createFollowEngine, createListeningEngine } from './speech-engine-door';
export { parseFollowParams, type FollowParams } from './follow/follow-params';
export { useListeningNavigation, readerHref } from './use-listening-navigation';
export {
  loadQuranHeldTexts,
  loadQuranPage,
  loadQuranVerseIndex,
  loadQuranVerseText,
} from './verse-index-source';
export { checkHeardWords, type HeldTexts } from './held-check';
export {
  forgetOpenedInApp,
  markOpenedInApp,
  wasOpenedInApp,
  type MicrophoneRoute,
} from './in-app-open';
export { useOpenRecognition } from './use-open-recognition';
