/**
 * Props of the native controls. Each control has two implementations with these same props:
 * `ios/` shows the system component (SwiftUI, through Expo UI) and `default/` follows Android's
 * conventions for Android, the web and tests. Labels always come from the caller: no control
 * contains a visible string of its own.
 */

import type { ReactElement, ReactNode } from 'react';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

import type { ColorRole, IconColorRole, TextStyleName } from '../tokens';

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

/** A destructive button can destroy data: the system draws it in red (buttons.md › Role). */
export type ButtonRole = 'destructive';

export interface ButtonProps {
  /** Says what the button does, starting with a verb. */
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /**
   * Never on a `primary` button, which people may press without reading it (buttons.md › Role):
   * that combination is refused.
   */
  role?: ButtonRole;
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
  /**
   * For a section that holds only bare content (`ContentRow`): a page header, a scene. The
   * default implementation then draws no divider and no padding of its own, so that the content
   * runs into the next one. On iOS the system draws sections without either: no difference.
   */
  isBare?: boolean;
}

/**
 * The colour of the symbol of a `LabelRow`: the accent, a status (`growth`, `warning`), or the
 * grey of a symbol that says nothing more than its words.
 */
export type LabelRowTone = Extract<
  IconColorRole,
  'accent' | 'growth' | 'warning' | 'secondaryLabel'
>;

export interface LabelRowProps {
  /** The words of the row. They always stay in the primary label colour. */
  label: string;
  /** A second line under the label: one short sentence, in the secondary label colour. */
  detail?: string;
  /** Decorative: screen readers hear the words only, so the words must say everything. */
  symbol: IconSymbol;
  /**
   * Colours the symbol only, never the words. Defaults to `accent`. Never the only signal: the
   * words say what the colour says (color.md › Inclusive color).
   */
  tone?: LabelRowTone;
  testID?: string;
}

/**
 * A `Button` that is a row of a section: always as wide as the row. A `plain` one is a row among
 * the others. A `primary` or `secondary` one replaces its row, which has no background: put it
 * alone in its section.
 */
export type ButtonRowProps = Omit<ButtonProps, 'fullWidth'>;

export interface ContentRowProps {
  /**
   * React Native content: a scene, a page header. It gets the width of the row and takes the
   * height it needs, without a side margin of its own: the list gives one. It is no longer
   * inside the list: a row or a section placed here is refused, and a control gets a host of
   * its own. The row has no background: put it alone in its section.
   */
  children: ReactNode;
  /**
   * The content runs to the side edges of the screen instead of the margin of the other rows:
   * a picture that is the signature of the screen, not a row of text. Its own content then keeps
   * its margins. Use it in a `ListSection` with `isBare`. On iOS the row is as wide as the
   * system gives a row of a list, which has its own side inset (not verified on a device).
   */
  isEdgeToEdge?: boolean;
  /**
   * For content that screen readers cannot read by itself, such as a drawn scene. The row is
   * then one element with this label, and what it contains is no longer read piece by piece.
   */
  accessibilityLabel?: string;
  testID?: string;
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

export interface SegmentedChoiceProps<Value extends string> {
  /**
   * Names the choice for screen readers. It is not shown: segments with text need no
   * introductory text (segmented-controls.md › Content).
   */
  label: string;
  /**
   * Two to five closely related options, written as short nouns (segmented-controls.md ›
   * Best practices: about five at most on iPhone). Fewer than two is refused.
   */
  options: readonly ChoiceOption<Value>[];
  /** Must be one of the options. */
  value: Value;
  onChange: (value: Value) => void;
  testID?: string;
}

/**
 * How the value of a `DetailRow` is drawn. `standard`: the system's secondary text. `quran`:
 * Arabic text of the Quran (a surah name), in the Quran font and in ink, larger than the label,
 * growing with the person's text size: the character of the row.
 */
export type DetailRowValueStyle = 'standard' | 'quran';

/**
 * A row of two lines that opens something: what it is, a short detail under it, and an optional
 * value at the trailing side.
 */
export interface DetailRowProps {
  label: string;
  /** One short line under the label, in the secondary label colour. */
  detail: string;
  /** Short value shown at the trailing side. */
  value?: string;
  /** Defaults to `standard`. */
  valueStyle?: DetailRowValueStyle;
  onPress: () => void;
  testID?: string;
}

/**
 * The system's search field, inline in a list, above the rows it filters
 * (search-fields.md › Search as an inline field). It filters as the person types
 * (search-fields.md › Best practices) and has a Clear button once it holds text
 * (text-fields.md › Mobile).
 */
export interface SearchFieldRowProps {
  /** Names the field for screen readers: what it searches. */
  label: string;
  /** Says what can be searched for (search-fields.md › Best practices: placeholder text). */
  placeholder: string;
  /** The text typed, as the field reports it. The field starts empty. */
  value: string;
  onChange: (text: string) => void;
  /** Names the Clear button for screen readers. */
  clearLabel: string;
  testID?: string;
}

/**
 * A text field for a whole number, beside its label, with the number pad
 * (text-fields.md › Best practices: show the appropriate keyboard type; use a number formatter).
 * It accepts digits only; the caller validates the range and says so.
 */
export interface NumberFieldRowProps {
  /** Names the value, at the leading side of the row and for screen readers. */
  label: string;
  /** A hint shown while the field is empty, such as the range accepted. */
  placeholder: string;
  /** The digits typed, as the field reports them. The field starts empty. */
  value: string;
  onChange: (text: string) => void;
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

/** The text styles an icon can sit next to: all of them. */
export type IconTextStyle = TextStyleName;

export interface IconProps {
  symbol: IconSymbol;
  /** The text style of the neighbouring text: the icon takes its size and weight. */
  textStyle?: IconTextStyle;
  /** A foreground role. Defaults to the primary label colour. */
  color?: IconColorRole;
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
  /** The position as people hear it: "Page 3 sur 16". Without it, they hear the page number. */
  accessibilityValue?: string;
  testID?: string;
}

// --- Pager ------------------------------------------------------------------------------------

export interface PagerProps {
  /** Number of pages. */
  pageCount: number;
  /** Zero-based index of the page shown. */
  page: number;
  /** Called when the person moves to another page, by a swipe or through the page indicator. */
  onPageChange: (page: number) => void;
  /** Draws the page of the given zero-based index. */
  renderPage: (page: number) => ReactNode;
  /** Names the page indicator for screen readers, where the system does not name it itself. */
  accessibilityLabel: string;
  /** The position as people hear it, where the system does not say it itself. */
  accessibilityValue?: string;
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
  LabelRow: (props: LabelRowProps) => ReactElement;
  ButtonRow: (props: ButtonRowProps) => ReactElement;
  ContentRow: (props: ContentRowProps) => ReactElement;
  SwitchRow: (props: SwitchRowProps) => ReactElement;
  StepperRow: (props: StepperRowProps) => ReactElement;
  ChoiceRow: <Value extends string>(props: ChoiceRowProps<Value>) => ReactElement;
  TimePickerRow: (props: TimePickerRowProps) => ReactElement;
  SegmentedChoice: <Value extends string>(props: SegmentedChoiceProps<Value>) => ReactElement;
  DetailRow: (props: DetailRowProps) => ReactElement;
  SearchFieldRow: (props: SearchFieldRowProps) => ReactElement;
  NumberFieldRow: (props: NumberFieldRowProps) => ReactElement;
  ProgressIndicator: (props: ProgressIndicatorProps) => ReactElement;
  Gauge: (props: GaugeProps) => ReactElement;
  ContentUnavailable: (props: ContentUnavailableProps) => ReactElement;
  Icon: (props: IconProps) => ReactElement;
  Pager: (props: PagerProps) => ReactElement;
}
