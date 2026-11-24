import { Stack, useRouter } from 'expo-router';

import { deviceNotificationPermissions } from '@/data/notifications';
import { GardenScene, previewGardenState } from '@/features/garden';
import {
  OnboardingScreen,
  gardenOfScene,
  renderPlaceholderScene,
  useOnboarding,
  type SceneRenderer,
} from '@/features/onboarding';

/**
 * The scenes of the introduction: the garden of each page, drawn by the garden's own scene from
 * the state its rules give. The pages that show something else keep a named placeholder.
 */
const renderScene: SceneRenderer = (scene) => {
  const garden = gardenOfScene(scene);
  if (garden === null) return renderPlaceholderScene(scene);
  return <GardenScene state={previewGardenState(garden)} size="fill" />;
};

/**
 * The introduction. At the first launch it has no way out but its last page; opened again from
 * the settings, it sits on the tabs and shows the system's back button.
 */
export default function OnboardingRoute() {
  const router = useRouter();
  const { model, actions } = useOnboarding({
    notifications: deviceNotificationPermissions,
    onFinished: ({ isReplay }) => {
      if (isReplay) router.back();
      else router.replace('/(tabs)');
    },
  });
  return (
    <>
      {/* The pages are swiped sideways, so the back swipe is left to the back button. */}
      <Stack.Screen options={{ headerShown: model.isReplay, gestureEnabled: false }} />
      <OnboardingScreen model={model} actions={actions} renderScene={renderScene} />
    </>
  );
}
