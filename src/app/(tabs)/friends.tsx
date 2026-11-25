import { router } from 'expo-router';

import { FriendsHome } from '@/features/friends';

/**
 * The Proches tab. It only composes: navigation in, the feature page out. The pages it opens are
 * routes of the root stack (src/app/friends), over the tabs, as the reader is.
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
    />
  );
}
