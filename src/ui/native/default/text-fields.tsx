import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { layout, radius, spacing, stateOpacity, textStyles } from '../../tokens';
import { useColors } from '../../use-colors';
import { useGroupedListGuard } from '../grouped-list-scope';
import type { IconSymbol, NumberFieldRowProps, SearchFieldRowProps } from '../types';
import { RowLayout } from './grouped-list';
import { Icon } from './icon';

const SEARCH_SYMBOL: IconSymbol = { ios: 'magnifyingglass', android: 'search' };
const CLEAR_SYMBOL: IconSymbol = { ios: 'xmark.circle.fill', android: 'close' };
/** Non-digits, removed as they are typed: the field holds a whole number only. */
const NOT_A_DIGIT = /[^0-9٠-٩]/g;

/**
 * Default search field: Material's search bar, a filled field with the search icon at its
 * leading end and a close button once it holds text. It filters as the person types.
 */
export function SearchFieldRow({
  label,
  placeholder,
  value,
  onChange,
  clearLabel,
  testID,
}: SearchFieldRowProps) {
  useGroupedListGuard('SearchFieldRow');
  const colors = useColors();
  return (
    <View style={styles.searchRow}>
      <View style={[styles.searchBar, { backgroundColor: colors.fill }]}>
        <Icon symbol={SEARCH_SYMBOL} textStyle="body" color="secondaryLabel" />
        <TextInput
          accessibilityLabel={label}
          autoCapitalize="none"
          autoCorrect={false}
          enterKeyHint="search"
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.secondaryLabel}
          style={[styles.input, { color: colors.label }]}
          testID={testID}
          value={value}
        />
        {value === '' ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={clearLabel}
            hitSlop={spacing.sm}
            onPress={() => onChange('')}
            style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
            testID={testID === undefined ? undefined : `${testID}-clear`}
          >
            <Icon symbol={CLEAR_SYMBOL} textStyle="body" color="secondaryLabel" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/**
 * Default number field: the label at the leading side and an outlined field at the trailing
 * side, with the number pad. Anything but digits is dropped as it is typed.
 */
export function NumberFieldRow({
  label,
  placeholder,
  value,
  onChange,
  testID,
}: NumberFieldRowProps) {
  useGroupedListGuard('NumberFieldRow');
  const colors = useColors();
  return (
    <RowLayout
      label={label}
      trailing={
        <TextInput
          accessibilityLabel={label}
          inputMode="numeric"
          keyboardType="number-pad"
          onChangeText={(text) => onChange(text.replace(NOT_A_DIGIT, ''))}
          placeholder={placeholder}
          placeholderTextColor={colors.secondaryLabel}
          style={[
            styles.input,
            styles.numberInput,
            { color: colors.label, borderColor: colors.separator },
          ]}
          testID={testID}
          value={value}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  searchRow: { paddingHorizontal: layout.screenMargin, paddingVertical: spacing.sm },
  searchBar: {
    minHeight: layout.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },
  input: {
    flex: 1,
    minHeight: layout.touchTarget,
    fontSize: textStyles.body.fontSize,
  },
  numberInput: {
    flexGrow: 0,
    flexBasis: 'auto',
    minWidth: layout.touchTarget * 2,
    paddingHorizontal: spacing.sm,
    borderWidth: layout.outlineWidth,
    borderRadius: radius.sm,
    textAlign: 'center',
  },
  clear: {
    minWidth: layout.touchTarget,
    minHeight: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: stateOpacity.pressed },
});
