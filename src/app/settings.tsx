import { router } from 'expo-router';
import { Linking } from 'react-native';

import { deviceNotificationPermissions } from '@/data/notifications';
import { deviceWritingDirection, SettingsScreen, useSettings } from '@/features/settings';

/** The settings page, opened from the last row of the profile. */
export default function SettingsRoute() {
  const { model, actions } = useSettings({
    notifications: deviceNotificationPermissions,
    direction: deviceWritingDirection,
    openSystemSettings: () => {
      void Linking.openSettings();
    },
    openIntroduction: () => router.push('/onboarding'),
  });
  return <SettingsScreen model={model} actions={actions} />;
}
