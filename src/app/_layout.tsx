import { useFonts } from 'expo-font';
import { getLocales } from 'expo-localization';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createDeviceProgressBackup, deviceStorage } from '@/data/storage';
import { LaunchOverlay, useLaunch } from '@/features/launch';
import { createSyncClock } from '@/data/sync';
import {
  ClosureSheet,
  DiagnosticBoundary,
  DiagnosticsProvider,
  startDiagnostics,
  useRouteBreadcrumbs,
} from '@/features/diagnostics';
import { useFeedbackSetup } from '@/features/feedback';
import { appSyncSession } from '@/features/friends';
import { CELEBRATION_PATH, useKhatmaCelebration } from '@/features/gardens';
import { useForegroundTimeRecording } from '@/features/profile';
import { useNotificationTaps, useReminderSync } from '@/features/reminders';
import {
  deviceWritingDirection,
  useAppStartup,
  type StartupDependencies,
} from '@/features/settings';
import {
  ScreenCheckAutoRun,
  ScreenCheckVoiceProof,
  screenCheckLaunch,
} from '@/features/screen-check';
import { SyncProvider, useAppSync, type AppSyncDependencies } from '@/features/sync';
import { AppStoreProvider } from '@/store';
import { appFonts, pushedPageOptions, useColorValues } from '@/ui';

// The app has been closing by itself on some phones with no log to read: before anything else
// loads, the diagnostics start (the record of a fatal error, the trail, the error screen's
// memory). See src/features/diagnostics.
const diagnostics = startDiagnostics();

// The error screen of expo-router for an error of this layout itself; the errors of the screens
// below are caught by the `DiagnosticBoundary` around the stack, which also knows the components.
export { ErrorBoundary } from '@/features/diagnostics';

// The native launch screen (a flat water colour) stays until the launch overlay has taken its
// place; the overlay then animates the mark and fades into the first screen (deviation 115).
void SplashScreen.preventAutoHideAsync();

const hideSplash = () => SplashScreen.hide();
const readReducedMotion = () => AccessibilityInfo.isReduceMotionEnabled();
/** The clock of the sync: the phone's, corrected by the server's once it has answered. */
const SYNC_CLOCK = createSyncClock();

const STARTUP: StartupDependencies = {
  storage: deviceStorage,
  now: SYNC_CLOCK.now,
  // The copy of the progress in the person's iCloud, where the app was built with it.
  backup: createDeviceProgressBackup(),
  direction: deviceWritingDirection,
  getDeviceLanguageCodes: () => getLocales().map((locale) => locale.languageCode),
};

/**
 * The sync with the person's account (docs/specs/sync.md). With the `friendsAnonymous` flag, the
 * anonymous account of the phone, made silently on the first sync (docs/AUTH-SETUP.md); without
 * it, null: the sign-in of the demonstration is not an account. With no account the progress is
 * saved on the phone (and in its iCloud or Google backup), and the settings say so.
 */
const SYNC: AppSyncDependencies = { clock: SYNC_CLOCK, session: appSyncSession() };

/** The celebration of a completed khatma, over whatever screen the person is on (D46). */
const openKhatmaCelebration = (khatm: number) =>
  router.push({ pathname: CELEBRATION_PATH, params: { khatm: String(khatm) } });

/**
 * Root of the app. It starts everything the first screen needs (the Quran fonts, the saved
 * settings, the language and the writing direction), counts the time spent in the app, keeps the
 * reminders scheduled, then hands over to the routes: `index`
 * sends a first launch to the introduction and everyone else to the tabs. The launch overlay
 * covers it from the first frame and fades out once the first screen is ready.
 */
export default function RootLayout() {
  // The interface uses the system fonts: a Quran font that fails to load must not block the app.
  const [areFontsLoaded, fontError] = useFonts(appFonts);
  const startedApp = useAppStartup(STARTUP);
  const sync = useAppSync(startedApp?.store ?? null, SYNC);
  // Sounds and haptics: the person's switches, the sounds loaded in advance, the silences.
  useFeedbackSetup(startedApp?.store ?? null);
  const isReady = startedApp !== null && (areFontsLoaded || fontError !== null);

  const launch = useLaunch({
    isReady,
    hideSplash,
    readReducedMotion,
    // The iOS check's pictures of each screen: no animation in front of them (null in any other build).
    isSkipped: screenCheckLaunch !== null,
  });

  return (
    <View style={styles.root}>
      {isReady ? (
        <AppStoreProvider store={startedApp.store}>
          <SyncProvider source={sync}>
            <DiagnosticsProvider diagnostics={diagnostics}>
              <RootStack />
              {/* The iOS check's automatic swipe and garden run (null in every build a person uses). */}
              {ScreenCheckAutoRun === null ? null : <ScreenCheckAutoRun />}
              {/* The iOS check's voice proof: recordings played to the real engine (same rule). */}
              {ScreenCheckVoiceProof === null ? null : <ScreenCheckVoiceProof />}
              {/* "L'app s'est fermée la dernière fois", once, when the app saw why. */}
              {launch.isShown ? null : <ClosureSheet />}
            </DiagnosticsProvider>
          </SyncProvider>
        </AppStoreProvider>
      ) : null}
      {launch.isShown ? (
        <LaunchOverlay phase={launch.phase} motion={launch.motion} onLayout={launch.onLayout} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

function RootStack() {
  // The time spent in the app and in the reader, for the statistics (D37).
  useForegroundTimeRecording();
  // The reminders of the settings, scheduled as local notifications, and where a tap on one leads
  // (D13, docs/specs/reminders.md).
  useReminderSync();
  useNotificationTaps();
  // Each screen opened goes in the trail kept for the diagnostics.
  useRouteBreadcrumbs();
  // A completed khatma is celebrated once, as soon as it is (D46). The iOS check opens its own.
  useKhatmaCelebration({
    open: openKhatmaCelebration,
    isEnabled: screenCheckLaunch === null,
  });
  const { t } = useTranslation('onboarding');
  const { t: tSettings } = useTranslation('settings');
  const colors = useColorValues();
  // The settings page of the profile opens over the tabs with the system bar (deviations 52 and
  // 101). Its colours are plain values of the appearance: a dynamic colour given to the bar was
  // resolved as light, so the dark appearance had a cream bar over a dark page.
  const pushedPage = pushedPageOptions(colors);
  return (
    <DiagnosticBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
        {/* Opened from the last row of the profile, with the system bar, its title and its back
            button, (deviation 52). */}
        <Stack.Screen name="settings" options={{ ...pushedPage, title: tSettings('title') }} />
        {/* "Mes jardins", opened from the profile: the system bar and back button, the large
            title in the page (path.png). */}
        <Stack.Screen name="my-gardens" options={{ ...pushedPage, title: '' }} />
        {/* The celebration of a completed khatma covers everything; its close button and its
            one action lead out (khatm.png). */}
        <Stack.Screen
          name="khatma-complete"
          options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
        />
        {/* The reader: the system navigation bar floats over the page (the reader hides and shows
            it), with the system's back button, a chevron alone (toolbars.md › Navigation). */}
        <Stack.Screen
          name="reader/[page]"
          options={{
            headerShown: true,
            headerTransparent: true,
            headerTintColor: colors.actionTint,
            headerBackButtonDisplayMode: 'minimal',
          }}
        />
        {/* Its header, with the system's back button, is only shown when the introduction is
            opened again from the settings (see onboarding/index.tsx). */}
        <Stack.Screen
          name="onboarding/index"
          options={{ title: t('replayTitle'), headerTintColor: colors.actionTint }}
        />
      </Stack>
    </DiagnosticBoundary>
  );
}
