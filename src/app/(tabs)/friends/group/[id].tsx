import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback } from 'react';

import { GroupPage } from '@/features/friends';

/** A group's page. Its name goes to the native bar once known. */
export default function GroupRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const onTitle = useCallback((title: string) => navigation.setOptions({ title }), [navigation]);
  return (
    <GroupPage
      groupId={id}
      openPerson={(userId) => router.push({ pathname: '/friends/[id]', params: { id: userId } })}
      onTitle={onTitle}
    />
  );
}
