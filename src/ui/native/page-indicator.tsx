import { Pressable, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';

import { layout, spacing } from '../tokens';
import { useColors } from '../use-colors';
import type { PageIndicatorProps } from './types';
import { assertPagePosition } from './validation';

/** Diameter of a dot and space between two dots. */
const DOT_SIZE = spacing.sm;

/**
 * Page indicator: equidistant dots, the current one solid, in neutral label colours
 * (page-controls.md › Best practices and › Customizing indicators). Place it centred at the
 * bottom of the pager.
 *
 * Pressing its leading or trailing half shows the previous or next page, and screen readers get
 * an adjustable element, so paging never depends on a swipe alone (accessibility.md › Mobility).
 * The row follows the writing direction: in Arabic the first page is on the right
 * (right-to-left.md › Controls).
 *
 * One implementation for every platform, drawn in React Native: Expo UI exposes no stand-alone
 * system page control (see the deviations in src/ui/README.md).
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
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: accessibilityValue }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAccessibilityAction}
      testID={testID}
      style={styles.indicator}
    >
      <View style={styles.dots}>
        {Array.from({ length: count }, (_, page) => (
          <View
            key={page}
            style={[
              styles.dot,
              { backgroundColor: page === index ? colors.label : colors.tertiaryLabel },
            ]}
          />
        ))}
      </View>
      <View style={[StyleSheet.absoluteFill, styles.halves]}>
        <Pressable
          accessible={false}
          disabled={!hasPrevious}
          onPress={showPrevious}
          style={styles.half}
          testID={testID === undefined ? undefined : `${testID}-previous`}
        />
        <Pressable
          accessible={false}
          disabled={!hasNext}
          onPress={showNext}
          style={styles.half}
          testID={testID === undefined ? undefined : `${testID}-next`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  indicator: {
    alignSelf: 'center',
    maxWidth: '100%',
    minHeight: layout.touchTarget,
    minWidth: layout.touchTarget * 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dots: {
    flexDirection: 'row',
    gap: DOT_SIZE,
    paddingHorizontal: spacing.md,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  halves: { flexDirection: 'row' },
  half: { flex: 1 },
});
