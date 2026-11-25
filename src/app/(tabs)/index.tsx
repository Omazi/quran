import { router } from 'expo-router';
import { useMemo } from 'react';

import { HomeScreen, useHomeScreen, type HomeActions } from '@/features/home';
import { useResumePage } from '@/features/reader';

/**
 * The "Jardin" tab. It only composes: the hook gathers what the screen shows, the screen shows
 * it, and this file says where each button leads. "Lire et arroser" opens the reader on the page
 * to resume (docs/specs/reader.md, section 4); opening it records nothing, only reading does.
 */
export default function HomeRoute() {
  const { model, today, neighbours, avatarInitial, arrival, retry, dismissArrival, share } =
    useHomeScreen();
  const resumePage = useResumePage();
  const actions = useMemo<HomeActions>(
    () => ({
      readAndWater: () => router.push(`/reader/${resumePage}`),
      retry,
      openProfile: () => router.push('/profile'),
      openFriends: () => router.push('/friends'),
      openFriend: (userId) => router.push(`/friends/${userId}`),
      startNewKhatma: (page) => router.push(`/reader/${page}`),
      share,
      dismissArrival,
    }),
    [resumePage, retry, share, dismissArrival],
  );
  return (
    <HomeScreen
      model={model}
      actions={actions}
      today={today}
      neighbours={neighbours}
      avatarInitial={avatarInitial}
      arrival={arrival}
    />
  );
}
