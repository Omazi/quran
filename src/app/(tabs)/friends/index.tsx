import { router } from 'expo-router';

import { FriendsHome } from '@/features/friends';

/**
 * The root of the Proches tab. It only composes: navigation in, the feature page out. The pages
 * it opens are pushed on the tab's own stack (./_layout.tsx), under the tab bar.
 */
export default function FriendsRoute() {
  return (
    <FriendsHome
      openFriend={(userId) => router.push({ pathname: '/friends/[id]', params: { id: userId } })}
      openGroup={(groupId) =>
        router.push({ pathname: '/friends/group/[id]', params: { id: groupId } })
      }
      addFriend={() => router.push('/friends/add')}
      createGroup={() => router.push('/friends/new-group')}
      openScanner={() => router.push('/friends/scan')}
    />
  );
}
