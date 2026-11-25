import { StyleSheet, View } from 'react-native';

import { avatarRoles, pieceSizes, radius, spacing, stateOpacity } from '../tokens';
import { useColors } from '../use-colors';

export interface DottedProgressProps {
  /** Number of steps: one dot each. */
  total: number;
  /** Steps reached, from 0 to `total`. */
  reached: number;
  /**
   * The colour of the steps reached: the action green, or a friend's colour by its place in
   * `avatarRoles`, as `Avatar` takes it (visite.png: the friend's hizb in their colour).
   */
  color?: 'action' | number;
  /** Whether the step after the last one reached is under way: its dot is half tone. */
  hasStepInProgress?: boolean;
  /** What is counted, for screen readers: "Hizb terminés". */
  accessibilityLabel: string;
  /** The value in words: "24 hizb sur 60". */
  accessibilityValue: string;
  testID?: string;
}

/**
 * One dot per step, filled up to the steps reached (accueil.png: the 60 hizb under the garden).
 * The row starts on the leading side, so it fills from the right in Arabic
 * (right-to-left.md › Controls: flip controls that show progress). It is a picture of a value
 * written beside it in words; screen readers hear it once, as a progress element.
 */
export function DottedProgress({
  total,
  reached,
  color = 'action',
  hasStepInProgress = false,
  accessibilityLabel,
  accessibilityValue,
  testID,
}: DottedProgressProps) {
  if (!Number.isInteger(total) || total < 1) {
    throw new RangeError(
      `DottedProgress: total must be a whole number of at least 1, got ${total}`,
    );
  }
  if (!Number.isInteger(reached) || reached < 0 || reached > total) {
    throw new RangeError(`DottedProgress: reached must be a whole number from 0 to ${total}`);
  }
  const colors = useColors();
  const filled =
    color === 'action'
      ? colors.actionTint
      : colors[avatarRoles[color % avatarRoles.length] ?? 'actionTint'];
  const dots = Array.from({ length: total }, (_, index) => {
    if (index < reached) return 'reached';
    if (index === reached && hasStepInProgress) return 'inProgress';
    return 'ahead';
  });
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: total, now: reached, text: accessibilityValue }}
      style={styles.row}
      testID={testID}
    >
      {dots.map((state, index) => (
        <View
          key={index}
          testID={testID === undefined ? undefined : `${testID}-dot-${index}`}
          style={[
            styles.dot,
            {
              backgroundColor: state === 'ahead' ? colors.dotEmpty : filled,
            },
            state === 'inProgress' ? styles.inProgress : null,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: spacing.none,
    paddingVertical: spacing.xs,
  },
  dot: { width: pieceSizes.dot, height: pieceSizes.dot, borderRadius: radius.full },
  inProgress: { opacity: stateOpacity.inProgress },
});
