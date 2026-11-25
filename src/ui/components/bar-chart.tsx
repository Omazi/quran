import { StyleSheet, View } from 'react-native';

import { chart, spacing } from '../tokens';
import { useColors } from '../use-colors';
import { AppText } from './app-text';

/** One slot of the chart: a day, a month. */
export interface BarChartBar {
  readonly key: string;
  /** Zero or more, in the unit of the chart. */
  readonly value: number;
  /** Written under the slot. Leave it out on most slots: a label on every bar goes unread. */
  readonly tickLabel?: string;
  /** What VoiceOver says for the slot: its date and its value, in words (charts.md). */
  readonly accessibilityLabel: string;
  /** The slot of today: its label is written in the primary label colour. */
  readonly isCurrent?: boolean;
  /** A slot still to come: room is kept, no bar is drawn, VoiceOver skips it. */
  readonly isFuture?: boolean;
}

export interface BarChartProps {
  readonly bars: readonly BarChartBar[];
  /** Writes a value of the vertical axis ("200", "30 min"). */
  readonly formatValue: (value: number) => string;
  readonly testID?: string;
}

/** Multipliers of a power of ten for the top of the axis: their halves are round too. */
const NICE_STEPS = [2, 4, 6, 8, 10] as const;

/**
 * The top of the vertical axis: the smallest of 2, 4, 6, 8, 10 times a power of ten that holds
 * the highest value, so that 0, the half and the top are familiar numbers (charts.md › Axes).
 * Null when there is nothing above zero.
 */
export function niceAxisTop(max: number): number | null {
  if (!Number.isFinite(max) || max < 0) throw new RangeError(`Invalid maximum: ${max}`);
  if (max === 0) return null;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  for (const step of NICE_STEPS) {
    if (step * magnitude >= max) {
      // A small top such as 2 x 0.1 gives back a rounding error: cut it.
      return Number((step * magnitude).toPrecision(12));
    }
  }
  return 2 * magnitude * 10;
}

/** The fractions of the plot height where grid lines are drawn: the baseline, the half, the top. */
const GRID_FRACTIONS = [0, 0.5, 1] as const;

/**
 * A bar chart of one series over time (charts.md › Marks: bars for values that are sums, such as
 * the pages read in a day). The bars grow from a zero baseline (› Axes), in the accent, with
 * hairline grid lines and their labels on the trailing side, so the leading edge stays aligned
 * with the list (› Best practices). Laid out with flex, so the time axis runs from the leading
 * edge, right to left in Arabic (right-to-left.md › Flip controls that show progress).
 *
 * VoiceOver reads each slot with its own label; the visible axis labels are hidden from it
 * (charts.md › Enhancing the accessibility of a chart). The caller writes the summary above it.
 * Nothing moves: there is nothing to switch off for Reduce Motion.
 */
export function BarChart({ bars, formatValue, testID }: BarChartProps) {
  const colors = useColors();
  for (const bar of bars) {
    if (!Number.isFinite(bar.value) || bar.value < 0) {
      throw new RangeError(`Invalid bar value for ${bar.key}: ${bar.value}`);
    }
  }
  const top = niceAxisTop(Math.max(0, ...bars.map((bar) => bar.value)));
  const axisLabels = top === null ? [] : GRID_FRACTIONS.map((fraction) => fraction * top);

  const axisLabelStyle = (index: number) =>
    // The top label hangs below its line, the others sit on theirs: none leaves the plot.
    GRID_FRACTIONS[index] === 1
      ? styles.topAxisLabel
      : { bottom: (GRID_FRACTIONS[index] ?? 0) * chart.plotHeight };

  return (
    <View testID={testID} style={styles.chart}>
      <View style={styles.plotColumn}>
        <View style={styles.plot}>
          {GRID_FRACTIONS.map((fraction) => (
            <View
              key={fraction}
              style={[
                styles.gridLine,
                { bottom: fraction * chart.plotHeight, backgroundColor: colors.separator },
              ]}
            />
          ))}
          <View style={styles.slots}>
            {bars.map((bar) => (
              <View
                key={bar.key}
                style={styles.slot}
                accessible={!bar.isFuture}
                accessibilityLabel={bar.isFuture ? undefined : bar.accessibilityLabel}
                importantForAccessibility={bar.isFuture ? 'no-hide-descendants' : 'yes'}
                testID={testID === undefined ? undefined : `${testID}-bar-${bar.key}`}
              >
                {top === null || bar.isFuture || bar.value === 0 ? null : (
                  <View
                    style={[
                      styles.bar,
                      {
                        height: (bar.value / top) * chart.plotHeight,
                        backgroundColor: colors.accent,
                      },
                    ]}
                  />
                )}
              </View>
            ))}
          </View>
        </View>
        <View
          style={styles.ticks}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {bars.map((bar) => (
            <View key={bar.key} style={styles.tick}>
              {bar.tickLabel === undefined ? null : (
                <AppText
                  variant="footnote"
                  color={bar.isCurrent ? 'label' : 'secondaryLabel'}
                  align="center"
                  numberOfLines={1}
                  style={styles.tickLabel}
                >
                  {bar.tickLabel}
                </AppText>
              )}
            </View>
          ))}
        </View>
      </View>
      <View
        style={styles.axis}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {/* The widest label, invisible, gives the column its width at any text size. */}
        {axisLabels.map((value) => (
          <AppText key={`size-${value}`} variant="footnote" style={styles.sizer}>
            {formatValue(value)}
          </AppText>
        ))}
        {axisLabels.map((value, index) => (
          <AppText
            key={value}
            variant="footnote"
            color="secondaryLabel"
            style={[styles.axisLabel, axisLabelStyle(index)]}
          >
            {formatValue(value)}
          </AppText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', paddingVertical: spacing.sm },
  plotColumn: { flex: 1 },
  plot: { height: chart.plotHeight },
  gridLine: {
    position: 'absolute',
    start: 0,
    end: 0,
    height: StyleSheet.hairlineWidth,
  },
  slots: { ...StyleSheet.absoluteFill, flexDirection: 'row', alignItems: 'flex-end' },
  slot: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  bar: {
    width: chart.barSlotShare,
    maxWidth: chart.barMaxWidth,
    borderTopLeftRadius: chart.barCornerRadius,
    borderTopRightRadius: chart.barCornerRadius,
  },
  axis: { height: chart.plotHeight, paddingStart: spacing.sm },
  sizer: { opacity: 0, height: 0 },
  axisLabel: { position: 'absolute', end: 0 },
  topAxisLabel: { top: 0 },
  ticks: { flexDirection: 'row', paddingTop: spacing.xs },
  tick: { flex: 1, alignItems: 'center', overflow: 'visible' },
  // Labels may be wider than a narrow slot (a month of days): they overflow it, centred.
  tickLabel: { minWidth: spacing.xl },
});
