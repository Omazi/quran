import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useTranslation } from 'react-i18next';

import { DiagnosticBoundary } from '@/features/diagnostics';
import { useAppStore } from '@/store';
import { getWritingDirection, useColors } from '@/ui';

// The error screen of expo-router for an error of this layout itself (src/features/diagnostics).
export { ErrorBoundary } from '@/features/diagnostics';

/**
 * The sections of the app in the system tab bar: one word and one filled symbol each,
 * always visible (tab-bars.md › Best practices). The selected tab takes the forest green of the
 * validated mockups, the app's action colour (owner's decision, 25 November 2026).
 */
export default function TabsLayout() {
  const { t } = useTranslation('common');
  const colors = useColors();
  const hasFinishedIntroduction = useAppStore((state) => state.settings.onboardingCompleted);
  // Stored data that could not be read back is explained in the profile: the badge leads there
  // (tab-bars.md › Best practices: a badge for critical information).
  const hasNoticeInProfile = useAppStore((state) => state.dataResetNotice !== null);

  // A link that opens the app on a tab must not skip the introduction.
  if (!hasFinishedIntroduction) return <Redirect href="/onboarding" />;
  return (
    <DiagnosticBoundary>
      <NativeTabs
        tintColor={colors.actionTint}
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
        {/* Friends, between the Quran and the last tab, as in the validated home screen
            (docs/design/accueil.png). */}
        <NativeTabs.Trigger name="friends">
          <NativeTabs.Trigger.Icon sf="person.2.fill" md="group" />
          <NativeTabs.Trigger.Label>{t('tabs.friends')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        {/* The profile: the reading statistics, then the settings. */}
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" md="account_circle" />
          <NativeTabs.Trigger.Label>{t('tabs.profile')}</NativeTabs.Trigger.Label>
          {/* Left out rather than `hidden`: a badge that has a text is shown whatever `hidden` says
              (expo-router, NativeTabTrigger › appendBadgeOptions). */}
          {hasNoticeInProfile ? (
            <NativeTabs.Trigger.Badge>{t('tabs.attentionBadge')}</NativeTabs.Trigger.Badge>
          ) : null}
        </NativeTabs.Trigger>
      </NativeTabs>
    </DiagnosticBoundary>
  );
}
