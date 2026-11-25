import { useFonts } from 'expo-font';
import { getLocales } from 'expo-localization';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { createDeviceProgressBackup, deviceStorage } from '@/data/storage';
import { useForegroundTimeRecording } from '@/features/profile';
import {
  deviceWritingDirection,
  useAppStartup,
  type StartupDependencies,
} from '@/features/settings';
import { AppStoreProvider } from '@/store';
import { appFonts, useColors } from '@/ui';

// The launch screen stays until the first screen is ready to replace it (launching.md).
void SplashScreen.preventAutoHideAsync();

const STARTUP: StartupDependencies = {
  storage: deviceStorage,
  // The copy of the progress in the person's iCloud, where the app was built with it.
  backup: createDeviceProgressBackup(),
  direction: deviceWritingDirection,
  getDeviceLanguageCodes: () => getLocales().map((locale) => locale.languageCode),
};

/**
 * Root of the app. It starts everything the first screen needs (the Quran fonts, the saved
 * settings, the language and the writing direction), counts the time spent in the app, then
 * hands over to the routes: `index`
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
  // The time spent in the app and in the reader, for the statistics (D37).
  useForegroundTimeRecording();
  const { t } = useTranslation('onboarding');
  const { t: tSettings } = useTranslation('settings');
  const colors = useColors();
  // The settings page of the profile opens over the tabs, as the reader does, with the system bar,
  // its title and its back button, a chevron alone (toolbars.md › Navigation; deviation 52). The bar
  // takes the system's grouped background and label colours, which follow the dark appearance:
  // without them the navigation library paints its own light theme.
  const pushedPage = {
    headerShown: true,
    headerTintColor: colors.accent,
    headerBackButtonDisplayMode: 'minimal',
    headerStyle: { backgroundColor: colors.groupedBackground },
    headerTitleStyle: { color: colors.label },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.groupedBackground },
  } as const;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="+not-found" />
      {/* Opened from the last row of the profile, with the system bar, its title and its back
          button, (deviation 52). */}
      <Stack.Screen name="settings" options={{ ...pushedPage, title: tSettings('title') }} />
      {/* The reader: the system navigation bar floats over the page (the reader hides and shows
          it), with the system's back button, a chevron alone (toolbars.md › Navigation). */}
      <Stack.Screen
        name="reader/[page]"
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTintColor: colors.accent,
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      {/* Its header, with the system's back button, is only shown when the introduction is
          opened again from the settings (see onboarding/index.tsx). */}
      <Stack.Screen
        name="onboarding/index"
        options={{ title: t('replayTitle'), headerTintColor: colors.accent }}
      />
    </Stack>
  );
}
