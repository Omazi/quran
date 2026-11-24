import {
  DatePicker,
  HStack,
  LabeledContent,
  Picker,
  Stepper,
  Text,
  Toggle,
} from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  accessibilityValue,
  datePickerStyle,
  disabled as disabledModifier,
  labelsHidden,
  monospacedDigit,
  pickerStyle,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { spacing } from '../../tokens';
import { useColors } from '../../use-colors';
import type { ChoiceRowProps, StepperRowProps, SwitchRowProps, TimePickerRowProps } from '../types';
import { assertStepperRange, dateToTimeOfDay, timeOfDayToDate } from '../validation';

/**
 * The system switch, in a list row, with the row's text as its label and the system's own
 * colour (toggles.md › Mobile).
 */
export function SwitchRow({ label, value, onChange, disabled = false, testID }: SwitchRowProps) {
  return (
    <Toggle
      label={label}
      isOn={value}
      onIsOnChange={onChange}
      testID={testID}
      modifiers={[disabledModifier(disabled)]}
    />
  );
}

/**
 * The system stepper next to the value it changes, because a stepper shows none
 * (steppers.md › Best practices). The stepper keeps its label for screen readers and speaks the
 * value; the written value is not read a second time.
 */
export function StepperRow({
  label,
  value,
  valueLabel,
  min,
  max,
  step = 1,
  onChange,
  testID,
}: StepperRowProps) {
  assertStepperRange({ value, min, max, step });
  return (
    <LabeledContent label={label}>
      <HStack spacing={spacing.md}>
        <Text modifiers={[monospacedDigit(), accessibilityHidden()]}>{valueLabel}</Text>
        <Stepper
          label={label}
          value={value}
          min={min}
          max={max}
          step={step}
          onValueChange={onChange}
          testID={testID}
          modifiers={[labelsHidden(), accessibilityValue(valueLabel)]}
        />
      </HStack>
    </LabeledContent>
  );
}

/**
 * The system's pop-up button: a flat list of mutually exclusive options, whose label lets
 * people guess the options without opening it (pop-up-buttons.md › Best practices).
 */
export function ChoiceRow<Value extends string>({
  label,
  options,
  value,
  onChange,
  testID,
}: ChoiceRowProps<Value>) {
  return (
    <Picker<Value>
      label={label}
      selection={value}
      onSelectionChange={onChange}
      testID={testID}
      modifiers={[pickerStyle('menu')]}
    >
      {options.map((option) => (
        <Text key={option.value} modifiers={[tag(option.value)]}>
          {option.label}
        </Text>
      ))}
    </Picker>
  );
}

/**
 * The system's compact time picker: a button that shows the time in the app's accent colour and
 * opens the editor in place (pickers.md › Mobile).
 */
export function TimePickerRow({ label, value, onChange, testID }: TimePickerRowProps) {
  const colors = useColors();
  return (
    <DatePicker
      title={label}
      selection={timeOfDayToDate(value)}
      displayedComponents={['hourAndMinute']}
      onDateChange={(date) => onChange(dateToTimeOfDay(date))}
      testID={testID}
      modifiers={[datePickerStyle('compact'), tint(colors.accent)]}
    />
  );
}
