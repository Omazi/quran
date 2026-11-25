/**
 * The listening screen (docs/specs/listening.md). Not linked from any button while the real
 * speech engine (D5) does not exist: it opens by its route, for trials.
 */
export { ListeningScreen, type ListeningScreenProps } from './listening-screen';
export { createTrialEngine } from './simulated-engine-door';
export { useListeningNavigation, readerHref } from './use-listening-navigation';
export { loadQuranVerseIndex, loadQuranVerseText } from './verse-index-source';
