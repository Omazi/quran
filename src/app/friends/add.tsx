import { router } from 'expo-router';

import { AddFriendPage } from '@/features/friends';

/** Adding a friend: once a code is accepted, the new friend's page replaces this one. */
export default function AddFriendRoute() {
  return (
    <AddFriendPage
      openFriend={(userId) => router.replace({ pathname: '/friends/[id]', params: { id: userId } })}
    />
  );
}
