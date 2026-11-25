import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo } from 'react-native';

import type { ListeningState, NothingFoundReason, SpeechEngine } from '@/domain/listening';
import type { QuranStructure } from '@/domain/quran';
import type { VerseIndex } from '@/domain/recognition';
import { useReducedMotion, type IconSymbol } from '@/ui';

import { describePassage } from './passage-words';
import { useListening } from './use-listening';
import { FoundView } from './views/found-view';
import { ListeningView } from './views/listening-view';
import { OutcomeView } from './views/outcome-view';
import { PassagesView } from './views/passages-view';

export interface ListeningScreenProps {
  readonly engine: SpeechEngine;
  readonly loadVerseIndex: () => Promise<VerseIndex>;
  readonly structure: Pick<QuranStructure, 'pageOfVerse' | 'surah'>;
  /** Leaves the screen. */
  readonly onClose: () => void;
  /** Opens the reader at a page of the mushaf. */
  readonly onOpenPage: (page: number) => void;
  /** Opens the app's page in the system settings, where the microphone is allowed. */
  readonly onOpenSettings: () => void;
}

const NOT_FOUND: Readonly<Record<NothingFoundReason, { key: string; symbol: IconSymbol }>> = {
  'nothing-heard': { key: 'nothingHeard', symbol: { ios: 'waveform', android: 'graphic_eq' } },
  'too-few-words': {
    key: 'tooFewWords',
    symbol: { ios: 'text.word.spacing', android: 'short_text' },
  },
  'no-match': { key: 'noMatch', symbol: { ios: 'text.magnifyingglass', android: 'search_off' } },
};
const MICROPHONE_SYMBOL: IconSymbol = { ios: 'mic.slash', android: 'mic_off' };
const FAILED_SYMBOL: IconSymbol = { ios: 'exclamationmark.triangle', android: 'warning' };

/**
 * The listening screen (docs/specs/listening.md): one gesture, a whole screen that listens, a
 * result that arrives plainly (D27). It composes the views of each state; the listening itself
 * is `useListening`, the rules are the domain's.
 */
export function ListeningScreen({
  engine,
  loadVerseIndex,
  structure,
  onClose,
  onOpenPage,
  onOpenSettings,
}: ListeningScreenProps) {
  const { t, i18n } = useTranslation('listening');
  const { state, listenAgain, stop } = useListening({ engine, loadVerseIndex });
  const reducedMotion = useReducedMotion();

  const describe = (passage: Parameters<typeof describePassage>[0]) =>
    describePassage(passage, structure, t, i18n.language);

  // VoiceOver hears the state, never the drawing (voiceover.md › Navigation: say when the
  // content changes).
  const announcement = announcementOf(state, t, describe);
  useEffect(() => {
    if (announcement !== null) AccessibilityInfo.announceForAccessibility(announcement);
  }, [announcement]);

  const closed = state.status === 'closed';
  useEffect(() => {
    if (closed) onClose();
  }, [closed, onClose]);

  const close = { closeLabel: t('actions.close'), onClose };
  const again = { label: t('actions.listenAgain'), onPress: listenAgain };

  switch (state.status) {
    case 'found':
      return (
        <FoundView
          passage={describe(state.passage)}
          onOpenPage={onOpenPage}
          onListenAgain={listenAgain}
          onClose={onClose}
        />
      );
    case 'ambiguous':
      return (
        <PassagesView
          passages={state.passages.candidates.map(describe)}
          totalCount={state.passages.totalCount}
          isComplete={state.passages.isComplete}
          onOpenPage={onOpenPage}
          onListenAgain={listenAgain}
          onClose={onClose}
        />
      );
    case 'not-found': {
      const { key, symbol } = NOT_FOUND[state.reason];
      return (
        <OutcomeView
          title={t(`${key}.title`)}
          description={t(`${key}.description`)}
          symbol={symbol}
          action={again}
          {...close}
          testID="listening-not-found"
        />
      );
    }
    case 'microphone-denied':
      return (
        <OutcomeView
          title={t('microphoneDenied.title')}
          description={t('microphoneDenied.description')}
          symbol={MICROPHONE_SYMBOL}
          action={{ label: t('actions.openSettings'), onPress: onOpenSettings }}
          {...close}
          testID="listening-microphone-denied"
        />
      );
    case 'failed':
      return (
        <OutcomeView
          title={t('failed.title')}
          description={t('failed.description')}
          symbol={FAILED_SYMBOL}
          action={again}
          {...close}
          testID="listening-failed"
        />
      );
    default:
      // Idle, starting, listening, and the instant before a closed screen goes away.
      return (
        <ListeningView
          subscribeToLevel={engine.onLevel}
          onStop={stop}
          reducedMotion={reducedMotion}
        />
      );
  }
}

/** What VoiceOver says when the screen reaches a state; null where nothing new is shown. */
function announcementOf(
  state: ListeningState,
  t: ReturnType<typeof useTranslation<'listening'>>['t'],
  describe: (passage: Extract<ListeningState, { status: 'found' }>['passage']) => {
    surah: string;
    verses: string;
  },
): string | null {
  switch (state.status) {
    case 'listening':
      return t('listening.announcement');
    case 'found': {
      const { surah, verses } = describe(state.passage);
      return t('found.announcement', { surah, verses });
    }
    case 'ambiguous':
      return t('several.title');
    case 'not-found':
      return t(`${NOT_FOUND[state.reason].key}.title`);
    case 'microphone-denied':
      return t('microphoneDenied.title');
    case 'failed':
      return t('failed.title');
    default:
      return null;
  }
}
