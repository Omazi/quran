import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { deviceNotificationPermissions } from '@/data/notifications';
import { noteGestureStart } from '@/features/diagnostics';
import {
  ONBOARDING_PAGES,
  OnboardingScreen,
  useFatihaPage,
  useOnboarding,
} from '@/features/onboarding';
import { screenCheckPage, screenCheckPagerDriver } from '@/features/screen-check';

/**
 * The introduction. At the first launch it has no way out but its last page, and "Créer mon
 * jardin" opens the garden with `?welcome=1` (the home then offers an account); opened again from
 * the settings, it sits on the tabs and shows the system's back button.
 */
export default function OnboardingRoute() {
  const router = useRouter();
  // `?page=N` opens a page of the flow, in the iOS check's build only (src/features/screen-check).
  const { page } = useLocalSearchParams<{ page?: string }>();
  const checkedPage = screenCheckPage(page, ONBOARDING_PAGES.length);
  const fatiha = useFatihaPage();
  const { model, actions } = useOnboarding({
    notifications: deviceNotificationPermissions,
    initialPageIndex: checkedPage === null ? 0 : checkedPage - 1,
    onFinished: ({ isReplay }) => {
      if (!isReplay) router.replace({ pathname: '/(tabs)', params: { welcome: '1' } });
      // Opened by a link, the introduction has no screen behind it to go back to.
      else if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
    },
  });
  return (
    <>
      {/* The pages are swiped up and down; the back swipe is left to the back button. Opened
          again, the system's bar floats over the sky of the introduction. */}
      <Stack.Screen
        options={{
          headerShown: model.isReplay,
          headerTransparent: model.isReplay,
          gestureEnabled: false,
        }}
      />
      <OnboardingScreen
        model={model}
        actions={actions}
        fatiha={fatiha}
        // The iOS check's automatic swipe (null in every build a person uses).
        renderDriver={screenCheckPagerDriver ?? undefined}
        onTouchStart={() => noteGestureStart('onboarding-pager')}
      />
    </>
  );
}
