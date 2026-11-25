import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useReducedMotion } from '../device-settings';
import { getWritingDirection } from '../direction';
import { SWIPE_PAGING, draggedPosition, settledPage } from './swipe-paging';

export interface SwipePagerProps {
  pageCount: number;
  /** Zero-based index of the page shown. */
  page: number;
  /** Called when the person moves to another page, by a swipe or from outside (`page`). */
  onPageChange: (page: number) => void;
  /**
   * What stays in place behind the pages while they slide (a sky, a scene that changes from one
   * page to the next). It receives the position of the pager, from which it derives what it
   * shows: 2.4 is 40 % of the way from the third page to the fourth.
   */
  renderBackground?: (position: SharedValue<number>) => ReactNode;
  /** Draws a page. Every page has the width and the height of the pager. */
  renderPage: (page: number) => ReactNode;
  /** What stays in place over the pages: the page dots, a button. Receives the position too. */
  renderOverlay?: (position: SharedValue<number>) => ReactNode;
  testID?: string;
}

/**
 * A pager that follows the finger: the pages slide sideways under it one for one, and the
 * background and the overlay, which stay in place, change with the position as the pages pass.
 * One gesture turns one page at most, as the system pager does (docs/specs/ui-lot1.md, A.3).
 *
 * Built here rather than taken from the system because the validated prototype changes the scene,
 * the sky and the words continuously with the finger, which the system pager cannot tell
 * (SKILLS.md, deviation 118). It keeps what the system gives:
 * - the finger is followed 1:1, with resistance past the first and the last page, and released
 *   with a spring seeded with its speed; a page is turned past 16 % of its width or by a quick
 *   flick, and it can be caught while it still slides (gestures skill);
 * - in a right-to-left interface the next page comes from the left (right-to-left.md);
 * - a vertical move goes to what scrolls inside a page;
 * - with "reduce motion", a page changed from outside comes at once and a drag ends without a
 *   spring (motion.md › Best practices: make motion optional);
 * - only the page shown is read by screen readers and can be touched: the page dots, in the
 *   overlay, turn the pages without a swipe (gestures.md › Best practices: more than one way).
 */
export function SwipePager({
  pageCount,
  page,
  onPageChange,
  renderBackground,
  renderPage,
  renderOverlay,
  testID,
}: SwipePagerProps) {
  if (!Number.isInteger(page) || page < 0 || page >= pageCount) {
    throw new RangeError(`There is no page ${page} in a pager of ${pageCount} pages.`);
  }
  const isMotionReduced = useReducedMotion();
  const isRightToLeft = getWritingDirection() === 'rtl';
  const [width, setWidth] = useState(0);
  const position = useSharedValue(page);
  /** The page the pager rests on or slides to: the anchor of the next drag. */
  const target = useSharedValue(page);
  const dragStart = useSharedValue(page);
  /** The page last reported to the parent, so that its answer is not animated a second time. */
  const reported = useRef(page);

  // A page asked from outside (the dots, a screen reader, the first render) slides into place.
  useEffect(() => {
    if (page === reported.current && page === target.get()) return;
    reported.current = page;
    target.set(page);
    position.set(
      isMotionReduced
        ? page
        : withTiming(page, {
            duration: SWIPE_PAGING.stepDurationMs,
            // Built here, not when the module loads: importing the design system stays free of
            // Reanimated work.
            easing: Easing.bezier(...SWIPE_PAGING.stepCurve),
          }),
    );
  }, [page, isMotionReduced, position, target]);

  const report = (next: number) => {
    reported.current = next;
    onPageChange(next);
  };

  const gesture = usePanGesture({
    testID: testID === undefined ? undefined : `${testID}-pan`,
    enabled: width > 0 && pageCount > 1,
    maxPointers: 1,
    activeOffsetX: [-SWIPE_PAGING.activationDistance, SWIPE_PAGING.activationDistance],
    failOffsetY: [-SWIPE_PAGING.verticalFailDistance, SWIPE_PAGING.verticalFailDistance],
    onActivate: () => {
      cancelAnimation(position);
      dragStart.set(position.get());
    },
    onUpdate: (event) => {
      position.set(
        draggedPosition({
          anchor: target.get(),
          start: dragStart.get(),
          translation: event.translationX,
          width,
          isRightToLeft,
          pageCount,
        }),
      );
    },
    onDeactivate: (event) => {
      const next = settledPage({
        anchor: target.get(),
        position: position.get(),
        velocity: event.canceled ? 0 : event.velocityX,
        width,
        isRightToLeft,
        pageCount,
      });
      const forwardsSpeed = (isRightToLeft ? event.velocityX : -event.velocityX) / width;
      position.set(
        isMotionReduced
          ? withTiming(next, { duration: SWIPE_PAGING.reducedSettleMs })
          : withSpring(next, { ...SWIPE_PAGING.releaseSpring, velocity: forwardsSpeed }),
      );
      if (next !== target.get()) {
        target.set(next);
        scheduleOnRN(report, next);
      }
    },
  });

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  // The page shown and its two neighbours: the ones a gesture can bring.
  const mounted = [page - 1, page, page + 1].filter((index) => index >= 0 && index < pageCount);

  return (
    <GestureHandlerRootView style={styles.pager} testID={testID}>
      {renderBackground?.(position)}
      <GestureDetector gesture={gesture}>
        <View style={styles.pages} onLayout={onLayout} testID={testIdOf(testID, 'pages')}>
          {width === 0
            ? null
            : mounted.map((index) => (
                <PageSlot
                  key={index}
                  index={index}
                  isCurrent={index === page}
                  position={position}
                  width={width}
                  isRightToLeft={isRightToLeft}
                >
                  {renderPage(index)}
                </PageSlot>
              ))}
        </View>
      </GestureDetector>
      {renderOverlay?.(position)}
    </GestureHandlerRootView>
  );
}

function testIdOf(testID: string | undefined, part: string): string | undefined {
  return testID === undefined ? undefined : `${testID}-${part}`;
}

interface PageSlotProps {
  index: number;
  isCurrent: boolean;
  position: SharedValue<number>;
  width: number;
  isRightToLeft: boolean;
  children: ReactNode;
}

/** One page, as wide and high as the pager, moved sideways by the position. */
function PageSlot({ index, isCurrent, position, width, isRightToLeft, children }: PageSlotProps) {
  const slide = useAnimatedStyle(() => {
    const offset = (index - position.get()) * width;
    return { transform: [{ translateX: isRightToLeft ? -offset : offset }] };
  });
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, slide]}
      pointerEvents={isCurrent ? 'box-none' : 'none'}
      accessibilityElementsHidden={!isCurrent}
      importantForAccessibility={isCurrent ? 'auto' : 'no-hide-descendants'}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pager: { flex: 1 },
  pages: StyleSheet.absoluteFill,
});
