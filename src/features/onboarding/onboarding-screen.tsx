import { StatusBar } from 'expo-status-bar';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

import type { MushafPage } from '@/domain/quran';
import { SwipePager, useReducedMotion, useSafeInsets, type PagerDrive } from '@/ui';

import { STORY_MOTION } from './config';
import { GoalPage, RemindersPage } from './pages/settings-pages';
import { PageCopy, sceneLabelKey } from './pages/page-copy';
import type { PageProps } from './pages/page-props';
import { previewStageOf } from './preview-stage';
import { buildRecitation, type Recitation } from './recitation';
import { FriendsDemo } from './stage/friends-demo';
import { GardenStage, StageCaptions } from './stage/garden-stage';
import { MushafDemo } from './stage/mushaf-demo';
import { RecitedVerse } from './stage/recited-line';
import { RecognitionDemo } from './stage/recognition-demo';
import { isNear, type StageProps } from './stage/stage-props';
import { StageSky } from './stage/stage-sky';
import { VoiceThread } from './stage/voice-thread';
import { stageLayout, type StageLayout } from './stage-layout';
import { StoryOverlay } from './story-overlay';
import { storyMarks } from './story-math';
import { useRunStageEngine, useStageEngine, type StageEngine } from './use-stage-engine';
import type { OnboardingActions, OnboardingModel } from './use-onboarding';

export interface OnboardingScreenProps {
  readonly model: OnboardingModel;
  readonly actions: OnboardingActions;
  /** Page 1 of the mushaf (Al-Fatiha), once loaded: the verse and the voice page read it. */
  readonly fatiha: MushafPage | null;
  /** The iOS check's automatic swipe; never given in a build a person uses. */
  readonly renderDriver?: (drive: PagerDrive) => ReactNode;
  readonly onTouchStart?: () => void;
}

/**
 * The first launch in the "voix" direction the owner chose (docs/design/premier-lancement-voix/
 * index.html): one vertical swipe is one page, and everything on the screen is tied to the finger
 * (the pager's position, on the UI thread): the garden grows, dries and revives, the thread of the
 * voice runs under it, Al-Fatiha lights word by word; then the voice page, the listening page,
 * friends, the goal and the reminders, and "Créer mon jardin". Scrubbing back plays it backwards.
 * No skip and no next button (owner's decision). With "reduce motion", crossfades only.
 *
 * This component composes: the pages are data (pages.ts), the arithmetic is story-math.ts, the
 * choreography's values are config.ts, the sizes and colours are src/ui's.
 */
export function OnboardingScreen({
  model,
  actions,
  fatiha,
  renderDriver,
  onTouchStart,
}: OnboardingScreenProps) {
  const { t } = useTranslation('onboarding');
  const insets = useSafeInsets();
  const reducedMotion = useReducedMotion();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const engine = useStageEngine(reducedMotion);
  const followY = useSharedValue(0);
  const { pages, pageIndex } = model;
  const marks = useMemo(() => storyMarks(pages), [pages]);
  const recitation = useMemo(() => (fatiha === null ? null : buildRecitation(fatiha)), [fatiha]);
  const layout = useMemo(
    () => (size === null ? null : stageLayout({ ...size, top: insets.top, bottom: insets.bottom })),
    [size, insets.top, insets.bottom],
  );
  const shown = pages[pageIndex];
  if (shown === undefined) {
    throw new RangeError(`There is no page ${pageIndex} in a flow of ${pages.length} pages.`);
  }
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (size === null || size.width !== width || size.height !== height) setSize({ width, height });
  };
  const sceneLabel = (index: number) => {
    const page = pages[index];
    if (page === undefined) return '';
    const { key, values } = sceneLabelKey(page);
    return t(key, { ...values, hizb: values?.hizb ?? model.plan.hizbAfter30Days });
  };
  return (
    <View style={styles.screen} onLayout={onLayout} testID="onboarding">
      {/* Light status bar over the dusk of the voice and listening pages. */}
      <StatusBar style={shown.sky.dusk > 0.5 ? 'light' : 'auto'} />
      {layout === null ? null : (
        <SwipePager
          pageCount={pages.length}
          page={pageIndex}
          onPageChange={actions.showPage}
          axis="vertical"
          pageMotion="still"
          settleSpring={STORY_MOTION.pagingSettle}
          testID="onboarding-pager"
          onTouchStart={onTouchStart}
          renderDriver={renderDriver}
          renderBackground={(position) => (
            <Stage
              position={position}
              engine={engine}
              layout={layout}
              pages={pages}
              marks={marks}
              pageIndex={pageIndex}
              reducedMotion={reducedMotion}
              fatiha={fatiha}
              recitation={recitation}
              followY={followY}
              model={model}
            />
          )}
          renderPage={(index, position) => (
            <Page
              index={index}
              position={position}
              layout={layout}
              engine={engine}
              reducedMotion={reducedMotion}
              sceneLabel={sceneLabel(index)}
              model={model}
              actions={actions}
            />
          )}
          renderOverlay={(position) => (
            <StoryOverlay
              pages={pages}
              pageIndex={pageIndex}
              position={position}
              layout={layout}
              isReplay={model.isReplay}
              showPage={actions.showPage}
            />
          )}
        />
      )}
    </View>
  );
}

/** Everything behind the pages, which stays in place and changes with the position. */
function Stage({
  fatiha,
  recitation,
  followY,
  model,
  ...stage
}: StageProps & {
  fatiha: MushafPage | null;
  recitation: Recitation | null;
  followY: SharedValue<number>;
  model: OnboardingModel;
}) {
  const voices = useMemo(() => stage.pages.map((page) => page.voice), [stage.pages]);
  useRunStageEngine(stage.engine, {
    position: stage.position,
    voices,
    marks: stage.marks,
    recitation,
    reducedMotion: stage.reducedMotion,
  });
  const { marks, pageIndex } = stage;
  return (
    <>
      <StageSky {...stage} />
      <GardenStage {...stage} previewStage={previewStageOf(model.plan.hizbAfter30Days)} />
      <StageCaptions {...stage} previewHizb={model.plan.hizbAfter30Days} />
      {isNear(pageIndex, marks.voice) ? (
        <MushafDemo {...stage} fatiha={fatiha} recitation={recitation} followY={followY} />
      ) : null}
      <VoiceThread {...stage} followY={followY} />
      {pageIndex <= marks.voice ? <RecitedVerse {...stage} fatiha={fatiha} /> : null}
      <RecognitionDemo {...stage} />
      <FriendsDemo {...stage} />
    </>
  );
}

/** One page: its words over the stage, or the settings. */
function Page({
  index,
  engine,
  ...props
}: Omit<PageProps, 'page' | 'introMs'> & { engine: StageEngine; layout: StageLayout }) {
  const page = props.model.pages[index];
  if (page === undefined) return null;
  const pageProps: PageProps = { ...props, index, page, introMs: engine.introMs };
  switch (page.kind) {
    case 'goal':
      return <GoalPage {...pageProps} />;
    case 'reminders':
      return <RemindersPage {...pageProps} />;
    default:
      return <PageCopy {...pageProps} />;
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
