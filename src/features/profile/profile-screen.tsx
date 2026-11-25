import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import type { GardenPhase, GardenState } from '@/domain/garden';
import { DataResetNoticeCard, type SettingsActions, type SettingsModel } from '@/features/settings';
import {
  AppText,
  Card,
  GradientBackdrop,
  Icon,
  getWritingDirection,
  layout,
  spacing,
  useColors,
  useSafeInsets,
  type BackdropName,
} from '@/ui';

import { PROFILE_CARDS_RISE, PROFILE_PULL_ROOM_STEPS, PROFILE_SYMBOLS } from './config';
import { ProfileGarden } from './profile-garden';
import { StatsPreviewSection } from './state-preview';
import { StatsSections } from './stats-sections';
import type { ProfileStatsActions, ProfileStatsModel } from './use-profile-stats';

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

/** The gradient of the home screen that matches the state of the garden (soif.png, mort.png). */
const BACKDROP_OF_PHASE: Readonly<Record<GardenPhase, BackdropName>> = {
  bare: 'growing',
  thriving: 'growing',
  thirsty: 'thirsty',
  wilting: 'thirsty',
  dying: 'thirsty',
  dead: 'dead',
};

/**
 * The "Profil" tab, in the visual language of the home screen (docs/design/accueil.png; there is
 * no mockup of the profile): the title in the serif of the mockups and the person's garden on the
 * gradient of its state, then white cards that rise over the end of the gradient, in the order of
 * importance (layout.md › Visual hierarchy): the reading statistics, the gardens, and one card
 * that opens the settings (settings.md › General settings). A notice about lost data, when there
 * is one, comes first: the tab's badge points to it (tab-bars.md › Best practices). One scroll
 * view, so nothing is cut at the largest text sizes (layout.md › Adaptability).
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
  const colors = useColors();
  const insets = useSafeInsets();
  // iOS insets a scroll view for the status bar and the tab bar by itself; elsewhere the safe
  // area is added here (as on the home screen).
  const ownsInsets = Platform.OS !== 'ios';
  const backdrop = garden === null ? 'growing' : BACKDROP_OF_PHASE[garden.phase];
  return (
    <View style={[styles.screen, { backgroundColor: colors.canvas }]} testID="profile">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          ownsInsets ? { paddingTop: insets.top, paddingBottom: insets.bottom } : null,
        ]}
        testID="profile-list"
      >
        <View style={styles.stage}>
          <GradientBackdrop
            name={backdrop}
            extendUp={insets.top + spacing.xxl * PROFILE_PULL_ROOM_STEPS}
            style={styles.backdrop}
          />
          <View style={styles.header}>
            <AppText variant="largeTitle" color="heading">
              {t('title')}
            </AppText>
          </View>
          {garden === null ? null : <ProfileGarden garden={garden} />}
        </View>
        <View style={styles.cards}>
          <DataResetNoticeCard model={settings} actions={settingsActions} />
          <StatsSections model={stats} actions={statsActions} onRead={actions.read} />
          <SettingsCard onPress={actions.openSettings} />
          {StatsPreviewSection === null ? null : <StatsPreviewSection />}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Settings change rarely: one card at the end opens their page (settings.md › General settings),
 * with the forward chevron of a row that leads somewhere (lists-and-tables.md › Mobile). iOS
 * flips `chevron.forward` in Arabic by itself; elsewhere it is mirrored here
 * (right-to-left.md › Controls).
 */
function SettingsCard({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation('settings');
  const mirrorsChevron = Platform.OS !== 'ios' && getWritingDirection() === 'rtl';
  return (
    <Card tone="raised" onPress={onPress} accessibilityLabel={t('title')} testID="profile-settings">
      <View style={styles.settingsRow}>
        <Icon symbol={PROFILE_SYMBOLS.settings} textStyle="headline" color="actionTint" />
        <AppText style={styles.settingsLabel}>{t('title')}</AppText>
        <View style={mirrorsChevron ? styles.mirrored : null}>
          <Icon symbol={PROFILE_SYMBOLS.disclosure} textStyle="footnote" color="muted" />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: spacing.xl },
  stage: { paddingBottom: spacing.xxl },
  backdrop: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 },
  header: {
    paddingHorizontal: layout.screenMargin + spacing.xs,
    paddingTop: layout.controlGap,
  },
  cards: {
    marginTop: -spacing[PROFILE_CARDS_RISE],
    paddingHorizontal: layout.screenMargin,
    rowGap: spacing.lg,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: layout.controlGap,
  },
  settingsLabel: { flex: 1 },
  mirrored: { transform: [{ scaleX: -1 }] },
});
