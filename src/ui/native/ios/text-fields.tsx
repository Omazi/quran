import {
  Button as SwiftUIButton,
  HStack,
  Image,
  LabeledContent,
  TextField,
  type TextFieldRef,
} from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  accessibilityLabel,
  autocorrectionDisabled,
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  keyboardType,
  multilineTextAlignment,
  submitLabel,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import { useRef } from 'react';

import { appleTextStyles, layout, spacing } from '../../tokens';
import { useGroupedListGuard } from '../grouped-list-scope';
import type { NumberFieldRowProps, SearchFieldRowProps } from '../types';

/** The system's own secondary level, which adapts to its context (labels.md › Best practices). */
const SECONDARY = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
const TERTIARY = foregroundStyle({ type: 'hierarchical', style: 'tertiary' });
/** Non-digits, removed as they are typed: the field holds a whole number only. */
const NOT_A_DIGIT = /[^0-9٠-٩]/g;

/**
 * The system's text field as an inline search field, in a row of the list above the rows it
 * filters (search-fields.md › Search as an inline field): the magnifying glass at its leading
 * end to say its purpose, the Clear button at its trailing end once it holds text
 * (text-fields.md › Mobile), the keyboard's Search key, no autocorrection of names. The `searchable`
 * modifier of the navigation bar is not used: the app has no SwiftUI navigation stack.
 *
 * The field keeps its own text and reports each change; it starts empty, so the caller starts
 * with an empty search.
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
  const field = useRef<TextFieldRef>(null);
  const clear = () => {
    void field.current?.clear();
    onChange('');
  };
  return (
    <HStack spacing={spacing.sm}>
      <Image
        systemName="magnifyingglass"
        modifiers={[font({ textStyle: appleTextStyles.body }), SECONDARY, accessibilityHidden()]}
      />
      <TextField
        ref={field}
        placeholder={placeholder}
        onTextChange={onChange}
        testID={testID}
        modifiers={[
          submitLabel('search'),
          autocorrectionDisabled(),
          textInputAutocapitalization('never'),
          accessibilityLabel(label),
        ]}
      />
      {value === '' ? null : (
        // Borderless, so that only the symbol clears the field, not the whole row.
        <SwiftUIButton
          onPress={clear}
          modifiers={[
            buttonStyle('borderless'),
            frame({ minWidth: layout.touchTarget, minHeight: layout.touchTarget }),
            accessibilityLabel(clearLabel),
          ]}
        >
          <Image
            systemName="xmark.circle.fill"
            modifiers={[font({ textStyle: appleTextStyles.body }), TERTIARY]}
          />
        </SwiftUIButton>
      )}
    </HStack>
  );
}

/**
 * The system's text field for a whole number, at the trailing side of a labelled row, with the
 * number pad (text-fields.md › Best practices: show the appropriate keyboard type). Anything but
 * digits, pasted for instance, is dropped from what is reported. The field keeps its own text
 * and starts empty.
 */
export function NumberFieldRow({ label, placeholder, onChange, testID }: NumberFieldRowProps) {
  useGroupedListGuard('NumberFieldRow');
  return (
    <LabeledContent label={label}>
      <TextField
        placeholder={placeholder}
        onTextChange={(text) => onChange(text.replace(NOT_A_DIGIT, ''))}
        testID={testID}
        modifiers={[
          keyboardType('numeric'),
          multilineTextAlignment('trailing'),
          accessibilityLabel(label),
        ]}
      />
    </LabeledContent>
  );
}
