import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { quranStructure } from '@/data/quran';
import {
  createTrialEngine,
  ListeningScreen,
  loadQuranVerseIndex,
  loadQuranVerseText,
  useListeningNavigation,
} from '@/features/listening';

/**
 * The listening screen, for trials only (docs/specs/listening.md, section 4): no button leads
 * here. `/listening?scenario=several` plays a scenario of the simulated engine; a published build
 * has no engine and sends the address home.
 */
export default function ListeningRoute() {
  const { scenario } = useLocalSearchParams<{ scenario?: string }>();
  const [engine] = useState(() => createTrialEngine(scenario));
  const navigation = useListeningNavigation();
  if (engine === null) return <Redirect href="/" />;
  return (
    <ListeningScreen
      engine={engine}
      loadVerseIndex={loadQuranVerseIndex}
      structure={quranStructure}
      loadVerseText={loadQuranVerseText}
      onClose={navigation.close}
      onOpenPage={navigation.openPage}
      onOpenSettings={navigation.openSettings}
    />
  );
}
