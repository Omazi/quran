import { useRouter } from 'expo-router';
import { Linking } from 'react-native';

import { deviceNotificationPermissions } from '@/data/notifications';
import { ProfileScreen, useProfileStats } from '@/features/profile';
import { deviceWritingDirection, useSettings } from '@/features/settings';

/** The profile tab: the reading statistics, then the settings. */
export default function ProfileRoute() {
  const router = useRouter();
  const { model: stats, actions: statsActions } = useProfileStats();
  const { model: settings, actions: settingsActions } = useSettings({
    notifications: deviceNotificationPermissions,
    direction: deviceWritingDirection,
    openSystemSettings: () => {
      void Linking.openSettings();
    },
    openIntroduction: () => router.push('/onboarding'),
  });
  return (
    <ProfileScreen
      stats={stats}
      statsActions={statsActions}
      settings={settings}
      settingsActions={settingsActions}
    />
  );
}
