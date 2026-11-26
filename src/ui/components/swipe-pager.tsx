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
import {
  PROJECTED_PAGING,
  SWIPE_PAGING,
  cappedReleaseVelocity,
  draggedPosition,
  projectedDragPosition,
  projectedTarget,
  releaseVelocity,
  settledPage,
} from './swipe-paging';

/** The direction the pages turn in: sideways (the default) or up and down. */
export type PagerAxis = 'horizontal' | 'vertical';

/**
 * How a page moves as the position changes. `slide`: the page slides with the finger, one page
 * length per page (a carousel). `still`: the pages stay in place and fade or move by themselves
 * from the position they receive (a scene that changes under the finger, as the first launch).
 */
export type PageMotion = 'slide' | 'still';

/**
 * A spring as Reanimated takes it: how long it takes to settle and how much it bounces, or its
 * physical values (mass, stiffness, damping).
 */
export type SettleSpring =
  | { readonly duration: number; readonly dampingRatio: number }
  | { readonly mass: number; readonly stiffness: number; readonly damping: number };

/**
 * How a release chooses its page. `threshold`: the neighbour, past 16 % of a page or a quick
 * flick (the system pager). `projected`: the page nearest to where the flick would stop (Apple's
 * projection), one page at most from where the gesture started, the finger followed 1:1 with a
 * rubber band past the ends, a touch catching the spring where it is (the first launch's motion
 * spec, §1).
 */
export type PagerRelease = 'threshold' | 'projected';

/** The natural pulsation of a spring, for the release speed's cap (`ω = √(k / m)`). */
function omegaOf(spring: SettleSpring | undefined): number {
  if (spring !== undefined && 'stiffness' in spring)
    return Math.sqrt(spring.stiffness / spring.mass);
  return Math.sqrt(PROJECTED_PAGING.spring.stiffness / PROJECTED_PAGING.spring.mass);
}

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
  /**
   * Draws a page. Every page has the width and the height of the pager. It receives the position
   * too, for a page that animates itself (`pageMotion="still"`).
   */
  renderPage: (page: number, position: SharedValue<number>) => ReactNode;
  /** Defaults to `horizontal`. A vertical pager turns forwards when the finger goes up. */
  axis?: PagerAxis;
  /** Defaults to `slide`. */
  pageMotion?: PageMotion;
  /**
   * The spring every settle takes, after a drag (seeded with the finger's speed) and after a page
   * asked from outside: for a pager that must always settle the same way (the first launch takes
   * a critically damped one, `dampingRatio: 1`). Defaults to the release spring after a drag and
   * the sheet curve after a step (`SWIPE_PAGING`).
   */
  settleSpring?: SettleSpring;
  /** Defaults to `threshold`. */
  release?: PagerRelease;
  /** What stays in place over the pages: the page dots, a button. Receives the position too. */
  renderOverlay?: (position: SharedValue<number>) => ReactNode;
  /**
   * Called each time a finger comes down on the pages (before it is known to be a swipe), from
   * the view's own touch event. For the diagnostics' trail of gestures; nothing else.
   */
  onTouchStart?: () => void;
  /**
   * Something that drives the pager as a finger does (the iOS check's automatic swipe): it is
   * rendered inside the pager and receives `begin`, `move` and `end`, which are what the pan
   * gesture itself calls. Not given in any build a person uses.
   */
  renderDriver?: (drive: PagerDrive) => ReactNode;
  testID?: string;
}

/**
 * The three steps of a drag, as the pan gesture takes them, and what a driver needs to take them
 * too. `begin`, `move` and `end` are worklets: call them from the UI thread (a worklet or
 * `runOnUI`), as the gesture does.
 */
export interface PagerDrive {
  /** The finger comes down and the pages are taken (a slide in progress is caught). */
  begin: () => void;
  /** The finger has moved along the pager's axis by this many points since it came down. */
  move: (translation: number) => void;
  /**
   * The finger leaves, at this speed along the axis (points per second); `canceled` for a gesture
   * cut short.
   */
  end: (velocity: number, canceled: boolean) => void;
  /** The size of a page along the axis: its width, or its height for a vertical pager. */
  readonly length: number;
  readonly page: number;
  readonly pageCount: number;
  /**
   * True when a positive translation turns forwards (a sideways pager in a right-to-left
   * interface). A vertical pager turns forwards upwards: always false.
   */
  readonly isRightToLeft: boolean;
  readonly axis: PagerAxis;
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
 * - a move across the axis goes to what scrolls inside a page;
 * - turned on its side (`axis="vertical"`), one swipe up is one page forwards, and with
 *   `pageMotion="still"` the pages do not slide: they draw themselves from the position (the
 *   first launch, whose scene changes under the finger: SKILLS.md, deviation 128);
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
  onTouchStart,
  renderDriver,
  axis = 'horizontal',
  pageMotion = 'slide',
  settleSpring,
  release = 'threshold',
  testID,
}: SwipePagerProps) {
  if (!Number.isInteger(page) || page < 0 || page >= pageCount) {
    throw new RangeError(`There is no page ${page} in a pager of ${pageCount} pages.`);
  }
  const isMotionReduced = useReducedMotion();
  const isVertical = axis === 'vertical';
  // Upwards is forwards on a vertical pager, whatever the writing direction.
  const isRightToLeft = !isVertical && getWritingDirection() === 'rtl';
  /** The size of a page along the axis (`width` in the arithmetic of swipe-paging.ts). */
  const [length, setLength] = useState(0);
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
        : settleSpring !== undefined
          ? withSpring(page, settleSpring)
          : withTiming(page, {
              duration: SWIPE_PAGING.stepDurationMs,
              // Built here, not when the module loads: importing the design system stays free of
              // Reanimated work.
              easing: Easing.bezier(...SWIPE_PAGING.stepCurve),
            }),
    );
  }, [page, isMotionReduced, position, target, settleSpring]);

  const report = (next: number) => {
    reported.current = next;
    onPageChange(next);
  };

  const isProjected = release === 'projected';
  const omega = omegaOf(isProjected ? (settleSpring ?? PROJECTED_PAGING.spring) : settleSpring);
  /** Projected pager: whether the touch caught a moving spring, and the drag's dead zone. */
  const caught = useSharedValue(false);
  const deadZone = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const lastMoveAt = useSharedValue(0);
  const lastTranslation = useSharedValue(0);

  // The three steps of a drag. The pan gesture below calls them on the UI thread; so does the
  // iOS check's driver, which is how it takes the same path as a finger (without the touch).
  const begin = () => {
    'worklet';
    // A touch on pages still settling catches them where they are (gestures skill).
    caught.set(Math.abs(position.get() - target.get()) > 0.001);
    cancelAnimation(position);
    dragStart.set(position.get());
    deadZone.set(0);
    lastTranslation.set(0);
    lastMoveAt.set(Date.now());
    isDragging.set(true);
  };
  /**
   * The gesture has travelled far enough to be a swipe. On pages at rest the travel it took is a
   * dead zone (a tap stays a tap, and the page does not jump); pages caught while moving follow
   * the finger from the touch.
   */
  const activate = (translation: number) => {
    'worklet';
    if (!isProjected) return;
    if (!caught.get()) {
      deadZone.set(translation);
      dragStart.set(position.get());
    }
  };
  const move = (translation: number) => {
    'worklet';
    if (Math.abs(translation - lastTranslation.get()) > 0.5) {
      lastMoveAt.set(Date.now());
      lastTranslation.set(translation);
    }
    if (isProjected) {
      const moved = translation - deadZone.get();
      position.set(
        projectedDragPosition({
          start: dragStart.get(),
          forwards: isVertical || !isRightToLeft ? -moved : moved,
          length,
          pageCount,
        }),
      );
      return;
    }
    position.set(
      draggedPosition({
        anchor: target.get(),
        start: dragStart.get(),
        translation,
        width: length,
        isRightToLeft,
        pageCount,
      }),
    );
  };
  const settleTo = (next: number, forwardsSpeed: number) => {
    'worklet';
    position.set(
      isMotionReduced
        ? withTiming(next, { duration: SWIPE_PAGING.reducedSettleMs })
        : withSpring(next, {
            ...(settleSpring ??
              (isProjected ? PROJECTED_PAGING.spring : SWIPE_PAGING.releaseSpring)),
            velocity: forwardsSpeed,
          }),
    );
  };
  const end = (velocity: number, canceled: boolean) => {
    'worklet';
    isDragging.set(false);
    let next: number;
    let forwardsSpeed: number;
    if (isProjected) {
      const speed = releaseVelocity({
        velocity,
        restedMs: Date.now() - lastMoveAt.get(),
        canceled,
      });
      const forwards = (isVertical || !isRightToLeft ? -speed : speed) / length;
      next = projectedTarget({
        position: position.get(),
        velocity: forwards,
        anchor: target.get(),
        pageCount,
      });
      forwardsSpeed = cappedReleaseVelocity({
        position: position.get(),
        target: next,
        velocity: forwards,
        omega,
      });
    } else {
      next = settledPage({
        anchor: target.get(),
        position: position.get(),
        velocity: canceled ? 0 : velocity,
        width: length,
        isRightToLeft,
        pageCount,
      });
      forwardsSpeed = (isRightToLeft ? velocity : -velocity) / length;
    }
    settleTo(next, forwardsSpeed);
    if (next !== target.get()) {
      target.set(next);
      scheduleOnRN(report, next);
    }
  };
  /** A touch that never became a swipe: caught pages go on to where they were going. */
  const finalize = () => {
    'worklet';
    if (!isDragging.get()) return;
    isDragging.set(false);
    if (position.get() !== target.get()) settleTo(target.get(), 0);
  };

  const distance = isProjected
    ? PROJECTED_PAGING.activationDistance
    : SWIPE_PAGING.activationDistance;
  const activation: [number, number] = [-distance, distance];
  const crossFail: [number, number] = [
    -SWIPE_PAGING.verticalFailDistance,
    SWIPE_PAGING.verticalFailDistance,
  ];
  const gesture = usePanGesture({
    testID: testID === undefined ? undefined : `${testID}-pan`,
    enabled: length > 0 && pageCount > 1,
    maxPointers: 1,
    // The pages take a move along their axis; a move across it first goes to what is inside.
    activeOffsetX: isVertical ? undefined : activation,
    failOffsetY: isVertical ? undefined : crossFail,
    activeOffsetY: isVertical ? activation : undefined,
    failOffsetX: isVertical ? crossFail : undefined,
    // The projected pager takes the pages at the touch (to catch them), the other at the swipe.
    onBegin: () => {
      if (isProjected) begin();
    },
    onActivate: (event) => {
      if (!isProjected) begin();
      else activate(isVertical ? event.translationY : event.translationX);
    },
    onUpdate: (event) => move(isVertical ? event.translationY : event.translationX),
    onDeactivate: (event) => end(isVertical ? event.velocityY : event.velocityX, event.canceled),
    onFinalize: () => {
      if (isProjected) finalize();
    },
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLength(isVertical ? height : width);
  };
  // The page shown and its two neighbours: the ones a gesture can bring.
  const mounted = [page - 1, page, page + 1].filter((index) => index >= 0 && index < pageCount);

  return (
    <GestureHandlerRootView style={styles.pager} testID={testID}>
      {renderBackground?.(position)}
      <GestureDetector gesture={gesture}>
        <View
          style={styles.pages}
          onLayout={onLayout}
          // A plain touch event of the JavaScript side: no worklet, nothing for the gesture.
          onTouchStart={onTouchStart}
          testID={testIdOf(testID, 'pages')}
        >
          {length === 0
            ? null
            : mounted.map((index) => (
                <PageSlot
                  key={index}
                  index={index}
                  isCurrent={index === page}
                  position={position}
                  length={pageMotion === 'slide' ? length : 0}
                  isVertical={isVertical}
                  isRightToLeft={isRightToLeft}
                >
                  {renderPage(index, position)}
                </PageSlot>
              ))}
        </View>
      </GestureDetector>
      {renderOverlay?.(position)}
      {renderDriver === undefined ? null : (
        <DriverSlot
          render={renderDriver}
          drive={{ begin, move, end, length, page, pageCount, isRightToLeft, axis }}
        />
      )}
    </GestureHandlerRootView>
  );
}

/** Renders the driver of the pager, if there is one, with the pager's handle. */
function DriverSlot({
  render,
  drive,
}: {
  render: (drive: PagerDrive) => ReactNode;
  drive: PagerDrive;
}) {
  return <>{render(drive)}</>;
}

function testIdOf(testID: string | undefined, part: string): string | undefined {
  return testID === undefined ? undefined : `${testID}-${part}`;
}

interface PageSlotProps {
  index: number;
  isCurrent: boolean;
  position: SharedValue<number>;
  /** How far the page moves for one page of position: 0 for pages that stay in place. */
  length: number;
  isVertical: boolean;
  isRightToLeft: boolean;
  children: ReactNode;
}

/** One page, as wide and high as the pager, moved along the axis by the position. */
function PageSlot({
  index,
  isCurrent,
  position,
  length,
  isVertical,
  isRightToLeft,
  children,
}: PageSlotProps) {
  const slide = useAnimatedStyle(() => {
    // A page that stays in place: exactly 0, not -0 (which a still page would get on one side).
    const offset = length === 0 ? 0 : (index - position.get()) * length;
    return isVertical
      ? { transform: [{ translateY: offset }] }
      : { transform: [{ translateX: isRightToLeft ? -offset : offset }] };
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
