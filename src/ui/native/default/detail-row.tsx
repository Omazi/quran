import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/app-text';
import { layout, spacing, stateOpacity } from '../../tokens';
import { useColors } from '../../use-colors';
import { useGroupedListGuard } from '../grouped-list-scope';
import type { DetailRowProps } from '../types';

/**
 * Default row of two lines: Material's two-line list item, the whole row pressable, without the
 * disclosure chevron of iOS. One button for screen readers, which hear the label, the value and
 * the detail in that order. The value wraps under the words when they do not fit side by side.
 */
export function DetailRow({ label, detail, value, onPress, testID }: DetailRowProps) {
  useGroupedListGuard('DetailRow');
  const colors = useColors();
  const spoken = [label, value, detail].filter((part) => part !== undefined).join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      android_ripple={{ color: colors.fill }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.words}>
        <AppText>{label}</AppText>
        <AppText variant="subhead" color="secondaryLabel">
          {detail}
        </AppText>
      </View>
      {value === undefined ? null : <AppText color="secondaryLabel">{value}</AppText>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.touchTarget,
    paddingHorizontal: layout.screenMargin,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: spacing.xs,
  },
  words: { flexGrow: 1, flexShrink: 1, gap: spacing.xs },
  pressed: { opacity: stateOpacity.pressed },
});
