import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  GardenElementsSection,
  GardenScene,
  GardenStateSection,
  GardenWaterRow,
} from '@/features/garden';
import {
  AppText,
  Button,
  ButtonRow,
  ContentUnavailable,
  GroupedList,
  ListSection,
  Screen,
  layout,
  spacing,
  type IconSymbol,
} from '@/ui';

import type { HomeActions, HomeModel, HomeReadyModel } from './home-model';
import { HomeNoticeRow } from './home-notice';
import { StatePreviewSection } from './state-preview';
import { TodaySection } from './today-section';

const UNAVAILABLE_SYMBOL: IconSymbol = { ios: 'leaf', android: 'eco' };

export interface HomeScreenProps {
  model: HomeModel;
  actions: HomeActions;
}

/**
 * The home screen, the "Jardin" tab: where is my garden, and what do I read now?
 *
 * It only shows the model it receives. The whole screen is one list of the system
 * (lists-and-tables.md › Style), so it scrolls as one and nothing is cut at the largest text
 * sizes (layout.md › Adaptability). Its order is the order of importance (layout.md › Visual
 * hierarchy): the title and the streak, the scene under it, edge to edge, the state of the day,
 * then what to read today with the one coloured button right under it (buttons.md › Style), then
 * the gauges and the elements. The scene is its one signature; everything around it is the
 * system's. On iOS the title and the scene sit above the system list, which cannot let a
 * picture reach the side edges, and stay in place while the rows scroll (deviation 30).
 *
 * Nothing here moves by itself, so there is nothing to switch off for Reduce Motion.
 */
export function HomeScreen({ model, actions }: HomeScreenProps) {
  return model.status === 'ready' ? (
    <ReadyHome model={model} actions={actions} />
  ) : (
    <UnavailableHome actions={actions} />
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
  const { garden, notice } = model;
  return (
    <Screen background="groupedBackground" testID="home">
      <GroupedList
        testID="home-list"
        header={
          // The garden is the signature of the screen, not a row of text: it runs from one side
          // edge to the other under the title, with no frame and no divider around it.
          <>
            <View style={styles.readyTitle}>
              <HomeTitle streakDays={model.streakDays} />
            </View>
            <GardenScene state={garden} size="band" />
          </>
        }
      >
        <ListSection>
          {
            // The state of the day is said once: the message when there is one, which names
            // the state and the water with it; otherwise the water alone.
            notice === null ? (
              <GardenWaterRow state={garden} />
            ) : (
              <HomeNoticeRow notice={notice} garden={garden} />
            )
          }
        </ListSection>
        <TodaySection model={model} />
        <ListSection>
          <ButtonRow label={t('actions.read')} onPress={actions.readAndWater} testID="home-read" />
        </ListSection>
        <GardenStateSection state={garden} />
        <GardenElementsSection state={garden} />
        {StatePreviewSection === null ? null : <StatePreviewSection />}
      </GroupedList>
    </Screen>
  );
}

/**
 * The garden could not be computed: the system's empty state says what happened and what to do,
 * without blame and without "we", and a button lets the person try again (writing.md › Best
 * practices: clear next steps, and a button to take them).
 */
function UnavailableHome({ actions }: { actions: HomeActions }) {
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
      <View style={styles.unavailableAction}>
        <Button
          label={t('unavailable.retry')}
          onPress={actions.retry}
          fullWidth
          testID="home-retry"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: spacing.md,
    rowGap: spacing.xs,
  },
  title: { flexShrink: 1 },
  // The margins of a row of the list, which the title lines up with.
  readyTitle: { paddingHorizontal: layout.screenMargin, paddingVertical: spacing.sm },
  unavailableTitle: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.sm,
  },
  unavailableAction: {
    paddingHorizontal: layout.screenMargin,
    paddingVertical: spacing.md,
  },
});
