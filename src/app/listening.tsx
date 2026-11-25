import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { quranStructure } from '@/data/quran';
import {
  createListeningEngine,
  ListeningScreen,
  loadQuranVerseIndex,
  loadQuranVerseText,
  useListeningNavigation,
  wasOpenedInApp,
} from '@/features/listening';

/**
 * The listening screen: the reader's microphone leads here. It listens with the phone's speech
 * engine (D42). In development and test builds, `/listening?scenario=several` plays a scenario of
 * the simulated engine instead; where the phone has no engine, a published build sends the
 * address home. Opened by a link instead of the app's button, it waits for the start button.
 */
export default function ListeningRoute() {
  const { scenario } = useLocalSearchParams<{ scenario?: string }>();
  const [engine] = useState(() => createListeningEngine(scenario));
  const navigation = useListeningNavigation();
  // A link (cold start or warm) must not open the microphone: only the app's own button does.
  const [autoStart] = useState(() => wasOpenedInApp('listening'));
  if (engine === null) return <Redirect href="/" />;
  return (
    <ListeningScreen
      engine={engine}
      autoStart={autoStart}
      loadVerseIndex={loadQuranVerseIndex}
      structure={quranStructure}
      loadVerseText={loadQuranVerseText}
      onClose={navigation.close}
      onOpenPage={navigation.openPage}
      onOpenSettings={navigation.openSettings}
    />
  );
}
