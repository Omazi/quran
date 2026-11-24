import { useFonts } from 'expo-font';
import { getLocales } from 'expo-localization';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { deviceStorage } from '@/data/storage';
import {
  deviceWritingDirection,
  useAppStartup,
  type StartupDependencies,
} from '@/features/settings';
import { AppStoreProvider } from '@/store';
import { appFonts } from '@/ui';

// The launch screen stays until the first screen is ready to replace it (launching.md).
void SplashScreen.preventAutoHideAsync();

const STARTUP: StartupDependencies = {
  storage: deviceStorage,
  direction: deviceWritingDirection,
  getDeviceLanguageCodes: () => getLocales().map((locale) => locale.languageCode),
};

/**
 * Root of the app. It starts everything the first screen needs (the Quran fonts, the saved
 * settings, the language and the writing direction), then hands over to the routes: `index`
 * sends a first launch to the introduction and everyone else to the tabs.
 */
export default function RootLayout() {
  // The interface uses the system fonts: a Quran font that fails to load must not block the app.
  const [areFontsLoaded, fontError] = useFonts(appFonts);
  const startedApp = useAppStartup(STARTUP);
  const isReady = startedApp !== null && (areFontsLoaded || fontError !== null);

  useEffect(() => {
    if (isReady) SplashScreen.hide();
  }, [isReady]);

  if (!isReady) return null;
  return (
    <AppStoreProvider store={startedApp.store}>
      <RootStack />
    </AppStoreProvider>
  );
}

function RootStack() {
  const { t } = useTranslation('onboarding');
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      {/* Its header, with the system's back button, is only shown when the introduction is
          opened again from the settings (see onboarding/index.tsx). */}
      <Stack.Screen name="onboarding/index" options={{ title: t('replayTitle') }} />
    </Stack>
  );
}
