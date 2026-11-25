import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo } from 'react-native';

import {
  listeningPhase,
  type ListeningState,
  type NothingFoundReason,
  type SpeechEngine,
  type SpeechFailure,
} from '@/domain/listening';
import type { QuranStructure } from '@/domain/quran';
import type { VerseIndex } from '@/domain/recognition';
import { useReducedMotion } from '@/ui';

import { describePassage } from './passage-words';
import { useListening } from './use-listening';
import type { LoadVerseText } from './use-verse-texts';
import { FoundView } from './views/found-view';
import { ListeningView, type ListeningViewPhase } from './views/listening-view';
import { OutcomeView } from './views/outcome-view';
import { PassagesView } from './views/passages-view';

export interface ListeningScreenProps {
  readonly engine: SpeechEngine;
  /** False when a link opened the screen: the microphone waits for the button. */
  readonly autoStart: boolean;
  readonly loadVerseIndex: () => Promise<VerseIndex>;
  readonly structure: Pick<QuranStructure, 'pageOfVerse' | 'surah'>;
  /** Reads a verse's text, shown exactly as stored: the verses found, the opening words of a place. */
  readonly loadVerseText: LoadVerseText;
  /** Leaves the screen. */
  readonly onClose: () => void;
  /** Opens the reader at a page of the mushaf. */
  readonly onOpenPage: (page: number) => void;
  /** Opens the app's page in the system settings, where the microphone is allowed. */
  readonly onOpenSettings: () => void;
}

/**
 * The words of each failure, in the `listening` namespace (`failed.<key>`): what broke and the fix,
 * never a vague "try again" (ux-writing: name the fix).
 */
const FAILED: Readonly<Record<SpeechFailure, string>> = {
  'microphone-unavailable': 'microphoneUnavailable',
  'no-audio': 'noAudio',
  'model-missing': 'modelMissing',
  'model-failed': 'modelFailed',
  'transcription-failed': 'transcriptionFailed',
  unknown: 'unknown',
};

/** Failures that listening again cannot fix: the one button closes. */
const FINAL_FAILURES: ReadonlySet<SpeechFailure> = new Set(['model-missing']);

/** The words of each way a listening can end without a passage, in the `listening` namespace. */
const NOT_FOUND: Readonly<Record<NothingFoundReason, string>> = {
  'nothing-heard': 'nothingHeard',
  'too-few-words': 'tooFewWords',
  'no-match': 'noMatch',
};

/**
 * The listening screen (docs/specs/listening.md): one gesture, a whole screen that listens, a
 * result that arrives plainly (D27). It composes the views of each state; the listening itself
 * is `useListening`, the rules are the domain's.
 */
export function ListeningScreen({
  engine,
  autoStart,
  loadVerseIndex,
  structure,
  loadVerseText,
  onClose,
  onOpenPage,
  onOpenSettings,
}: ListeningScreenProps) {
  const { t, i18n } = useTranslation('listening');
  const { state, heardWords, listenAgain, stop } = useListening({
    engine,
    loadVerseIndex,
    autoStart,
  });
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
          loadVerseText={loadVerseText}
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
          loadVerseText={loadVerseText}
          onOpenPage={onOpenPage}
          onListenAgain={listenAgain}
          onClose={onClose}
        />
      );
    case 'not-found': {
      const key = NOT_FOUND[state.reason];
      return (
        <OutcomeView
          title={t(`${key}.title`)}
          description={t(`${key}.description`)}
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
          action={{ label: t('actions.openSettings'), onPress: onOpenSettings }}
          {...close}
          testID="listening-microphone-denied"
        />
      );
    case 'failed': {
      const key = FAILED[state.failure];
      return (
        <OutcomeView
          title={t(`failed.${key}.title`)}
          description={t(`failed.${key}.description`)}
          action={FINAL_FAILURES.has(state.failure) ? undefined : again}
          {...close}
          testID="listening-failed"
        />
      );
    }
    case 'idle':
      // Waiting for the button: opened by a link, the microphone stays off until it is pressed.
      if (!autoStart) {
        return (
          <OutcomeView
            title={t('ready.title')}
            description={t('ready.description')}
            action={{ label: t('actions.start'), onPress: listenAgain }}
            {...close}
            testID="listening-ready"
          />
        );
      }
      return (
        <ListeningView
          subscribeToLevel={engine.onLevel}
          phase="preparing"
          heardWords={heardWords}
          onStop={stop}
          reducedMotion={reducedMotion}
        />
      );
    default:
      // Starting, listening, and the instant before a closed screen goes away.
      return (
        <ListeningView
          subscribeToLevel={engine.onLevel}
          phase={viewPhaseOf(state)}
          heardWords={heardWords}
          onStop={stop}
          reducedMotion={reducedMotion}
        />
      );
  }
}

/** What the listening view says: preparing until the microphone is open. */
function viewPhaseOf(state: ListeningState): ListeningViewPhase {
  return state.status === 'listening' ? listeningPhase(state) : 'preparing';
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
      return t(`${NOT_FOUND[state.reason]}.title`);
    case 'microphone-denied':
      return t('microphoneDenied.title');
    case 'failed':
      return t(`failed.${FAILED[state.failure]}.title`);
    default:
      return null;
  }
}
