import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/ui';

/**
 * The navigation of the Proches tab: its pages are pushed inside the tab, so the tab bar stays on
 * screen while people move through them (tab-bars.md › Best practices: "Make sure the tab bar is
 * visible when people navigate to different sections of your app").
 *
 * The root of the tab writes its own large title, as the other tabs do; the pages it opens have
 * the system bar, their title and the system's back button, a chevron alone
 * (toolbars.md › Navigation). The bar takes the system's grouped background and label colours,
 * which follow the dark appearance: without them the navigation library paints its own light
 * theme (deviation 49).
 */
export default function FriendsLayout() {
  const { t } = useTranslation('friends');
  const colors = useColors();
  const page = {
    headerShown: true,
    headerTintColor: colors.accent,
    headerBackButtonDisplayMode: 'minimal',
    headerStyle: { backgroundColor: colors.groupedBackground },
    headerTitleStyle: { color: colors.label },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.groupedBackground },
  } as const;
  return (
    <Stack screenOptions={page}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: '' }} />
      <Stack.Screen name="add" options={{ title: t('add.title') }} />
      <Stack.Screen name="scan" options={{ title: t('scan.title') }} />
      <Stack.Screen name="new-group" options={{ title: t('newGroup.title') }} />
      <Stack.Screen name="group/[id]" options={{ title: '' }} />
    </Stack>
  );
}
