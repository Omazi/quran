import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';

import { layout, spacing } from '../tokens';
import { useColors } from '../use-colors';
import type { PageIndicatorProps } from './types';
import { assertPagePosition } from './validation';

/** Diameter of a dot. */
const DOT_SIZE = spacing.sm;
/** Space between two dots, the same everywhere: the dots are equidistant. */
const DOT_GAP = spacing.sm;
/** Diameter of a dot that stands for the pages beyond the visible ones. */
const DISTANT_DOT_SIZE = spacing.xs;
/**
 * Space kept at each end of the control. With it, the zone on either side of the current dot is
 * a full touch target as soon as it holds one dot.
 */
const END_PADDING = layout.touchTarget - DOT_SIZE - DOT_GAP;

/** How many dots fit in a width, with the space kept at both ends. Never less than one. */
export function dotCapacity(availableWidth: number): number {
  const widthForDots = availableWidth - 2 * END_PADDING;
  return Math.max(1, Math.floor((widthForDots + DOT_GAP) / (DOT_SIZE + DOT_GAP)));
}

/**
 * The pages whose dots are shown when not all fit: a window around the current page, which is
 * therefore always visible.
 */
export function visiblePageRange(
  count: number,
  index: number,
  capacity: number,
): { first: number; last: number } {
  const size = Math.min(count, Math.max(1, capacity));
  const first = Math.min(Math.max(0, index - Math.floor(size / 2)), count - size);
  return { first, last: first + size - 1 };
}

/**
 * Page indicator drawn in React Native, for the platforms without a system one: equidistant
 * dots, the current one solid, in neutral label colours, never the accent
 * (page-controls.md › Best practices and › Customizing indicators). Place it centred at the
 * bottom of the pager, in a column. On iOS, `Pager` shows the system's own indicator instead.
 *
 * - With more pages than fit, it shows the dots around the current page and shrinks the dot at
 *   an end where more pages follow (page-controls.md › Mobile).
 * - Pressing on the leading or trailing side of the current dot shows the previous or next page
 *   (page-controls.md › Mobile), and screen readers get one adjustable element, so paging never
 *   depends on a swipe alone (accessibility.md › Mobility).
 * - The row follows the writing direction: in Arabic the first page is on the right
 *   (right-to-left.md › Controls). Nothing here moves, whatever the motion setting.
 */
export function PageIndicator({
  count,
  index,
  onChange,
  accessibilityLabel,
  accessibilityValue,
  testID,
}: PageIndicatorProps) {
  assertPagePosition({ count, index });
  const colors = useColors();
  // Until the control is laid out, the window is the best known bound of the space available.
  const { width: windowWidth } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number>();
  const onLayout = (event: LayoutChangeEvent) => setMeasuredWidth(event.nativeEvent.layout.width);
  const { first, last } = visiblePageRange(count, index, dotCapacity(measuredWidth ?? windowWidth));

  const hasPrevious = index > 0;
  const hasNext = index < count - 1;
  const showPrevious = () => {
    if (hasPrevious) onChange(index - 1);
  };
  const showNext = () => {
    if (hasNext) onChange(index + 1);
  };
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') showNext();
    if (event.nativeEvent.actionName === 'decrement') showPrevious();
  };

  const dot = (page: number) => {
    const standsForHiddenPages =
      (page === first && first > 0) || (page === last && last < count - 1);
    return (
      <View key={page} style={styles.dotSlot}>
        <View
          style={[
            standsForHiddenPages ? styles.distantDot : styles.dot,
            { backgroundColor: colors.tertiaryLabel },
          ]}
        />
      </View>
    );
  };
  const pagesBefore = Array.from({ length: index - first }, (_, offset) => first + offset);
  const pagesAfter = Array.from({ length: last - index }, (_, offset) => index + 1 + offset);

  return (
    <View style={styles.frame} onLayout={onLayout}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={
          accessibilityValue === undefined
            ? { min: 1, max: count, now: index + 1 }
            : { text: accessibilityValue }
        }
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAccessibilityAction}
        testID={testID}
        style={styles.indicator}
      >
        <Pressable
          accessible={false}
          disabled={!hasPrevious}
          onPress={showPrevious}
          style={[styles.zone, styles.previousZone, pagesBefore.length > 0 && styles.beforeCurrent]}
          testID={testID === undefined ? undefined : `${testID}-previous`}
        >
          {pagesBefore.map(dot)}
        </Pressable>
        <View style={[styles.dot, { backgroundColor: colors.label }]} />
        <Pressable
          accessible={false}
          disabled={!hasNext}
          onPress={showNext}
          style={[styles.zone, styles.nextZone, pagesAfter.length > 0 && styles.afterCurrent]}
          testID={testID === undefined ? undefined : `${testID}-next`}
        >
          {pagesAfter.map(dot)}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'stretch', alignItems: 'center' },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.touchTarget,
  },
  zone: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: DOT_GAP,
  },
  previousZone: { paddingStart: END_PADDING },
  nextZone: { paddingEnd: END_PADDING },
  // The gap between the current dot and its neighbour belongs to the neighbour's zone.
  beforeCurrent: { paddingEnd: DOT_GAP },
  afterCurrent: { paddingStart: DOT_GAP },
  dotSlot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  distantDot: {
    width: DISTANT_DOT_SIZE,
    height: DISTANT_DOT_SIZE,
    borderRadius: DISTANT_DOT_SIZE / 2,
  },
});
