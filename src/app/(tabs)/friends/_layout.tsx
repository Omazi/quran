import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useVisitColors } from '@/ui';

/**
 * The navigation of the Proches tab: its pages are pushed inside the tab, so the tab bar stays on
 * screen while people move through them (tab-bars.md › Best practices: "Make sure the tab bar is
 * visible when people navigate to different sections of your app").
 *
 * The root of the tab writes its own large title, as the other tabs do; the pages it opens have
 * the system bar, their title and the system's back button, a chevron alone
 * (toolbars.md › Navigation). The bar takes the top colour of the mockups' sky
 * (docs/design/visite.png), so the page's sky starts under it without a seam, and the ink of
 * their title; both follow the dark appearance (deviation 49).
 */
export default function FriendsLayout() {
  const { t } = useTranslation('friends');
  const colors = useVisitColors();
  const page = {
    headerShown: true,
    headerTintColor: colors.ink,
    headerBackButtonDisplayMode: 'minimal',
    headerStyle: { backgroundColor: colors.skyTop },
    headerTitleStyle: { color: colors.ink },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.page },
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
