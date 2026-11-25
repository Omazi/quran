import { router } from 'expo-router';

import { NewGroupPage } from '@/features/friends';

/** A new group: once created, its page replaces this one. */
export default function NewGroupRoute() {
  return (
    <NewGroupPage
      openGroup={(groupId) =>
        router.replace({ pathname: '/friends/group/[id]', params: { id: groupId } })
      }
    />
  );
}
