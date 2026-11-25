import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { quranStructure } from '@/data/quran';
import {
  createFollowTrialEngine,
  loadQuranPage,
  parseFollowParams,
  useListeningNavigation,
  VoiceFollowScreen,
} from '@/features/listening';

/**
 * Reading aloud with the voice followed (docs/design/voix.png), for trials only, like
 * `/listening`: no button leads here. `/voice-follow?page=294&from=18:10` follows the simulated
 * recitation of 18:10; a published build has no engine and sends the address home.
 */
export default function VoiceFollowRoute() {
  const { page, from } = useLocalSearchParams<{ page?: string; from?: string }>();
  const [engine] = useState(createFollowTrialEngine);
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
