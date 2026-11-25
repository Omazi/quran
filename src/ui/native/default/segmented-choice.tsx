import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/app-text';
import { layout, radius, spacing, stateOpacity } from '../../tokens';
import { useColors } from '../../use-colors';
import { useIsInsideGroupedList } from '../grouped-list-scope';
import { assertSegmentedChoice } from '../segmented-choice-validation';
import type { IconSymbol, SegmentedChoiceProps } from '../types';
import { Icon } from './icon';

const SELECTED_SYMBOL: IconSymbol = { ios: 'checkmark', android: 'check' };

/**
 * Default segmented choice: Material's single-select segmented buttons. Equal segments in one
 * outlined row; the selected one is filled and carries a check mark, so the selection is never
 * told by colour alone (accessibility.md › Vision). Screen readers get a radio group. In a
 * `GroupedList` it takes the side margin of the other rows.
 */
export function SegmentedChoice<Value extends string>({
  label,
  options,
  value,
  onChange,
  testID,
}: SegmentedChoiceProps<Value>) {
  assertSegmentedChoice({ options, value });
  const colors = useColors();
  const isRow = useIsInsideGroupedList();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      testID={testID}
      style={[
        styles.group,
        isRow && styles.row,
        // Same colour on every side, so nothing depends on the writing direction.
        { borderColor: colors.separator },
      ]}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: isSelected }}
            android_ripple={{ color: colors.fill }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              index > 0 && { borderStartWidth: layout.outlineWidth, borderColor: colors.separator },
              isSelected && { backgroundColor: colors.fill },
              pressed && styles.pressed,
            ]}
          >
            {isSelected ? <Icon symbol={SELECTED_SYMBOL} textStyle="subhead" /> : null}
            <AppText variant="subhead" align="center" style={styles.segmentLabel}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    borderWidth: layout.outlineWidth,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: { marginHorizontal: layout.screenMargin, marginVertical: spacing.sm },
  segment: {
    flex: 1,
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  segmentLabel: { flexShrink: 1 },
  pressed: { opacity: stateOpacity.pressed },
});
