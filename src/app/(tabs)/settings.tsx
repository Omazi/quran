import { useRouter } from 'expo-router';
import { Linking } from 'react-native';

import { deviceNotificationPermissions } from '@/data/notifications';
import { SettingsScreen, deviceWritingDirection, useSettings } from '@/features/settings';

/** The settings tab. */
export default function SettingsRoute() {
  const router = useRouter();
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
