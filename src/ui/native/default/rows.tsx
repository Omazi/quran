import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View, type AccessibilityActionEvent } from 'react-native';

import { AppText } from '../../components/app-text';
import { layout, spacing, stateOpacity } from '../../tokens';
import { useColors } from '../../use-colors';
import { Icon } from '../icon';
import type {
  ChoiceRowProps,
  IconSymbol,
  StepperRowProps,
  SwitchRowProps,
  TimePickerRowProps,
} from '../types';
import { assertStepperRange, dateToTimeOfDay, timeOfDayToDate } from '../validation';
import { RowLayout } from './grouped-list';

const DECREMENT_SYMBOL: IconSymbol = { ios: 'minus', android: 'remove' };
const INCREMENT_SYMBOL: IconSymbol = { ios: 'plus', android: 'add' };
const SELECTED_SYMBOL: IconSymbol = {
  ios: 'largecircle.fill.circle',
  android: 'radio_button_checked',
};
const UNSELECTED_SYMBOL: IconSymbol = { ios: 'circle', android: 'radio_button_unchecked' };

/**
 * Default switch row: the platform switch at the end of a row. The whole row is the control, as
 * in a Material list, and it is one element for screen readers.
 */
export function SwitchRow({ label, value, onChange, disabled = false, testID }: SwitchRowProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      android_ripple={{ color: colors.fill }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      testID={testID}
      style={disabled && styles.disabled}
    >
      <RowLayout
        label={label}
        trailing={
          <Switch
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            disabled={disabled}
            onValueChange={onChange}
            trackColor={{ true: colors.accent, false: colors.fill }}
            value={value}
          />
        }
      />
    </Pressable>
  );
}

/**
 * Default stepper row: the value between a minus and a plus button, each a full touch target.
 * Screen readers get one adjustable element that carries the label and the value, so the two
 * buttons need no name of their own.
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
  const decrement = () => onChange(Math.max(min, value - step));
  const increment = () => onChange(Math.min(max, value + step));
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') increment();
    if (event.nativeEvent.actionName === 'decrement') decrement();
  };
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: valueLabel }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAccessibilityAction}
      testID={testID}
    >
      <RowLayout
        label={label}
        trailing={
          <View style={styles.stepper}>
            <StepButton
              symbol={DECREMENT_SYMBOL}
              disabled={value <= min}
              onPress={decrement}
              testID={testID === undefined ? undefined : `${testID}-decrement`}
            />
            <AppText align="center">{valueLabel}</AppText>
            <StepButton
              symbol={INCREMENT_SYMBOL}
              disabled={value >= max}
              onPress={increment}
              testID={testID === undefined ? undefined : `${testID}-increment`}
            />
          </View>
        }
      />
    </View>
  );
}

interface StepButtonProps {
  symbol: IconSymbol;
  disabled: boolean;
  onPress: () => void;
  testID?: string;
}

function StepButton({ symbol, disabled, onPress, testID }: StepButtonProps) {
  const colors = useColors();
  return (
    <Pressable
      accessible={false}
      android_ripple={{ color: colors.fill, borderless: true }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.stepButton,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Icon symbol={symbol} color="accent" />
    </Pressable>
  );
}

/**
 * Default choice row: the options as a group of radio rows under the name of the setting, the
 * Material way to choose one value among a few.
 */
export function ChoiceRow<Value extends string>({
  label,
  options,
  value,
  onChange,
  testID,
}: ChoiceRowProps<Value>) {
  const colors = useColors();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} testID={testID}>
      <RowLayout label={label} />
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: isSelected }}
            android_ripple={{ color: colors.fill }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
          >
            <Icon
              symbol={isSelected ? SELECTED_SYMBOL : UNSELECTED_SYMBOL}
              color={isSelected ? 'accent' : 'secondaryLabel'}
            />
            <AppText style={styles.optionLabel}>{option.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The time as the device writes it, like the system pickers do (pickers.md). */
function formatTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

/**
 * Default time row: the time as a value; pressing the row opens the platform's time picker
 * (Material's dialog on Android). The web has no such dialog in Expo UI: there the row only
 * shows the time.
 */
export function TimePickerRow({ label, value, onChange, testID }: TimePickerRowProps) {
  const colors = useColors();
  const [isPickerOpen, setPickerOpen] = useState(false);
  const date = timeOfDayToDate(value);
  const formattedTime = formatTime(date);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: formattedTime }}
        android_ripple={{ color: colors.fill }}
        onPress={() => setPickerOpen(true)}
        testID={testID}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <RowLayout label={label} trailing={<AppText color="accent">{formattedTime}</AppText>} />
      </Pressable>
      {isPickerOpen ? (
        <DateTimePicker
          mode="time"
          presentation="dialog"
          value={date}
          onValueChange={(_event, selected) => {
            setPickerOpen(false);
            onChange(dateToTimeOfDay(selected));
          }}
          onDismiss={() => setPickerOpen(false)}
          testID={testID === undefined ? undefined : `${testID}-picker`}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepButton: {
    minWidth: layout.touchTarget,
    minHeight: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  option: {
    minHeight: layout.touchTarget,
    paddingHorizontal: layout.screenMargin,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  optionLabel: { flexShrink: 1 },
  pressed: { opacity: stateOpacity.pressed },
  disabled: { opacity: stateOpacity.disabled },
});
