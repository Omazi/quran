import { Redirect } from 'expo-router';

import { useAppStore } from '@/store';

/**
 * Where the app opens: the introduction at the first launch, the tabs afterwards. The tabs open
 * on their first one, the garden.
 */
export default function StartRoute() {
  const hasFinishedIntroduction = useAppStore((state) => state.settings.onboardingCompleted);
  return <Redirect href={hasFinishedIntroduction ? '/(tabs)' : '/onboarding'} />;
}
