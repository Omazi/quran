import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { layout, radius, spacing, stateOpacity, textStyles } from '../../tokens';
import { useColors } from '../../use-colors';
import { useGroupedListGuard } from '../grouped-list-scope';
import { TEXT_FIELD_BEHAVIOURS, type TextFieldBehaviour } from '../text-field-kinds';
import type { IconSymbol, TextFieldRowProps } from '../types';
import { Icon } from './icon';

const SEARCH_SYMBOL: IconSymbol = { ios: 'magnifyingglass', android: 'search' };
const CLEAR_SYMBOL: IconSymbol = { ios: 'xmark.circle.fill', android: 'cancel' };

const KEYBOARD = {
  default: 'default',
  'email-address': 'email-address',
  'number-pad': 'number-pad',
  'web-search': 'web-search',
} as const satisfies Record<TextFieldBehaviour['keyboard'], string>;

const AUTOFILL = {
  none: 'off',
  name: 'name',
  emailAddress: 'email',
  oneTimeCode: 'one-time-code',
} as const satisfies Record<TextFieldBehaviour['content'], string>;

/**
 * Default text field: Material's filled field, the width of the row, in the row's margins. A
 * search field carries the search symbol and, while it has text, a clear button of its own
 * touch target size.
 */
export function TextFieldRow({
  label,
  placeholder,
  value,
  onChange,
  kind = 'text',
  maxLength,
  onSubmit,
  clearLabel,
  testID,
}: TextFieldRowProps) {
  useGroupedListGuard('TextFieldRow');
  const colors = useColors();
  const behaviour = TEXT_FIELD_BEHAVIOURS[kind];
  return (
    <View style={styles.row}>
      <View style={[styles.field, { backgroundColor: colors.fill }]}>
        {kind === 'search' ? <Icon symbol={SEARCH_SYMBOL} color="secondaryLabel" /> : null}
        <TextInput
          accessibilityLabel={label}
          placeholder={placeholder ?? label}
          placeholderTextColor={colors.secondaryLabel}
          value={value}
          onChangeText={onChange}
          maxLength={maxLength}
          onSubmitEditing={onSubmit}
          keyboardType={KEYBOARD[behaviour.keyboard]}
          autoCapitalize={behaviour.capitalization}
          autoCorrect={behaviour.autocorrect}
          autoComplete={AUTOFILL[behaviour.content]}
          returnKeyType={behaviour.returnKey}
          testID={testID}
          style={[styles.input, { color: colors.label }]}
        />
        {kind === 'search' && value !== '' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={clearLabel ?? label}
            onPress={() => onChange('')}
            style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
          >
            <Icon symbol={CLEAR_SYMBOL} color="secondaryLabel" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: layout.screenMargin, paddingVertical: spacing.sm },
  field: {
    minHeight: layout.touchTarget,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: layout.touchTarget,
    fontSize: textStyles.body.fontSize,
    textAlign: 'auto',
  },
  clear: {
    minWidth: layout.touchTarget,
    minHeight: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: stateOpacity.pressed },
});
