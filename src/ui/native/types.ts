/**
 * Props of the native controls. Each control has two implementations with these same props:
 * `ios/` shows the system component (SwiftUI, through Expo UI) and `default/` follows Android's
 * conventions for Android, the web and tests. Labels always come from the caller: no control
 * contains a visible string of its own.
 */

import type { ReactElement, ReactNode } from 'react';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

import type { ColorRole, TextStyleName } from '../tokens';

/** An icon by its name in each platform's own set: SF Symbols, Material Symbols. */
export interface IconSymbol {
  readonly ios: SFSymbol;
  readonly android: AndroidSymbol;
}

// --- Button -----------------------------------------------------------------------------------

/**
 * `primary`: the most likely action of the screen, in the system's prominent style. One per
 * screen, two at most. `secondary`: bordered. `plain`: borderless.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'plain';

export interface ButtonProps {
  /** Says what the button does, starting with a verb. */
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Spans the width of its container instead of hugging its label. */
  fullWidth?: boolean;
  testID?: string;
}

// --- Grouped list -----------------------------------------------------------------------------

export interface GroupedListProps {
  /** `ListSection` elements. */
  children: ReactNode;
  testID?: string;
}

export interface ListSectionProps {
  /** Header of the section. */
  title?: string;
  /** Explanation shown under the section. */
  footer?: string;
  /** Rows: `ListRow`, `SwitchRow`, `StepperRow`, `ChoiceRow`, `TimePickerRow`, or a control. */
  children: ReactNode;
}

export interface ListRowProps {
  label: string;
  /** Short value shown at the trailing side. */
  value?: string;
  /** Makes the row open something: it then shows that it can be pressed. */
  onPress?: () => void;
  testID?: string;
}

export interface SwitchRowProps {
  /** Names what is turned on or off. */
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
}

export interface StepperRowProps {
  /** Names the value being changed. */
  label: string;
  value: number;
  /** The value as people read it ("5 pages"): a stepper shows no value by itself. */
  valueLabel: string;
  min: number;
  max: number;
  /** Defaults to 1. */
  step?: number;
  onChange: (value: number) => void;
  testID?: string;
}

export interface ChoiceOption<Value extends string> {
  readonly value: Value;
  readonly label: string;
}

export interface ChoiceRowProps<Value extends string> {
  /** Names the setting, so that the options can be guessed without opening it. */
  label: string;
  /** A few mutually exclusive options. */
  options: readonly ChoiceOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  testID?: string;
}

/** A time of day on a 24-hour clock, in the device's time zone. */
export interface TimeOfDay {
  /** 0 to 23. */
  readonly hour: number;
  /** 0 to 59. */
  readonly minute: number;
}

export interface TimePickerRowProps {
  label: string;
  value: TimeOfDay;
  onChange: (value: TimeOfDay) => void;
  testID?: string;
}

// --- Status -----------------------------------------------------------------------------------

/** The colour of a status indicator: water, a healthy garden, or thirst. */
export type StatusTone = Extract<ColorRole, 'accent' | 'growth' | 'warning'>;

export interface ProgressIndicatorProps {
  /**
   * Progress of a task between 0 and 1: a bar. Omitted when the duration is unknown: a spinner.
   * For a level that lasts (health, capacity), use `Gauge`.
   */
  value?: number;
  /** Names the task for screen readers. */
  accessibilityLabel: string;
  testID?: string;
}

export interface GaugeProps {
  /** Current value, between 0 and 1. */
  value: number;
  /** What the gauge measures. */
  label: string;
  /** The current value as people read it. */
  valueLabel: string;
  /** What the low end of the range means. */
  minimumLabel?: string;
  /** What the high end of the range means. */
  maximumLabel?: string;
  /** Defaults to `accent`. Never the only signal: `label` and `valueLabel` say the same. */
  tone?: StatusTone;
  testID?: string;
}

// --- Icon -------------------------------------------------------------------------------------

/** The text styles an icon can sit next to. */
export type IconTextStyle = Exclude<TextStyleName, 'largeTitle' | 'title2'>;

export interface IconProps {
  symbol: IconSymbol;
  /** The text style of the neighbouring text: the icon takes its size and weight. */
  textStyle?: IconTextStyle;
  /** Defaults to the primary label colour. */
  color?: ColorRole;
  /** What the icon means. Omit it for an icon that only decorates a text that says the same. */
  accessibilityLabel?: string;
  testID?: string;
}

// --- Page indicator ---------------------------------------------------------------------------

export interface PageIndicatorProps {
  /** Number of pages. */
  count: number;
  /** Zero-based index of the current page. */
  index: number;
  /** Called when a person asks for another page through the indicator. */
  onChange: (index: number) => void;
  /** Names the indicator for screen readers. */
  accessibilityLabel: string;
  /** The position as people hear it: "Page 3 sur 16". */
  accessibilityValue: string;
  testID?: string;
}

// --- Empty state ------------------------------------------------------------------------------

export interface ContentUnavailableProps {
  /** Short reason why there is nothing to show. */
  title: string;
  /** What to expect or do next. */
  description?: string;
  symbol: IconSymbol;
  testID?: string;
}

// --- The set of controls ----------------------------------------------------------------------

/** What each implementation must export: the same components, with the same props. */
export interface NativeControls {
  Button: (props: ButtonProps) => ReactElement;
  GroupedList: (props: GroupedListProps) => ReactElement;
  ListSection: (props: ListSectionProps) => ReactElement;
  ListRow: (props: ListRowProps) => ReactElement;
  SwitchRow: (props: SwitchRowProps) => ReactElement;
  StepperRow: (props: StepperRowProps) => ReactElement;
  ChoiceRow: <Value extends string>(props: ChoiceRowProps<Value>) => ReactElement;
  TimePickerRow: (props: TimePickerRowProps) => ReactElement;
  ProgressIndicator: (props: ProgressIndicatorProps) => ReactElement;
  Gauge: (props: GaugeProps) => ReactElement;
  ContentUnavailable: (props: ContentUnavailableProps) => ReactElement;
}
