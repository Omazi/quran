import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  DataResetNoticeSection,
  SettingsSections,
  type SettingsActions,
  type SettingsModel,
} from '@/features/settings';
import { AppText, ContentRow, GroupedList, ListSection, Screen, spacing } from '@/ui';

import { StatsPreviewSection } from './state-preview';
import { StatsSections } from './stats-sections';
import type { ProfileStatsActions, ProfileStatsModel } from './use-profile-stats';

export interface ProfileScreenProps {
  stats: ProfileStatsModel;
  statsActions: ProfileStatsActions;
  settings: SettingsModel;
  settingsActions: SettingsActions;
}

/**
 * The "Profil" tab: the reading statistics first, the settings under them. One list of the
 * system, so the whole tab scrolls as one and nothing is cut at the largest text sizes
 * (layout.md › Adaptability). A notice about lost data, when there is one, comes before
 * everything: the tab's badge points to it (tab-bars.md › Best practices).
 */
export function ProfileScreen({
  stats,
  statsActions,
  settings,
  settingsActions,
}: ProfileScreenProps) {
  const { t } = useTranslation('profile');
  const { t: tSettings } = useTranslation('settings');
  return (
    <Screen background="groupedBackground" testID="profile">
      <GroupedList testID="profile-list">
        <ListSection isBare>
          <ContentRow>
            <View style={styles.title}>
              <AppText variant="largeTitle">{t('title')}</AppText>
            </View>
          </ContentRow>
        </ListSection>
        <DataResetNoticeSection model={settings} actions={settingsActions} />
        <StatsSections model={stats} actions={statsActions} />
        <SettingsSections model={settings} actions={settingsActions} title={tSettings('title')} />
        {StatsPreviewSection === null ? null : <StatsPreviewSection />}
      </GroupedList>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { paddingVertical: spacing.sm },
});
