import { router } from 'expo-router';
import { Linking } from 'react-native';

import { deviceNotificationPermissions } from '@/data/notifications';
import { useSelfDisplayName } from '@/features/friends';
import { useProgression } from '@/features/gardens';
import { ProfileScreen, useProfileGarden, useProfileStats } from '@/features/profile';
import { useResumePage } from '@/features/reader';
import { deviceWritingDirection, useSettings } from '@/features/settings';
import { useAppStore } from '@/store';

/**
 * The profile tab: the person's level, garden in progress and badges (D46), the reading
 * statistics, and the row that opens the settings page. A blank profile opens the reader where the
 * person resumes, as the home screen does.
 */
export default function ProfileRoute() {
  const { model: stats, actions: statsActions } = useProfileStats();
  const garden = useProfileGarden();
  const progression = useProgression();
  const displayName = useSelfDisplayName();
  const showLevel = useAppStore((state) => state.settings.showLevel);
  const setShowLevel = useAppStore((state) => state.setShowLevel);
  const resumePage = useResumePage();
  // Only the notice about lost data is shown here; the settings have their own page.
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
      garden={garden}
      progression={progression}
      showLevel={showLevel}
      displayName={displayName}
      actions={{
        openSettings: () => router.push('/settings'),
        read: () => router.push(`/reader/${resumePage}`),
        openGardens: () => router.push('/my-gardens'),
        setShowLevel,
      }}
    />
  );
}
