import { Redirect } from 'expo-router';

import { ScreenCheckLauncher, screenCheckLaunch } from '@/features/screen-check';
import { useAppStore } from '@/store';

/**
 * Where the app opens: the introduction at the first launch, the tabs afterwards. The tabs open
 * on their first one, the garden. The iOS check's build (and no other) can ask for another screen
 * through a launch argument (`src/features/screen-check`).
 */
export default function StartRoute() {
  const hasFinishedIntroduction = useAppStore((state) => state.settings.onboardingCompleted);
  if (ScreenCheckLauncher !== null && screenCheckLaunch !== null) {
    return <ScreenCheckLauncher launch={screenCheckLaunch} />;
  }
  return <Redirect href={hasFinishedIntroduction ? '/(tabs)' : '/onboarding'} />;
}
