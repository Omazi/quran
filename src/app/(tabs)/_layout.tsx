import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '@/store';
import { getWritingDirection, useColors } from '@/ui';

/**
 * The three sections of the app in the system tab bar: one word and one filled symbol each,
 * always visible (tab-bars.md › Best practices). The selected tab takes the accent, the colour
 * of water, which differs from the green of the garden behind the bar
 * (color.md › Liquid Glass color).
 */
export default function TabsLayout() {
  const { t } = useTranslation('common');
  const colors = useColors();
  const hasFinishedIntroduction = useAppStore((state) => state.settings.onboardingCompleted);

  // A link that opens the app on a tab must not skip the introduction.
  if (!hasFinishedIntroduction) return <Redirect href="/onboarding" />;
  return (
    <NativeTabs
      tintColor={colors.accent}
      // The native tab bar follows the direction of the system, not the one React Native was
      // started with: it has to be told (react-native-screens, `TabsHost` › `direction`).
      unstable_nativeProps={{ direction: getWritingDirection() }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="leaf.fill" md="eco" />
        <NativeTabs.Trigger.Label>{t('tabs.garden')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="quran">
        <NativeTabs.Trigger.Icon sf="book.fill" md="menu_book" />
        <NativeTabs.Trigger.Label>{t('tabs.quran')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
        <NativeTabs.Trigger.Label>{t('tabs.settings')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
