import { StyleSheet, View } from 'react-native';

import { pieceSizes, spacing } from '../tokens';
import { useColors } from '../use-colors';

export interface SegmentProgressProps {
  /** Number of steps: one bar each (the pages of the day's goal). */
  total: number;
  /** Steps reached, from 0; more than `total` fills every bar. */
  reached: number;
  /** What is counted, for screen readers: "Arrosage du jour". */
  accessibilityLabel: string;
  /** The value in words: "5 pages sur 8". */
  accessibilityValue: string;
  testID?: string;
}

/**
 * One bar per page of the day's goal, filled in the water's colour up to the pages read
 * (maquette-wow `.segs`, validated 27 November 2026). The row starts on the leading side, so it
 * fills from the right in Arabic (right-to-left.md › Controls). A picture of a value written
 * beside it in words: screen readers hear it once, as a progress element
 * (progress-indicators.md › Best practices).
 */
export function SegmentProgress({
  total,
  reached,
  accessibilityLabel,
  accessibilityValue,
  testID,
}: SegmentProgressProps) {
  if (!Number.isInteger(total) || total < 1) {
    throw new RangeError(
      `SegmentProgress: total must be a whole number of at least 1, got ${total}`,
    );
  }
  if (!Number.isInteger(reached) || reached < 0) {
    throw new RangeError(`SegmentProgress: reached must be a whole number of at least 0`);
  }
  const colors = useColors();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{
        min: 0,
        max: total,
        now: Math.min(reached, total),
        text: accessibilityValue,
      }}
      testID={testID}
    >
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            { backgroundColor: index < reached ? colors.waterFill : colors.waterTrack },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', columnGap: spacing.xs, alignSelf: 'stretch' },
  bar: {
    flex: 1,
    height: pieceSizes.segmentHeight,
    borderRadius: pieceSizes.segmentHeight / 2,
  },
});
