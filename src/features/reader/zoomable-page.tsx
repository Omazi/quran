import { useEffect, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import {
  GestureDetector,
  useExclusiveGestures,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { READER_CONFIG } from './config';
import { clampOffset, clampScale, offsetAfterZoom, toggledScale } from './zoom';

export interface ZoomablePageProps {
  /** Size of the page: the zoom is centred on it and the pan stays inside it. */
  width: number;
  height: number;
  /** A single tap: the reader shows or hides its bars. */
  onTap: () => void;
  /** Called when the page leaves or comes back to its own size: the pager stops while zoomed. */
  onZoomChange: (isZoomed: boolean) => void;
  /** With Reduce Motion, the double tap jumps to its size instead of animating to it. */
  isMotionReduced: boolean;
  /** Names the gestures for tests: `<testID>-tap`, `<testID>-double-tap`, `<testID>-pinch`. */
  testID: string;
  children: ReactNode;
}

/** Below this, a zoom counts as the page's own size. */
const ZOOMED_EPSILON = 0.01;

/**
 * A page that can be enlarged like an image (spec 2, deviation 30 of the register): pinch to
 * zoom, double tap to zoom in and back out (gestures.md › Standard gestures: double tap and
 * zoom), drag to move around the enlarged page. The scale stays between the page's size and
 * `READER_CONFIG.zoom.maximumScale` (scroll-views.md › Best practices). At the page's size, a
 * horizontal swipe still turns the page: the pan here only listens while the page is zoomed.
 *
 * The pinch and the drag follow the fingers on the UI thread, so they can be caught mid-way
 * (gestures.md › Best practices: handle gestures as responsively as possible). The single tap
 * waits for a double tap to fail before it shows or hides the bars.
 */
export function ZoomablePage({
  width,
  height,
  onTap,
  onZoomChange,
  isMotionReduced,
  testID,
  children,
}: ZoomablePageProps) {
  const scale = useSharedValue(1);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const isZoomed = useSharedValue(false);
  const reduced = useSharedValue(isMotionReduced);
  useEffect(() => {
    reduced.value = isMotionReduced;
  }, [isMotionReduced, reduced]);

  const halfWidth = width / 2;
  const halfHeight = height / 2;

  /** Tells the reader, once per change, whether the page is enlarged. */
  function settle(nextScale: number) {
    'worklet';
    const zoomed = nextScale > 1 + ZOOMED_EPSILON;
    if (zoomed !== isZoomed.value) {
      isZoomed.value = zoomed;
      scheduleOnRN(onZoomChange, zoomed);
    }
  }

  function moveTo(value: SharedValue<number>, target: number) {
    'worklet';
    value.value = reduced.value
      ? target
      : withTiming(target, { duration: READER_CONFIG.zoom.animationMs });
  }

  const pinch = usePinchGesture({
    testID: `${testID}-pinch`,
    onActivate: (event) => {
      startScale.value = scale.value;
      startX.value = offsetX.value;
      startY.value = offsetY.value;
      focalX.value = event.focalX - halfWidth;
      focalY.value = event.focalY - halfHeight;
    },
    onUpdate: (event) => {
      const next = clampScale(startScale.value * event.scale, READER_CONFIG.zoom.maximumScale);
      const ratio = next / startScale.value;
      scale.value = next;
      offsetX.value = clampOffset(
        offsetAfterZoom(startX.value, focalX.value, ratio),
        next,
        halfWidth,
      );
      offsetY.value = clampOffset(
        offsetAfterZoom(startY.value, focalY.value, ratio),
        next,
        halfHeight,
      );
    },
    onDeactivate: () => {
      if (scale.value <= 1 + ZOOMED_EPSILON) {
        moveTo(scale, 1);
        moveTo(offsetX, 0);
        moveTo(offsetY, 0);
        settle(1);
        return;
      }
      settle(scale.value);
    },
  });

  const pan = usePanGesture({
    testID: `${testID}-pan`,
    enabled: isZoomed,
    maxPointers: 1,
    onActivate: () => {
      startX.value = offsetX.value;
      startY.value = offsetY.value;
    },
    onUpdate: (event) => {
      offsetX.value = clampOffset(startX.value + event.translationX, scale.value, halfWidth);
      offsetY.value = clampOffset(startY.value + event.translationY, scale.value, halfHeight);
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    testID: `${testID}-double-tap`,
    onDeactivate: (event) => {
      if (event.canceled) return;
      const next = toggledScale(scale.value, READER_CONFIG.zoom.doubleTapScale);
      // Zooms in on the point tapped, and back out to the whole page.
      const ratio = next / scale.value;
      const targetX =
        next === 1
          ? 0
          : clampOffset(
              offsetAfterZoom(offsetX.value, event.x - halfWidth, ratio),
              next,
              halfWidth,
            );
      const targetY =
        next === 1
          ? 0
          : clampOffset(
              offsetAfterZoom(offsetY.value, event.y - halfHeight, ratio),
              next,
              halfHeight,
            );
      moveTo(scale, next);
      moveTo(offsetX, targetX);
      moveTo(offsetY, targetY);
      settle(next);
    },
  });

  const singleTap = useTapGesture({
    numberOfTaps: 1,
    testID: `${testID}-tap`,
    onDeactivate: (event) => {
      if (!event.canceled) scheduleOnRN(onTap);
    },
  });

  const gesture = useSimultaneousGestures(pinch, pan, useExclusiveGestures(doubleTap, singleTap));

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.page, zoomStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
});
