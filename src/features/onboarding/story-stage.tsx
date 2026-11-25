import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import {
  AppText,
  crossfade,
  stageLayerOpacity,
  storyLayout,
  swapOpacity,
  useColors,
  useElevation,
  useSafeInsets,
} from '@/ui';

import { sceneCaption, type OnboardingPage, type OnboardingScene } from './pages';

/** Draws one picture of the stage; `isShown` is true while its page is the one shown. */
export type StageLayerRenderer = (scene: OnboardingScene, isShown: boolean) => ReactNode;

export interface StoryStageProps {
  pages: readonly OnboardingPage[];
  /** The page shown: its picture is the one screen readers describe. */
  pageIndex: number;
  position: SharedValue<number>;
  renderLayer: StageLayerRenderer;
}

/** The scale of the stage for each size of `OnboardingPage.stage`. */
const STAGE_SCALE = {
  full: 1,
  small: storyLayout.smallStageScale,
  none: storyLayout.smallStageScale,
};

interface Stage {
  /** One layer per different picture, in the order of the pages. */
  readonly layers: readonly OnboardingScene[];
  /** For each page, the layer it shows, or -1. */
  readonly pageLayers: readonly number[];
  readonly pageIsGarden: readonly boolean[];
}

function stageOf(pages: readonly OnboardingPage[]): Stage {
  const keys: string[] = [];
  const layers: OnboardingScene[] = [];
  const pageLayers = pages.map(({ scene, stage }) => {
    if (scene === null || stage === 'none') return -1;
    const key = JSON.stringify(scene);
    if (!keys.includes(key)) {
      keys.push(key);
      layers.push(scene);
    }
    return keys.indexOf(key);
  });
  return {
    layers,
    pageLayers,
    pageIsGarden: pages.map(({ scene }) => scene !== null && scene.kind !== 'feature'),
  };
}

/**
 * The scene of the first launch, which stays in place while the pages slide (the prototype's
 * `.stage`): each different picture is a layer, and the position decides how visible each one is.
 * Between two states of the garden the new one is laid over the old one, so the garden is seen to
 * grow, dry and revive under the finger, at whatever speed the person swipes, and nothing has to
 * finish before the next page (motion.md › Best practices: let people cancel motion). Above the
 * goal the stage shrinks from its top edge; it is empty on the reminders page.
 *
 * Under the garden, a short caption names what it shows ("Hizb 8", "3 jours sans lecture"); it is
 * hidden from screen readers, whose description of the picture already says it.
 */
export function StoryStage({ pages, pageIndex, position, renderLayer }: StoryStageProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeInsets();
  const stage = useMemo(() => stageOf(pages), [pages]);
  const scales = useMemo(() => pages.map((page) => STAGE_SCALE[page.stage]), [pages]);
  const height = windowHeight * storyLayout.stageShare;
  const shownLayer = stage.pageLayers[pageIndex] ?? -1;

  const shrink = useAnimatedStyle(() => {
    const scale = crossfade(scales, position.value);
    const smallness = (1 - scale) / (1 - storyLayout.smallStageScale);
    // React Native scales around the centre: moving up by half the lost height keeps the top edge.
    return {
      transform: [
        { translateY: (-(1 - scale) * height) / 2 - storyLayout.smallStageLift * smallness },
        { scale },
      ],
    };
  });

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.stage, { top: insets.top + storyLayout.stageTop, height }, shrink]}
        testID="onboarding-stage"
      >
        {stage.layers.map((scene, layer) => (
          <StageLayer
            key={JSON.stringify(scene)}
            layer={layer}
            stage={stage}
            position={position}
            isShown={layer === shownLayer}
          >
            {/* Only the pictures a gesture can bring are drawn: those of the page shown and of
                its two neighbours. The others would hold full-size images for nothing. */}
            {isNear(stage, layer, pageIndex) ? renderLayer(scene, layer === shownLayer) : null}
          </StageLayer>
        ))}
      </Animated.View>
      <Captions
        pages={pages}
        position={position}
        top={insets.top + storyLayout.stageTop + height - storyLayout.captionAboveStageBottom}
      />
    </>
  );
}

/** Whether a page that shows this layer is the page shown or one of its neighbours. */
function isNear(stage: Stage, layer: number, pageIndex: number): boolean {
  return stage.pageLayers.some(
    (pageLayer, page) => pageLayer === layer && Math.abs(page - pageIndex) <= 1,
  );
}

function StageLayer({
  layer,
  stage,
  position,
  isShown,
  children,
}: {
  layer: number;
  stage: Stage;
  position: SharedValue<number>;
  isShown: boolean;
  children: ReactNode;
}) {
  const { pageLayers, pageIsGarden } = stage;
  const fade = useAnimatedStyle(() => ({
    opacity: stageLayerOpacity({ pageLayers, pageIsGarden, layer, position: position.value }),
  }));
  return (
    <Animated.View
      style={[styles.layer, fade]}
      // Only the picture of the page shown is described; the others are on their way in or out.
      accessibilityElementsHidden={!isShown}
      importantForAccessibility={isShown ? 'auto' : 'no-hide-descendants'}
    >
      {children}
    </Animated.View>
  );
}

function Captions({
  pages,
  position,
  top,
}: {
  pages: readonly OnboardingPage[];
  position: SharedValue<number>;
  top: number;
}) {
  const { t } = useTranslation('onboarding');
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.captions, { top }]}
    >
      {pages.map((page, index) => {
        const caption = sceneCaption(page);
        if (caption === null) return null;
        return (
          <Caption key={page.id} page={index} pageCount={pages.length} position={position}>
            {t(caption.key, caption.values)}
          </Caption>
        );
      })}
    </View>
  );
}

function Caption({
  page,
  pageCount,
  position,
  children,
}: {
  page: number;
  pageCount: number;
  position: SharedValue<number>;
  children: string;
}) {
  const colors = useColors();
  const shadow = useElevation('floating');
  const fade = useAnimatedStyle(() => ({
    opacity: swapOpacity({ page, pageCount, position: position.value }),
  }));
  return (
    <Animated.View style={[styles.caption, fade]} testID="onboarding-caption">
      <View style={[styles.pill, { backgroundColor: colors.pillSurface, boxShadow: shadow }]}>
        <AppText variant="subheadEmphasized" color="heading" numberOfLines={1}>
          {children}
        </AppText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { position: 'absolute', start: 0, end: 0 },
  // A picture sits in the middle of the stage, as wide as the screen (`.layer`).
  layer: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, justifyContent: 'center' },
  captions: { position: 'absolute', start: 0, end: 0, minHeight: storyLayout.captionHeight },
  caption: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center' },
  pill: {
    minHeight: storyLayout.captionHeight,
    justifyContent: 'center',
    paddingHorizontal: storyLayout.captionPadding,
    borderRadius: storyLayout.captionHeight / 2,
  },
});
