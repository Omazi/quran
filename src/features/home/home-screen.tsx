import type { GardenStyleId } from '@/domain/levels';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import type { LocalDate } from '@/domain/shared/local-date';
import {
  Button,
  ContentUnavailable,
  GradientBackdrop,
  layout,
  spacing,
  useColors,
  useSafeInsets,
  type BackdropName,
  type IconSymbol,
} from '@/ui';

import { AddedCard } from './added-card';
import type { Arrival } from './arrival';
import { ArrivalSheet } from './arrival-sheet';
import { DailyCard } from './daily-card';
import { DeadGarden } from './dead-garden';
import { GardenProgress, type GardenGrowing } from './garden-progress';
import { GardenStage } from './garden-stage';
import { HomeHeader } from './home-header';
import type { HomeActions, HomeLayout, HomeModel, HomeReadyModel } from './home-model';
import { KhatmaComplete } from './khatma-complete';
import { NeighbourGardensSection } from './neighbour-gardens';
import type { NeighbourGardens } from './neighbours';
import { RecoveringBanner, ThirstBanner } from './notice-banner';
import { StatePreviewSection } from './state-preview';

const UNAVAILABLE_SYMBOL: IconSymbol = { ios: 'leaf', android: 'eco' };

/** The gradient behind each layout of the mockups. */
const BACKDROPS: Readonly<Record<HomeLayout, BackdropName>> = {
  growing: 'growing',
  thirsty: 'thirsty',
  dead: 'dead',
  complete: 'complete',
};

/**
 * Room above the content for the gradient: the status bar, and the bounce of the scroll view
 * when it is pulled down, so that the top of the screen never shows the canvas.
 */
const PULL_ROOM = spacing.xxl * 4;

export interface HomeScreenProps {
  model: HomeModel;
  actions: HomeActions;
  today: LocalDate;
  neighbours: NeighbourGardens;
  avatarInitial: string | null;
  arrival: Arrival | null;
  /** The screen is in front (not under the reader): the garden's growth plays when it is. */
  isFocused?: boolean;
  /** The garden style of the person's level (D46), from `useProgression`. */
  styleId?: GardenStyleId | null;
}

/**
 * The home screen, the "Jardin" tab, as the validated mockups draw it (docs/design/accueil.png,
 * soif.png, mort.png, khatm.png, nouveau.png): where is my garden, and what do I read now?
 *
 * It only shows what it receives. One scroll view; at the top the garden on its gradient, the
 * signature of the screen, under the title; then the cards, in the order of importance
 * (layout.md › Visual hierarchy), with the one main button in the card of the day
 * (buttons.md › Style). A thirsty garden puts its banner first; a dead garden keeps only what
 * brings it back; a completed khatma has its own page.
 */
export function HomeScreen(props: HomeScreenProps) {
  const { model, actions } = props;
  if (model.status !== 'ready') return <UnavailableHome {...props} />;
  return (
    <HomeFrame layout={model.layout}>
      {model.layout === 'complete' && model.completedKhatma !== null ? (
        <KhatmaComplete
          garden={model.garden}
          khatma={model.completedKhatma}
          onShare={actions.share}
          onStartNext={() =>
            actions.startNewKhatma(model.completedKhatma?.nextKhatmaFirstPage ?? 1)
          }
        />
      ) : (
        <GardenHome {...props} model={model} />
      )}
      {model.layout === 'growing' && props.arrival !== null ? (
        <ArrivalSheet
          arrival={props.arrival}
          onDismiss={actions.dismissArrival}
          onShare={actions.share}
        />
      ) : null}
    </HomeFrame>
  );
}

/** The canvas, the scroll view and, behind the top of it, the gradient of the layout. */
function HomeFrame({ layout: homeLayout, children }: { layout: HomeLayout; children: ReactNode }) {
  const colors = useColors();
  const insets = useSafeInsets();
  // iOS insets a scroll view for the status bar and the tab bar by itself; elsewhere the safe
  // area is added here.
  const ownsInsets = Platform.OS !== 'ios';
  return (
    <View style={[styles.screen, { backgroundColor: colors.canvas }]} testID="home">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          ownsInsets ? { paddingTop: insets.top, paddingBottom: insets.bottom } : null,
        ]}
        testID="home-list"
      >
        {
          // The dry earth and the completed khatma lie on their gradient from top to bottom; the
          // other layouts draw it behind the garden only (`GardenHome`).
          homeLayout === 'dead' || homeLayout === 'complete' ? (
            <GradientBackdrop
              name={BACKDROPS[homeLayout]}
              extendUp={insets.top + PULL_ROOM}
              style={styles.backdrop}
            />
          ) : null
        }
        {children}
        {StatePreviewSection === null ? null : <StatePreviewSection />}
      </ScrollView>
    </View>
  );
}

function GardenHome({
  model,
  actions,
  today,
  neighbours,
  avatarInitial,
  isFocused = true,
  styleId = null,
}: HomeScreenProps & { model: HomeReadyModel }) {
  const { garden, layout: homeLayout } = model;
  const insets = useSafeInsets();
  return (
    <>
      <View style={homeLayout === 'dead' ? styles.deadStage : styles.stage}>
        {homeLayout === 'dead' ? null : (
          // Down to the middle of the first card, as in the mockups: the cards rise over its end.
          <GradientBackdrop
            name={BACKDROPS[homeLayout]}
            extendUp={insets.top + PULL_ROOM}
            style={styles.backdrop}
          />
        )}
        <HomeHeader
          today={today}
          streakDays={model.streakDays}
          avatarInitial={avatarInitial}
          onOpenProfile={actions.openProfile}
        />
        {homeLayout === 'dead' ? (
          // The dry earth in the middle of the room left, as on the mockup.
          <View style={styles.deadEarth}>
            <GardenStage garden={garden} isActive={isFocused} styleId={styleId} />
          </View>
        ) : (
          <GardenStage garden={garden} isActive={isFocused} styleId={styleId} />
        )}
        {homeLayout === 'dead' ? null : (
          <GardenProgress hizb={model.hizb} waterRun={model.waterRun} growing={growingOf(model)} />
        )}
      </View>
      {homeLayout === 'dead' ? (
        <View style={styles.deadFoot}>
          <DeadGarden model={model} onRead={actions.readAndWater} />
        </View>
      ) : (
        <>
          <View style={styles.cards}>
            {homeLayout === 'thirsty' &&
            model.drought !== null &&
            (garden.phase === 'thirsty' ||
              garden.phase === 'wilting' ||
              garden.phase === 'dying') ? (
              <ThirstBanner phase={garden.phase} drought={model.drought} />
            ) : null}
            {model.notice === 'recovering' ? <RecoveringBanner /> : null}
            <DailyCard
              model={model}
              onRead={actions.readAndWater}
              onRecognize={actions.recognize}
            />
            {homeLayout === 'growing' && garden.lastUnlocked !== null ? (
              <AddedCard element={garden.lastUnlocked} />
            ) : null}
          </View>
          <NeighbourGardensSection
            neighbours={neighbours}
            onSeeAll={actions.openFriends}
            onOpenFriend={actions.openFriend}
          />
        </>
      )}
    </>
  );
}

/**
 * What grows, for the line under the garden: only while the garden grows. A thirsty garden has
 * nothing to celebrate (soif.png), and a garden complete has nothing left to grow.
 */
function growingOf(model: HomeReadyModel): GardenGrowing | null {
  const next = model.garden.nextElement;
  if (model.layout !== 'growing' || next === null) return null;
  return { kind: next.element.kind, growth: next.growth, pages: model.growingPages };
}

/**
 * The garden could not be computed: the system's empty state says what happened and what to do,
 * without blame and without "we", and a button lets the person try again (writing.md › Best
 * practices: clear next steps, and a button to take them).
 */
function UnavailableHome({ actions, today, avatarInitial }: HomeScreenProps) {
  const { t } = useTranslation('home');
  return (
    <HomeFrame layout="growing">
      <HomeHeader
        today={today}
        streakDays={0}
        avatarInitial={avatarInitial}
        onOpenProfile={actions.openProfile}
      />
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
    </HomeFrame>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: spacing.xl },
  backdrop: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 },
  stage: { paddingBottom: spacing.xxl },
  deadStage: { flexGrow: 1 },
  deadFoot: { paddingBottom: spacing.md },
  deadEarth: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.lg },
  cards: {
    marginTop: -spacing.xl,
    paddingHorizontal: layout.screenMargin,
    rowGap: spacing.md,
    paddingBottom: spacing.lg,
  },
  unavailableAction: { paddingHorizontal: layout.screenMargin, paddingVertical: spacing.md },
});
