import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import type { LocalDate } from '@/domain/shared/local-date';
import { useGenderedTranslation } from '@/features/gender';
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

import type { Arrival } from './arrival';
import { ArrivalSheet } from './arrival-sheet';
import { DeadGarden } from './dead-garden';
import { GardenStage } from './garden-stage';
import { HomeHeader } from './home-header';
import type { HomeActions, HomeLayout, HomeModel, HomeReadyModel } from './home-model';
import { KhatmaComplete } from './khatma-complete';
import { LivingHome } from './living-home';
import type { NeighbourGardens } from './neighbours';
import { StatePreviewSection } from './state-preview';
import type { SkyChrome } from './use-sky-chrome';

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
  /** Tests give the sky; the app follows the real local hour. */
  chrome?: SkyChrome;
}

/**
 * The home screen, the "Jardin" tab. A growing or thirsty garden is the living garden of the
 * validated "wow" mockup (docs/design/maquette-wow, 27 November 2026): the garden full screen
 * under the sky of the hour, the rest on glass (`LivingHome`). The dry earth (mort.png) and the
 * completed khatma (khatm.png) keep their own pages, on their gradient.
 *
 * It only shows what it receives.
 */
export function HomeScreen(props: HomeScreenProps) {
  const { model, actions } = props;
  if (model.status !== 'ready') return <UnavailableHome {...props} />;
  if (model.layout === 'growing' || model.layout === 'thirsty') {
    return (
      <>
        <LivingHome
          model={model}
          actions={actions}
          today={props.today}
          neighbours={props.neighbours}
          avatarInitial={props.avatarInitial}
          isFocused={props.isFocused ?? true}
          chrome={props.chrome}
        />
        {model.layout === 'growing' && props.arrival !== null ? (
          <ArrivalSheet
            arrival={props.arrival}
            onDismiss={actions.dismissArrival}
            onShare={actions.share}
          />
        ) : null}
      </>
    );
  }
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
        <DeadHome {...props} model={model} />
      )}
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

/** The dry earth (mort.png): the header, the earth in the middle, what brings it back. */
function DeadHome({
  model,
  actions,
  today,
  avatarInitial,
  isFocused = true,
}: HomeScreenProps & { model: HomeReadyModel }) {
  return (
    <>
      <View style={styles.deadStage}>
        <HomeHeader
          today={today}
          streakDays={model.streakDays}
          avatarInitial={avatarInitial}
          onOpenProfile={actions.openProfile}
        />
        <View style={styles.deadEarth}>
          <GardenStage garden={model.garden} isActive={isFocused} />
        </View>
      </View>
      <View style={styles.deadFoot}>
        <DeadGarden model={model} onRead={actions.readAndWater} />
      </View>
    </>
  );
}

/**
 * The garden could not be computed: the system's empty state says what happened and what to do,
 * without blame and without "we", and a button lets the person try again (writing.md › Best
 * practices: clear next steps, and a button to take them).
 */
function UnavailableHome({ actions, today, avatarInitial }: HomeScreenProps) {
  const { t } = useGenderedTranslation('home');
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
  deadStage: { flexGrow: 1 },
  deadFoot: { paddingBottom: spacing.md },
  deadEarth: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.lg },
  unavailableAction: { paddingHorizontal: layout.screenMargin, paddingVertical: spacing.md },
});
