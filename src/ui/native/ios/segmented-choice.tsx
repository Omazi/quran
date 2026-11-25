import { Picker, Text } from '@expo/ui/swift-ui';
import { labelsHidden, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

import { assertSegmentedChoice } from '../segmented-choice-validation';
import type { SegmentedChoiceProps } from '../types';
import { SwiftUIHost } from './swiftui-host';

/**
 * The system segmented control: the system picker in its segmented style, one segment per
 * option, all of equal width (segmented-controls.md › Best practices). Its label is kept for
 * VoiceOver and hidden on screen: segments with text need no introductory text
 * (› Content). It works alone on a screen, where it takes the width it is given, and as a row
 * of a `GroupedList`, where the list is its host.
 */
export function SegmentedChoice<Value extends string>({
  label,
  options,
  value,
  onChange,
  testID,
}: SegmentedChoiceProps<Value>) {
  assertSegmentedChoice({ options, value });
  return (
    <SwiftUIHost size="contentHeight">
      <Picker<Value>
        label={label}
        selection={value}
        onSelectionChange={onChange}
        testID={testID}
        modifiers={[pickerStyle('segmented'), labelsHidden()]}
      >
        {options.map((option) => (
          <Text key={option.value} modifiers={[tag(option.value)]}>
            {option.label}
          </Text>
        ))}
      </Picker>
    </SwiftUIHost>
  );
}
