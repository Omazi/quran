import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { quranStructure } from '@/data/quran';
import {
  createListeningEngine,
  ListeningScreen,
  loadQuranVerseIndex,
  loadQuranVerseText,
  useListeningNavigation,
} from '@/features/listening';

/**
 * The listening screen: the reader's microphone leads here. It listens with the phone's speech
 * engine (D42). In development and test builds, `/listening?scenario=several` plays a scenario of
 * the simulated engine instead; where the phone has no engine, a published build sends the
 * address home.
 */
export default function ListeningRoute() {
  const { scenario } = useLocalSearchParams<{ scenario?: string }>();
  const [engine] = useState(() => createListeningEngine(scenario));
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
