import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo } from 'react-native';

import type { ListeningState, NothingFoundReason, SpeechEngine } from '@/domain/listening';
import type { QuranStructure } from '@/domain/quran';
import type { VerseIndex } from '@/domain/recognition';
import { useReducedMotion } from '@/ui';

import { describePassage } from './passage-words';
import { useListening } from './use-listening';
import type { LoadVerseText } from './use-verse-texts';
import { ListeningStage } from './scene/listening-stage';
import { MICROPHONE_OFF_SYMBOL, MICROPHONE_SYMBOL } from './scene/voice-orb';
import { FoundCard } from './views/found-card';
import { OutcomeCard } from './views/outcome-card';
import { PlacesCard } from './views/places-card';

export interface ListeningScreenProps {
  readonly engine: SpeechEngine;
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

/** The words of each way a listening can end without a passage, in the `listening` namespace. */
const NOT_FOUND: Readonly<Record<NothingFoundReason, string>> = {
  'nothing-heard': 'nothingHeard',
  'too-few-words': 'tooFewWords',
  'no-match': 'noMatch',
};

/**
 * The listening screen (docs/specs/listening.md), drawn as the validated mockup shazam.png: one
 * gesture, a whole screen that listens, a result that arrives plainly in a card (D27). It
 * composes the scene and the card of each state; the listening itself is `useListening`, the
 * rules are the domain's.
 */
export function ListeningScreen({
  engine,
  loadVerseIndex,
  structure,
  loadVerseText,
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

  const header = {
    title: t('listening.heading'),
    backLabel: t('actions.back'),
    onBack: onClose,
  };
  const isActive =
    state.status === 'idle' || state.status === 'starting' || state.status === 'listening';
  const isDenied = state.status === 'microphone-denied';
  // The microphone is the one gesture of the scene: it stops a listening, listens again after
  // one, or, when the microphone is off, opens the settings where it is allowed.
  const orb = {
    subscribeToLevel: isActive ? engine.onLevel : null,
    reducedMotion,
    symbol: isDenied ? MICROPHONE_OFF_SYMBOL : MICROPHONE_SYMBOL,
    accessibilityLabel: isActive
      ? t('listening.stop')
      : isDenied
        ? t('actions.openSettings')
        : t('actions.listenAgain'),
    onPress: isActive ? stop : isDenied ? onOpenSettings : listenAgain,
  };
  const again = { label: t('actions.listenAgain'), onPress: listenAgain };

  return (
    <ListeningStage
      testID="listening"
      header={isActive ? { ...header, subtitle: t('listening.prompt') } : header}
      orb={orb}
      card={cardOf()}
    />
  );

  function cardOf(): ReactNode {
    switch (state.status) {
      case 'found': {
        const passage = describe(state.passage);
        return (
          <FoundCard passage={passage} loadVerseText={loadVerseText} onOpenPage={onOpenPage} />
        );
      }
      case 'ambiguous': {
        const { passages } = state;
        return (
          <PlacesCard
            passages={passages.candidates.map(describe)}
            totalCount={passages.totalCount}
            isComplete={passages.isComplete}
            loadVerseText={loadVerseText}
            onOpenPage={onOpenPage}
          />
        );
      }
      case 'not-found': {
        const key = NOT_FOUND[state.reason];
        return (
          <OutcomeCard
            title={t(`${key}.title`)}
            description={t(`${key}.description`)}
            action={again}
            testID="listening-not-found"
          />
        );
      }
      case 'microphone-denied':
        return (
          <OutcomeCard
            title={t('microphoneDenied.title')}
            description={t('microphoneDenied.description')}
            action={{ label: t('actions.openSettings'), onPress: onOpenSettings }}
            testID="listening-microphone-denied"
          />
        );
      case 'failed':
        return (
          <OutcomeCard
            title={t('failed.title')}
            description={t('failed.description')}
            action={again}
            testID="listening-failed"
          />
        );
      default:
        // Idle, starting, listening, and the instant before a closed screen goes away.
        return undefined;
    }
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
      return t(`${NOT_FOUND[state.reason]}.title`);
    case 'microphone-denied':
      return t('microphoneDenied.title');
    case 'failed':
      return t('failed.title');
    default:
      return null;
  }
}
