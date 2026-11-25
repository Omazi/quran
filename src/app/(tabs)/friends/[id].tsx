import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback } from 'react';

import { FriendPage } from '@/features/friends';

/** A friend's page. The title, "Le jardin de …", goes to the native bar once known. */
export default function FriendRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const onTitle = useCallback((title: string) => navigation.setOptions({ title }), [navigation]);
  return <FriendPage userId={id} goBack={() => router.back()} onTitle={onTitle} />;
}
