import { StatusBar } from 'expo-status-bar';
import { useMemo, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import {
  ActionButton,
  AppText,
  PAGE_DOTS,
  PageDots,
  SwipePager,
  crossfade,
  layout,
  storyLayout,
  useSafeInsets,
} from '@/ui';

import type { OnboardingFeature, OnboardingPage, OnboardingPageKind } from './pages';
import { GoalPage } from './pages/goal-page';
import type { OnboardingPageProps } from './pages/page-props';
import { RemindersPage } from './pages/reminders-page';
import { StoryPage } from './pages/story-page';
import { VoicePage } from './pages/voice-page';
import { renderPlaceholderScene, type SceneRenderer } from './scene';
import { FriendsScene } from './scenes/friends-scene';
import { RecognitionScene } from './scenes/recognition-scene';
import { VoiceScene } from './scenes/voice-scene';
import { StoryBackdrop } from './story-backdrop';
import { StoryStage, type StageLayerRenderer } from './story-stage';
import type { OnboardingActions, OnboardingModel } from './use-onboarding';

/** The component of each kind of page. A page is replaced here, and only here. */
const PAGE_COMPONENTS: Readonly<Record<OnboardingPageKind, ComponentType<OnboardingPageProps>>> = {
  story: StoryPage,
  voice: VoicePage,
  goal: GoalPage,
  reminders: RemindersPage,
};

export interface OnboardingScreenProps {
  model: OnboardingModel;
  actions: OnboardingActions;
  /** Draws a garden of the story. Defaults to a named placeholder. */
  renderScene?: SceneRenderer;
}

/**
 * The first launch, as the validated prototype shows it (docs/design/premier-lancement-
 * prototype.html, owner's rule of 25 November 2026): the warm sky of the welcome mockup, the
 * app's name at the top, the garden in the middle and the words under it, the page dots at the
 * bottom. The pages slide under the finger; the sky, the garden and its caption stay in place and
 * change with it, so the garden grows, dries and revives as fast as the person swipes. There is no
 * "Continue" and no "Skip" button (owner's decision, SKILLS.md deviation 3): on the last page one
 * button, "Créer mon jardin", takes the place of the dots.
 *
 * This component composes. The pages are data (pages.ts), each kind of page is its own component,
 * the pager is the design system's (`SwipePager`), and the gardens are drawn by `renderScene`.
 */
export function OnboardingScreen({
  model,
  actions,
  renderScene = renderPlaceholderScene,
}: OnboardingScreenProps) {
  const { t } = useTranslation('onboarding');
  const { pages, pageIndex } = model;
  const shown = pages[pageIndex];
  if (shown === undefined) {
    throw new RangeError(`There is no page ${pageIndex} in a flow of ${pages.length} pages.`);
  }
  const renderLayer: StageLayerRenderer = (scene, isShown) =>
    scene.kind === 'feature' ? (
      <FeatureScene feature={scene.feature} isShown={isShown} renderScene={renderScene} />
    ) : (
      renderScene(scene)
    );
  return (
    <View style={styles.screen} testID="onboarding">
      {/* Light status bar over the deep green of the listening page. */}
      <StatusBar style={shown.words === 'deep' ? 'light' : 'auto'} />
      <SwipePager
        pageCount={pages.length}
        page={pageIndex}
        onPageChange={actions.showPage}
        testID="onboarding-pager"
        renderBackground={(position) => (
          <>
            <StoryBackdrop pages={pages} position={position} />
            <StoryStage
              pages={pages}
              pageIndex={pageIndex}
              position={position}
              renderLayer={renderLayer}
            />
          </>
        )}
        renderPage={(index) => {
          const page = pages[index];
          if (page === undefined) return null;
          const Page = PAGE_COMPONENTS[page.kind];
          return <Page page={page} model={model} actions={actions} />;
        }}
        renderOverlay={(position) => (
          <Overlay
            model={model}
            actions={actions}
            position={position}
            pagerLabel={t('pager.label')}
            pagerPosition={t('pager.position', { page: pageIndex + 1, total: pages.length })}
            finishLabel={t(`finish.${model.ending}`)}
          />
        )}
      />
    </View>
  );
}

function FeatureScene({
  feature,
  isShown,
  renderScene,
}: {
  feature: OnboardingFeature;
  isShown: boolean;
  renderScene: SceneRenderer;
}) {
  switch (feature) {
    case 'recognition':
      return <RecognitionScene isShown={isShown} />;
    case 'friends':
      return <FriendsScene renderScene={renderScene} />;
    case 'voice':
      return <VoiceScene isShown={isShown} />;
  }
}

interface OverlayProps {
  model: OnboardingModel;
  actions: OnboardingActions;
  position: SharedValue<number>;
  pagerLabel: string;
  pagerPosition: string;
  finishLabel: string;
}

/**
 * What stays in place over the pages: the app's name at the top, and at the bottom the page dots,
 * which give way to the last button on the last page (the prototype's `.top`, `.pc` and `.cta`).
 * Opened again from the settings, the system's bar names the screen instead of the app.
 */
function Overlay({
  model,
  actions,
  position,
  pagerLabel,
  pagerPosition,
  finishLabel,
}: OverlayProps) {
  const { t } = useTranslation('common');
  const insets = useSafeInsets();
  const { pages, pageIndex } = model;
  const isLast = pageIndex === pages.length - 1;
  const deepValues = useMemo(() => wordsWeights(pages, 'deep'), [pages]);
  const endValues = useMemo(
    () => pages.map((_, index) => (index === pages.length - 1 ? 1 : 0)),
    [pages],
  );
  const onDeep = useDerivedValue(() => crossfade(deepValues, position.value));
  const end = useDerivedValue(() => crossfade(endValues, position.value));
  const dotsFade = useAnimatedStyle(() => ({ opacity: 1 - end.value }));
  const finishFade = useAnimatedStyle(() => ({
    opacity: end.value,
    transform: [{ scale: 0.9 + 0.1 * end.value }],
  }));

  return (
    <>
      {model.isReplay ? null : <BrandBar name={t('appName')} onDeep={onDeep} top={insets.top} />}
      <Animated.View
        style={[
          styles.bottom,
          { bottom: insets.bottom + storyLayout.dotsBottom - DOT_TOUCH_SLACK },
          dotsFade,
        ]}
        pointerEvents={isLast ? 'none' : 'box-none'}
        accessibilityElementsHidden={isLast}
        importantForAccessibility={isLast ? 'no-hide-descendants' : 'auto'}
      >
        <PageDots
          count={pages.length}
          index={pageIndex}
          position={position}
          onChange={actions.showPage}
          onDeep={onDeep}
          accessibilityLabel={pagerLabel}
          accessibilityValue={pagerPosition}
          testID="onboarding-pager-indicator"
        />
      </Animated.View>
      <Animated.View
        style={[styles.bottom, { bottom: insets.bottom + storyLayout.finishBottom }, finishFade]}
        pointerEvents={isLast ? 'box-none' : 'none'}
        accessibilityElementsHidden={!isLast}
        importantForAccessibility={isLast ? 'auto' : 'no-hide-descendants'}
      >
        {/* A capsule as wide as its words, centred like the dots it replaces. */}
        <View style={styles.finish}>
          <ActionButton
            label={finishLabel}
            onPress={actions.finish}
            disabled={model.isFinishing}
            fullWidth={false}
            testID="onboarding-finish"
          />
        </View>
      </Animated.View>
    </>
  );
}

/** The dots' control is a touch target taller than their capsule: half the difference. */
const DOT_TOUCH_SLACK = (layout.touchTarget - PAGE_DOTS.capsuleHeight) / 2;

function wordsWeights(pages: readonly OnboardingPage[], words: OnboardingPage['words']): number[] {
  return pages.map((page) => (page.words === words ? 1 : 0));
}

/**
 * The app's name at the top of every page (the welcome mockup's "[Nom]", in the serif of the
 * titles), dark on the sky and light on the deep green, crossfading with the finger.
 */
function BrandBar({
  name,
  onDeep,
  top,
}: {
  name: string;
  onDeep: SharedValue<number>;
  top: number;
}) {
  const darkFade = useAnimatedStyle(() => ({ opacity: 1 - onDeep.value }));
  const lightFade = useAnimatedStyle(() => ({ opacity: onDeep.value }));
  return (
    <View style={[styles.brand, { top }]} pointerEvents="none">
      <Animated.View style={darkFade}>
        <AppText variant="title2" color="heading" accessibilityRole="text">
          {name}
        </AppText>
      </Animated.View>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.brandCentre, lightFade]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <AppText variant="title2" color="onAction">
          {name}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  brand: {
    position: 'absolute',
    start: 0,
    end: 0,
    minHeight: storyLayout.brandBarHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandCentre: { alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', start: 0, end: 0, alignItems: 'center' },
  finish: { alignSelf: 'center', maxWidth: '100%', paddingHorizontal: storyLayout.margin },
});
