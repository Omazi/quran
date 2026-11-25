import { router, useLocalSearchParams } from 'expo-router';

import { AddFriendPage } from '@/features/friends';

/**
 * Adding a friend: once a code is accepted, the new friend's page replaces this one. The scanner
 * opens on top of it, once the person has answered the system's camera question. A link of
 * invitation (src/app/invite) arrives with its code, which fills the code field.
 */
export default function AddFriendRoute() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return (
    <AddFriendPage
      linkedCode={code}
      openFriend={(userId) => router.replace({ pathname: '/friends/[id]', params: { id: userId } })}
      openScanner={() => router.push('/friends/scan')}
    />
  );
}
