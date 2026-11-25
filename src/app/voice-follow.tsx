import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { quranStructure } from '@/data/quran';
import {
  createFollowEngine,
  loadQuranPage,
  parseFollowParams,
  useListeningNavigation,
  VoiceFollowScreen,
} from '@/features/listening';

/**
 * Reading aloud with the voice followed (docs/design/voix.png): no button leads here yet.
 * `/voice-follow?page=294&from=18:10` follows the recitation with the phone's speech engine
 * (D42); in development and test builds, `&scenario=follow` plays the simulated recitation of
 * 18:10 instead. Where the phone has no engine, a published build sends the address home.
 */
export default function VoiceFollowRoute() {
  const { page, from, scenario } = useLocalSearchParams<{
    page?: string;
    from?: string;
    scenario?: string;
  }>();
  const [engine] = useState(() => createFollowEngine(scenario));
  const navigation = useListeningNavigation();
  const params = parseFollowParams(page, from);
  if (engine === null || params === null) return <Redirect href="/" />;
  return (
    <VoiceFollowScreen
      engine={engine}
      page={params.page}
      from={params.from}
      structure={quranStructure}
      loadPage={loadQuranPage}
      onClose={navigation.close}
    />
  );
}
