import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { useGardenArt, useProgression } from '@/features/gardens';
import { AccountInvitation, HomeScreen, useHomeScreen, type HomeActions } from '@/features/home';
import { useOpenRecognition, usePreloadVoiceModel } from '@/features/listening';
import { useResumePage } from '@/features/reader';

/**
 * The "Jardin" tab. It only composes: the hook gathers what the screen shows, the screen shows
 * it, and this file says where each button leads. "Lire et arroser" opens the reader on the page
 * to resume (docs/specs/reader.md, section 4); opening it records nothing, only reading does.
 *
 * Opened with `?welcome=1` (from "Créer mon jardin" at the end of the introduction), the new garden
 * is followed by the invitation to create an account, where the `accountInvitation` flag allows it
 * (docs/specs/account-invitation.md).
 */
/** The e-mail way of the sign-in is in the Proches tab: the invitation hands over to it. */
function openFriendsSignIn() {
  router.push('/friends');
}

export default function HomeRoute() {
  const { model, today, neighbours, avatarInitial, arrival, retry, dismissArrival, share } =
    useHomeScreen();
  const resumePage = useResumePage();
  // The tab stays mounted under the reader: the garden's growth plays when it is in front again.
  const isFocused = useIsFocused();
  const progression = useProgression();
  // The garden of the person's level (D46): its own once downloaded, a placeholder until then.
  const gardenArt = useGardenArt(progression?.styleId ?? null);
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  const recognize = useOpenRecognition();
  usePreloadVoiceModel();
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
      recognize,
    }),
    [resumePage, retry, share, dismissArrival, recognize],
  );
  return (
    <>
      <HomeScreen
        model={model}
        actions={actions}
        today={today}
        neighbours={neighbours}
        avatarInitial={avatarInitial}
        arrival={arrival}
        isFocused={isFocused}
        gardenArt={gardenArt}
      />
      <AccountInvitation
        requested={welcome === '1'}
        gardenShown={model.status === 'ready' && isFocused}
        onOpenEmail={openFriendsSignIn}
      />
    </>
  );
}
