import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Platform,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

import type { GardenState } from '@/domain/garden';
import { publishHandle } from '@/features/screen-check/handles';
import { Pill, spacing, useReducedMotion, type IconSymbol } from '@/ui';

import { GARDEN_PICTURE_ASPECT_RATIO } from '../config';
import { SHIPPED_GARDEN_IMAGES } from '../garden-images';
import { gardenStage } from '../garden-picture';
import { GardenScene } from '../garden-scene';
import { gardenSceneLabel } from '../garden-words';
import { useGardenPictureSequence } from '../use-garden-picture';
import { GARDEN_3D } from './config';
import { GardenSurface } from './garden-surface';
import { useGardenGestures } from './use-garden-gestures';
import { useGardenHint } from './use-garden-hint';
import { useGardenModel } from './use-garden-model';
import { useGrowthPlayback } from './use-growth-playback';

/** Where the first-time hint goes: over the bottom of the garden, or in a row under it. */
export type GardenHintPlacement = 'overlay' | 'below';

export interface GardenView3DProps {
  /** The garden to show, exactly as the garden module describes it. */
  state: GardenState;
  hintPlacement?: GardenHintPlacement;
  /**
   * Takes all the height its parent gives instead of the picture's own proportions. The garden
   * is then centred in it, and what a zoom shows beyond the picture dissolves at the edges.
   */
  fill?: boolean;
  /**
   * The person's own garden: the plant of the hizb in progress grows on screen from where it was
   * last seen, once (owner, 25 November 2026). Off for a friend's garden, shown as it is.
   */
  playsGrowth?: boolean;
  /** The screen is in front: false while the reader is pushed over it. A growth waits for it. */
  isActive?: boolean;
  testID?: string;
}

/** The circular arrow of the mockup's hint (visite.png). Both exist on iOS 16. */
const TURN_SYMBOL: IconSymbol = { ios: 'arrow.clockwise', android: 'rotate_right' };

/**
 * The garden in 3D (decision D40): the level-1 garden of the pictures, which turns under the
 * finger and zooms with a pinch (visite.png: « Glisse pour tourner, pince pour zoomer »). At rest
 * it is the picture: same models, same camera, same light, same stage for the same state.
 *
 * - **Never a blank box** (loading.md › Show something as soon as possible): the picture
 *   (`GardenScene`) is shown while the model loads and until the view has a size, and stays if
 *   the GL view or the model fails; the 3D garden fades in over it once its first frame is
 *   really drawn (a frame into an empty buffer is not one). If GL never draws, the picture stays.
 * - **The stage follows the state** as the pictures do: one step at a time, drying slower than
 *   reviving (D26), at once with Reduce Motion.
 * - **VoiceOver** reads one image, described in words as the picture is (voiceover.md ›
 *   Descriptions), with actions to turn it and to go back to the start (› Make charts and other
 *   infographics fully accessible: interactions available to VoiceOver too; gestures.md › Give
 *   people more than one way to interact).
 * - **A first-time hint**, gone after the first turn or zoom on any garden, for good (onboarding.md
 *   › context-specific tips, near the area they refer to). Hidden from VoiceOver, which has the
 *   actions instead.
 * - **The plant of the hizb in progress grows with its pages** (owner, 25 November 2026): a
 *   sprout from the first counted page, then a young tree, its branches, its leaves. On the
 *   person's own garden the growth since it was last seen plays once when the garden comes into
 *   view, in the render loop (no React render per frame); with Reduce Motion it is shown at once.
 * - **Drawn only when something changes**: a gesture, a glide, a new stage, a growth. Idle, it
 *   costs nothing.
 */
export function GardenView3D({
  state,
  hintPlacement = 'overlay',
  fill = false,
  playsGrowth = false,
  isActive = true,
  testID = 'garden-3d',
}: GardenView3DProps) {
  const { t } = useTranslation('garden');
  const isMotionReduced = useReducedMotion();
  const modelStatus = useGardenModel();
  const hint = useGardenHint();
  const [isReady, setReady] = useState(false);
  const [hasFailed, setFailed] = useState(false);
  // The GL view is made once the view has a size: a context made at 0 by 0 draws nothing.
  const [hasSize, setHasSize] = useState(false);
  const [reveal] = useState(() => new Animated.Value(0));
  const [surface] = useState(
    () =>
      new GardenSurface({
        anchor: fill ? 'center' : 'bottom',
        onReady: () => setReady(true),
        onFail: (error) => {
          console.warn('The 3D garden stopped; the picture stays.', error);
          setFailed(true);
        },
      }),
  );

  // The same stage as the pictures, walked step by step when the state jumps (D26).
  const target = gardenStage(state);
  const targetKey = `${target.count}-${target.water}-${target.foliage}`;
  // A new object only when the stage changes, so that a walk is not restarted by a render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const targetPicture = useMemo(() => ({ stage: target }), [targetKey]);
  const { picture } = useGardenPictureSequence(targetPicture, SHIPPED_GARDEN_IMAGES);
  const stage = picture?.stage ?? target;

  useEffect(() => surface.setStage(stage), [stage, surface]);
  // The plant of the hizb in progress, growing with its pages: played in the render loop.
  useGrowthPlayback(surface, state, {
    remembers: playsGrowth,
    isActive,
    isReady: isReady && !hasFailed,
    isMotionReduced,
  });
  useEffect(() => surface.setMotionReduced(isMotionReduced), [isMotionReduced, surface]);
  useEffect(() => surface.setOnUse(hint.retire), [hint.retire, surface]);
  // In the commit that removes the GL view, not after it (a passive effect runs later): from
  // then on no frame, gesture event or layout can draw into the context that leaves with it.
  useLayoutEffect(() => () => surface.dispose(), [surface]);

  // The iOS check's automatic run turns and zooms the garden through its controller; nothing in
  // any other build (the handle is only kept when the check opened it).
  useEffect(() => publishHandle('garden-controller', surface.controller), [surface]);

  const gesture = useGardenGestures(surface.controller, isReady && !hasFailed, testID);
  const model = modelStatus.status === 'ready' ? modelStatus.model : null;

  const onContextCreate = useCallback(
    (gl: ExpoWebGLRenderingContext) => {
      if (model !== null) surface.attach(gl, model);
    },
    [model, surface],
  );

  useEffect(() => {
    if (!isReady) return undefined;
    const fade = Animated.timing(reveal, {
      toValue: 1,
      duration: GARDEN_3D.revealMs,
      useNativeDriver: Platform.OS !== 'web',
    });
    fade.start();
    return () => fade.stop();
  }, [isReady, reveal]);

  const resizeFrame = useRef<number | null>(null);
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      if (width > 0 && height > 0) setHasSize(true);
      // expo-gl resizes its drawing buffer with the view: draw at the new size next frame.
      if (resizeFrame.current !== null) cancelAnimationFrame(resizeFrame.current);
      resizeFrame.current = requestAnimationFrame(() => {
        resizeFrame.current = null;
        surface.setSize({ width, height });
      });
    },
    [surface],
  );
  useEffect(
    () => () => {
      if (resizeFrame.current !== null) cancelAnimationFrame(resizeFrame.current);
    },
    [],
  );

  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const turn = GARDEN_3D.accessibilityTurn;
      if (event.nativeEvent.actionName === 'turnLeft') surface.controller.turnBy(-turn);
      else if (event.nativeEvent.actionName === 'turnRight') surface.controller.turnBy(turn);
      else if (event.nativeEvent.actionName === 'reset') surface.controller.reset();
    },
    [surface],
  );

  const shows3D = model !== null && !hasFailed && hasSize;
  const isInteractive = shows3D && isReady;
  const showsHint = hint.isShown && isInteractive;
  const hintPill = (
    <View
      style={[styles.hint, hintPlacement === 'overlay' ? styles.hintOverlay : styles.hintBelow]}
      // VoiceOver has the actions and their hint instead.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID={`${testID}-hint`}
    >
      <Pill
        symbol={TURN_SYMBOL}
        symbolColor="label"
        label={t('view3d.hint')}
        accessibilityLabel={t('view3d.hint')}
      />
    </View>
  );

  return (
    <View style={[styles.container, fill && styles.fill]}>
      <View
        style={fill ? styles.fill : styles.band}
        onLayout={onLayout}
        accessible
        accessibilityRole="image"
        accessibilityLabel={gardenSceneLabel(state, t)}
        accessibilityHint={isInteractive ? t('view3d.accessibilityHint') : undefined}
        accessibilityActions={
          isInteractive
            ? [
                { name: 'turnLeft', label: t('view3d.turnLeft') },
                { name: 'turnRight', label: t('view3d.turnRight') },
                { name: 'reset', label: t('view3d.reset') },
              ]
            : undefined
        }
        onAccessibilityAction={onAccessibilityAction}
        testID={testID}
      >
        {isInteractive ? null : (
          <View
            style={StyleSheet.absoluteFill}
            // The scene is described once, by this view.
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
          >
            <GardenScene
              state={state}
              size={fill ? 'fill' : 'band'}
              anchor={fill ? 'center' : 'bottom'}
            />
          </View>
        )}
        {shows3D ? (
          // The screens around have no gesture root of their own (the reader has its own too).
          <GestureHandlerRootView style={StyleSheet.absoluteFill}>
            <GestureDetector gesture={gesture}>
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: reveal }]}>
                <GLView
                  style={StyleSheet.absoluteFill}
                  onContextCreate={onContextCreate}
                  testID={`${testID}-gl`}
                />
              </Animated.View>
            </GestureDetector>
          </GestureHandlerRootView>
        ) : null}
        {showsHint && hintPlacement === 'overlay' ? hintPill : null}
      </View>
      {showsHint && hintPlacement === 'below' ? hintPill : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch' },
  fill: { flex: 1 },
  band: { alignSelf: 'stretch', aspectRatio: GARDEN_PICTURE_ASPECT_RATIO },
  hint: { alignItems: 'center' },
  hintOverlay: { position: 'absolute', start: 0, end: 0, bottom: spacing.sm },
  hintBelow: { paddingTop: spacing.sm },
});
