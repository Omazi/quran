import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { GardenState } from '@/domain/garden';
import {
  DataResetNoticeSection,
  type SettingsActions,
  type SettingsModel,
} from '@/features/settings';
import {
  AppText,
  ContentRow,
  GroupedList,
  ListRow,
  ListSection,
  Screen,
  spacing,
  type IconSymbol,
} from '@/ui';

import { ProfileGardenSection } from './profile-garden';
import { StatsPreviewSection } from './state-preview';
import { StatsSections } from './stats-sections';
import type { ProfileStatsActions, ProfileStatsModel } from './use-profile-stats';

const SETTINGS_SYMBOL: IconSymbol = { ios: 'gearshape', android: 'settings' };

/** What the profile opens: its own actions, the route decides where they lead. */
export interface ProfileActions {
  /** Opens the settings page. */
  readonly openSettings: () => void;
  /** Opens the reader where the person resumes, as "Lire et arroser" does on the home screen. */
  readonly read: () => void;
}

export interface ProfileScreenProps {
  stats: ProfileStatsModel;
  statsActions: ProfileStatsActions;
  /** For the notice about lost data only: the settings themselves are on their own page. */
  settings: SettingsModel;
  settingsActions: SettingsActions;
  /** The person's garden, or null when it cannot be computed. */
  garden: GardenState | null;
  actions: ProfileActions;
}

/**
 * The "Profil" tab: the person's garden, then their reading statistics, then one row that opens
 * the settings (owner's decision, 25 November 2026). One list of the system, so the whole tab
 * scrolls as one and nothing is cut at the largest text sizes (layout.md › Adaptability). A
 * notice about lost data, when there is one, comes before everything: the tab's badge points to
 * it (tab-bars.md › Best practices).
 */
export function ProfileScreen({
  stats,
  statsActions,
  settings,
  settingsActions,
  garden,
  actions,
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
        {garden === null ? null : <ProfileGardenSection garden={garden} />}
        <StatsSections
          model={stats}
          actions={statsActions}
          onRead={actions.read}
          hasGardenAbove={garden !== null}
        />
        {/* Settings change rarely: one row at the end, which opens their page (settings.md ›
            General settings), with the disclosure indicator (lists-and-tables.md › Mobile). */}
        <ListSection>
          <ListRow
            label={tSettings('title')}
            symbol={SETTINGS_SYMBOL}
            onPress={actions.openSettings}
            testID="profile-settings"
          />
        </ListSection>
        {StatsPreviewSection === null ? null : <StatsPreviewSection />}
      </GroupedList>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { paddingVertical: spacing.sm },
});
