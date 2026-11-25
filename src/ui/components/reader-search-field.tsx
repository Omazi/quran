import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '../native';
import type { IconSymbol } from '../native/types';
import { layout, radius, readerShapes, spacing, stateOpacity, textStyles } from '../tokens';
import { useColors, useReaderPalette } from '../use-colors';

const SEARCH_SYMBOL: IconSymbol = { ios: 'magnifyingglass', android: 'search' };
const CLEAR_SYMBOL: IconSymbol = { ios: 'xmark.circle.fill', android: 'close' };

export interface ReaderSearchFieldProps {
  /** What screen readers call the field. */
  label: string;
  /** What can be searched (search-fields.md › Best practices: placeholder text). */
  placeholder: string;
  value: string;
  onChange: (text: string) => void;
  /** Names the button that empties the field. */
  clearLabel: string;
  testID?: string;
}

/**
 * The inline search field of the Quran tab, in the language of the validated mockups (white on
 * the warm ground, rounded like their cards; tokens `readerPalette`, deviation 83): the search
 * symbol at its leading end, the text in the body style, which follows the person's text size,
 * and a clear button once it holds text, 44 points to touch. It filters as the person types
 * (search-fields.md › Best practices: start search immediately).
 */
export function ReaderSearchField({
  label,
  placeholder,
  value,
  onChange,
  clearLabel,
  testID,
}: ReaderSearchFieldProps) {
  const colors = useColors();
  const palette = useReaderPalette();
  return (
    <View style={[styles.field, { backgroundColor: palette.card, shadowColor: palette.shadow }]}>
      <Icon symbol={SEARCH_SYMBOL} textStyle="body" color="inkSecondary" />
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        enterKeyHint="search"
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSecondary}
        style={[styles.input, { color: colors.ink }]}
        testID={testID}
        value={value}
      />
      {value === '' ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          onPress={() => onChange('')}
          style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
          testID={testID === undefined ? undefined : `${testID}-clear`}
        >
          <Icon symbol={CLEAR_SYMBOL} textStyle="body" color="inkSecondary" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: layout.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingStart: spacing.md,
    borderRadius: radius.md,
    paddingEnd: spacing.xs,
    shadowOpacity: readerShapes.shadowOpacity,
    shadowRadius: readerShapes.shadowRadius,
    shadowOffset: { width: 0, height: readerShapes.shadowOffsetY },
  },
  input: {
    flex: 1,
    minHeight: layout.touchTarget,
    fontSize: textStyles.body.fontSize,
  },
  clear: {
    minWidth: layout.touchTarget,
    minHeight: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: stateOpacity.pressed },
});
