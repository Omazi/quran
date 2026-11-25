import { router, Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback } from 'react';
import { Platform } from 'react-native';

import { FriendPage, type FriendOptionsMenu } from '@/features/friends';
import { useResumePage } from '@/features/reader';

/**
 * The system's More menu in the navigation bar: an ellipsis that opens a menu, its items in red
 * (pull-down-buttons.md › Mobile). Only iOS and Android have it; the web keeps the buttons at the
 * end of the page.
 */
function renderOptions(menu: FriendOptionsMenu) {
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel={menu.label}>
        {menu.items.map((item) => (
          <Stack.Toolbar.MenuAction
            key={item.label}
            destructive={item.isDestructive}
            onPress={item.onPress}
          >
            {item.label}
          </Stack.Toolbar.MenuAction>
        ))}
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}

/**
 * A friend's page. The title, "Le jardin de …", goes to the native bar once known; "Lire et
 * arroser" opens the reader where the person resumes, as on the home screen.
 */
export default function FriendRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const resumePage = useResumePage();
  const onTitle = useCallback((title: string) => navigation.setOptions({ title }), [navigation]);
  return (
    <FriendPage
      userId={id}
      goBack={() => router.back()}
      onTitle={onTitle}
      openReader={() => router.push(`/reader/${resumePage}`)}
      renderOptions={Platform.OS === 'web' ? undefined : renderOptions}
    />
  );
}
