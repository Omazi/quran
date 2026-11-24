import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  GardenElementsSection,
  GardenScene,
  GardenStateSection,
  GardenWaterStatus,
} from '@/features/garden';
import {
  AppText,
  Button,
  ContentUnavailable,
  GroupedList,
  Screen,
  layout,
  spacing,
  type IconSymbol,
} from '@/ui';

import type { HomeActions, HomeModel, HomeReadyModel } from './home-model';
import { HomeNoticeBanner } from './home-notice';
import { TodaySection } from './today-section';

/** The smallest height left to the list: about three rows at the default text size. */
const LIST_MIN_HEIGHT = layout.touchTarget * 3;

const UNAVAILABLE_SYMBOL: IconSymbol = { ios: 'leaf', android: 'eco' };

export interface HomeScreenProps {
  model: HomeModel;
  actions: HomeActions;
}

/**
 * The home screen, the "Jardin" tab: where is my garden, and what do I read now?
 *
 * It only shows the model it receives. The scene is its one signature; everything around it is
 * the system's (SwiftUI Design, step 4). Reading order follows importance (layout.md › Visual
 * hierarchy): the title and the streak, the scene, the water and the message of the day, then
 * the gauges, today's reading and the elements, and the one coloured button, kept within reach
 * at the bottom (buttons.md › Style: one prominent button for the most likely action).
 *
 * Nothing here moves by itself, so there is nothing to switch off for Reduce Motion.
 */
export function HomeScreen({ model, actions }: HomeScreenProps) {
  return model.status === 'ready' ? (
    <ReadyHome model={model} actions={actions} />
  ) : (
    <UnavailableHome />
  );
}

/** The large title and, when there is one, the streak. They stack when they do not fit. */
function HomeTitle({ streakDays }: { streakDays: number }) {
  const { t } = useTranslation('home');
  return (
    <View style={styles.titleRow}>
      <AppText variant="largeTitle" style={styles.title}>
        {t('title')}
      </AppText>
      {
        // No streak is not shown as a zero: the screen never points at a day without reading.
        streakDays > 0 ? (
          <AppText testID="home-streak">{t('streak', { count: streakDays })}</AppText>
        ) : null
      }
    </View>
  );
}

function ReadyHome({ model, actions }: { model: HomeReadyModel; actions: HomeActions }) {
  const { t } = useTranslation('home');
  return (
    <Screen background="groupedBackground" testID="home">
      {/*
        The list scrolls by itself, so it cannot sit in a screen that scrolls too. What is above
        it takes its own height and, at the largest text sizes, gives way and scrolls, while the
        list keeps a minimum height: no word is cut and nothing is out of reach
        (layout.md › Adaptability; typography.md › Supporting Dynamic Type).
      */}
      <ScrollView
        alwaysBounceVertical={false}
        style={styles.top}
        contentContainerStyle={styles.topContent}
        testID="home-top"
      >
        <HomeTitle streakDays={model.streakDays} />
        <GardenScene state={model.garden} size="band" />
        <GardenWaterStatus state={model.garden} />
        {model.notice === null ? null : <HomeNoticeBanner notice={model.notice} />}
      </ScrollView>
      <View style={styles.list}>
        <GroupedList testID="home-list">
          <GardenStateSection state={model.garden} />
          <TodaySection model={model} />
          <GardenElementsSection state={model.garden} />
        </GroupedList>
      </View>
      <View style={styles.action}>
        <Button
          label={t('actions.read')}
          onPress={actions.readAndWater}
          fullWidth
          testID="home-read"
        />
      </View>
    </Screen>
  );
}

/**
 * The garden could not be computed: the system's empty state says what happened and what to do,
 * without blame and without "we" (writing.md › Best practices).
 */
function UnavailableHome() {
  const { t } = useTranslation('home');
  return (
    <Screen testID="home">
      <View style={styles.unavailableTitle}>
        <HomeTitle streakDays={0} />
      </View>
      <ContentUnavailable
        title={t('unavailable.title')}
        description={t('unavailable.description')}
        symbol={UNAVAILABLE_SYMBOL}
        testID="home-unavailable"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Takes the height of its content, and gives way to the list when the two do not fit.
  top: { flexGrow: 0, flexShrink: 1 },
  topContent: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: spacing.md,
    rowGap: spacing.xs,
  },
  title: { flexShrink: 1 },
  list: { flex: 1, minHeight: LIST_MIN_HEIGHT },
  action: {
    paddingHorizontal: layout.screenMargin,
    paddingVertical: spacing.sm,
  },
  unavailableTitle: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.sm,
  },
});
