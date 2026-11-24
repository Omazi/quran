import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/app-text';
import { layout, radius, spacing } from '../../tokens';
import { useColors } from '../../use-colors';
import { Icon } from '../icon';
import type {
  ContentUnavailableProps,
  GaugeProps,
  ProgressIndicatorProps,
  StatusTone,
} from '../types';
import { assertFraction } from '../validation';

const PERCENT = 100;

interface BarProps {
  /** Between 0 and 1. */
  value: number;
  tone: StatusTone;
  thickness: number;
}

/**
 * A track and its fill. The fill starts at the leading edge, so it runs from the right in Arabic
 * (right-to-left.md › Controls).
 */
function Bar({ value, tone, thickness }: BarProps) {
  const colors = useColors();
  return (
    <View style={[styles.track, { height: thickness, backgroundColor: colors.fill }]}>
      <View
        style={[styles.fill, { width: `${value * PERCENT}%`, backgroundColor: colors[tone] }]}
      />
    </View>
  );
}

/**
 * Default progress indicator, for Android, the web and tests: Material's thin linear bar when
 * the progress is known, the platform's spinner when it is not.
 */
export function ProgressIndicator({ value, accessibilityLabel, testID }: ProgressIndicatorProps) {
  const colors = useColors();
  if (value === undefined) {
    return (
      <ActivityIndicator
        accessibilityRole="progressbar"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ busy: true }}
        color={colors.accent}
        testID={testID}
      />
    );
  }
  assertFraction(value, 'value');
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: PERCENT, now: Math.round(value * PERCENT) }}
      testID={testID}
    >
      <Bar value={value} tone="accent" thickness={spacing.xs} />
    </View>
  );
}

/**
 * Default gauge: what it measures and the current value in words, a filled bar, and the meaning
 * of both ends when given. One element for screen readers, which hear the label and the value.
 */
export function Gauge({
  value,
  label,
  valueLabel,
  minimumLabel,
  maximumLabel,
  tone = 'accent',
  testID,
}: GaugeProps) {
  assertFraction(value, 'value');
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ text: valueLabel }}
      testID={testID}
      style={styles.gauge}
    >
      <View style={styles.labels}>
        <AppText style={styles.grow}>{label}</AppText>
        <AppText color="secondaryLabel">{valueLabel}</AppText>
      </View>
      <Bar value={value} tone={tone} thickness={spacing.sm} />
      {minimumLabel === undefined && maximumLabel === undefined ? null : (
        <View style={styles.labels}>
          <AppText variant="footnote" color="secondaryLabel" style={styles.grow}>
            {minimumLabel}
          </AppText>
          <AppText variant="footnote" color="secondaryLabel" align="end">
            {maximumLabel}
          </AppText>
        </View>
      )}
    </View>
  );
}

/**
 * Default empty state: an icon, a short title and what to expect, centred in the space
 * available. Also shown on iOS 16, which has no system component for it.
 */
export function ContentUnavailable({
  title,
  description,
  symbol,
  testID,
}: ContentUnavailableProps) {
  return (
    <View style={styles.contentUnavailable} testID={testID}>
      <Icon symbol={symbol} textStyle="headline" color="secondaryLabel" />
      <AppText variant="title2" align="center">
        {title}
      </AppText>
      {description === undefined ? null : (
        <AppText color="secondaryLabel" align="center">
          {description}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  fill: { borderRadius: radius.sm },
  gauge: { alignSelf: 'stretch', gap: spacing.sm },
  labels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.xs,
  },
  grow: { flexGrow: 1, flexShrink: 1 },
  contentUnavailable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.screenMargin,
    gap: spacing.sm,
  },
});
