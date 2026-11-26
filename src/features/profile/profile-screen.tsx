import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import type { GardenPhase, GardenState } from '@/domain/garden';
import type { Progression } from '@/domain/levels';
import {
  BadgeShelf,
  CurrentGardenCard,
  LevelChip,
  ownShelf,
  ShowLevelCard,
} from '@/features/gardens';
import { DataResetNoticeCard, type SettingsActions, type SettingsModel } from '@/features/settings';
import {
  ActionButton,
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
import { StatsPreviewSection } from './state-preview';
import { StatsSections } from './stats-sections';
import type { ProfileStatsActions, ProfileStatsModel } from './use-profile-stats';

/** What the profile opens: its own actions, the route decides where they lead. */
export interface ProfileActions {
  /** Opens the settings page. */
  readonly openSettings: () => void;
  /** Opens the reader where the person resumes, as "Lire et arroser" does on the home screen. */
  readonly read: () => void;
  /** Opens "Mes jardins", the path of the levels (D46). */
  readonly openGardens: () => void;
  /** Shows or hides the level and badges to friends ("Montrer mon niveau", D46). */
  readonly setShowLevel: (showLevel: boolean) => void;
}

export interface ProfileScreenProps {
  stats: ProfileStatsModel;
  statsActions: ProfileStatsActions;
  /** For the notice about lost data only: the settings themselves are on their own page. */
  settings: SettingsModel;
  settingsActions: SettingsActions;
  /** The person's garden, or null when it cannot be computed. */
  garden: GardenState | null;
  /** Level, badges and garden in progress (D46), or null when they cannot be computed. */
  progression: Progression | null;
  /** Whether friends see the level and badges. */
  showLevel: boolean;
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
 * The "Profil" tab (docs/design/maquettes-2026-11-26/profile-*.png): the title in the serif of the
 * mockups and the level under it ("Niveau 2 · Oasis") on the gradient of the garden's state, then
 * white cards that rise over the end of the gradient, in the order of the mockup (layout.md ›
 * Visual hierarchy): the garden in progress (it opens "Mes jardins"), the badges, "Montrer mon
 * niveau", the reading statistics, and one card that opens the settings (settings.md › General
 * settings). A notice about lost data, when there is one, comes first: the tab's badge points to
 * it (tab-bars.md › Best practices). One scroll view, so nothing is cut at the largest text sizes
 * (layout.md › Adaptability).
 */
export function ProfileScreen({
  stats,
  statsActions,
  settings,
  settingsActions,
  garden,
  progression,
  showLevel,
  actions,
}: ProfileScreenProps) {
  const { t } = useTranslation('profile');
  const { t: tGardens } = useTranslation('gardens');
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
            {progression === null ? null : (
              <LevelChip
                level={progression.level}
                styleId={progression.styleId}
                testID="profile-level"
              />
            )}
          </View>
        </View>
        <View style={styles.cards}>
          <DataResetNoticeCard model={settings} actions={settingsActions} />
          {progression === null ? null : (
            <>
              <CurrentGardenCard
                progression={progression}
                garden={garden}
                onPress={actions.openGardens}
                testID="profile-garden"
              />
              <View style={styles.sectionHeader}>
                <AppText variant="title2" color="heading" style={styles.sectionTitle}>
                  {tGardens('badges.title')}
                </AppText>
                <ActionButton
                  variant="plain"
                  label={tGardens('badges.seeAll')}
                  onPress={actions.openGardens}
                  fullWidth={false}
                  testID="profile-open-gardens"
                />
              </View>
              <BadgeShelf items={ownShelf(progression)} testID="profile-badges" />
              <ShowLevelCard
                value={showLevel}
                onChange={actions.setShowLevel}
                testID="profile-show-level"
              />
            </>
          )}
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
    paddingBottom: spacing.xl,
    rowGap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: -spacing.sm,
  },
  sectionTitle: { flex: 1 },
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
