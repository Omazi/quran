import {
  Button as SwiftUIButton,
  HStack,
  Image,
  TextField,
  type TextFieldRef,
} from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  accessibilityLabel,
  autocorrectionDisabled,
  font,
  foregroundStyle,
  keyboardType,
  onSubmit as onSubmitModifier,
  submitLabel,
  textContentType,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef } from 'react';

import { appleTextStyles, spacing } from '../../tokens';
import { useGroupedListGuard } from '../grouped-list-scope';
import { TEXT_FIELD_BEHAVIOURS, type TextFieldBehaviour } from '../text-field-kinds';
import type { TextFieldRowProps } from '../types';

const SECONDARY = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
const TERTIARY = foregroundStyle({ type: 'hierarchical', style: 'tertiary' });

const KEYBOARD = {
  default: 'default',
  'email-address': 'email-address',
  'number-pad': 'ascii-capable-number-pad',
  'web-search': 'web-search',
} as const satisfies Record<TextFieldBehaviour['keyboard'], string>;

const CAPITALIZATION = {
  none: 'never',
  words: 'words',
  sentences: 'sentences',
  characters: 'characters',
} as const satisfies Record<TextFieldBehaviour['capitalization'], string>;

/**
 * The system text field in a row of the list (text-fields.md › Best practices): a placeholder,
 * the keyboard of what it asks for, and the system's own suggestions (an address, a code received
 * by message). A search field adds the search symbol at its leading end and a clear button at its
 * trailing end while it has text (search-fields.md: a search icon, a clear button, a
 * placeholder; text-fields.md › Mobile: a clear button). The system's search field
 * (`searchable`) needs a SwiftUI navigation stack, which the app does not have: deviation 35 of
 * docs/design/SKILLS.md.
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
  const behaviour = TEXT_FIELD_BEHAVIOURS[kind];
  const field = useRef<TextFieldRef>(null);
  const typed = useRef('');
  // The field keeps its own text; it is emptied from outside by setting the value to '' (after a
  // code was accepted, or by the clear button of a search field).
  useEffect(() => {
    if (value === '' && typed.current !== '') {
      typed.current = '';
      void field.current?.clear();
    }
  }, [value]);
  const change = (text: string) => {
    typed.current = text;
    onChange(text);
  };

  const content = contentModifier(behaviour);
  const input = (
    <TextField
      ref={field}
      placeholder={placeholder ?? label}
      maxLength={maxLength}
      onTextChange={change}
      testID={testID}
      modifiers={[
        accessibilityLabel(label),
        keyboardType(KEYBOARD[behaviour.keyboard]),
        textInputAutocapitalization(CAPITALIZATION[behaviour.capitalization]),
        autocorrectionDisabled(!behaviour.autocorrect),
        submitLabel(behaviour.returnKey),
        ...content,
        ...(onSubmit === undefined ? [] : [onSubmitModifier(onSubmit)]),
      ]}
    />
  );
  if (kind !== 'search') return input;
  return (
    <HStack spacing={spacing.sm}>
      <Image
        systemName="magnifyingglass"
        modifiers={[font({ textStyle: appleTextStyles.body }), SECONDARY, accessibilityHidden()]}
      />
      {input}
      {value === '' ? null : (
        <SwiftUIButton
          onPress={() => onChange('')}
          modifiers={[accessibilityLabel(clearLabel ?? label)]}
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

function contentModifier(behaviour: TextFieldBehaviour) {
  return behaviour.content === 'none' ? [] : [textContentType(behaviour.content)];
}
