/**
 * Native controls, default entry: Android and the web. iOS has its own entry, `index.ios.ts`,
 * which Metro picks by its file name. Both must export the same names.
 */

import * as defaultControls from './default';
import type { NativeControls } from './types';

// The annotation is the check: an implementation that drifts from the shared props fails to compile.
const controls: NativeControls = defaultControls;

export const {
  Button,
  ButtonRow,
  ChoiceRow,
  ContentRow,
  ContentUnavailable,
  DetailRow,
  Gauge,
  GroupedList,
  Icon,
  LabelRow,
  ListRow,
  ListSection,
  Pager,
  ProgressIndicator,
  SegmentedChoice,
  StepperRow,
  SwitchRow,
  TextFieldRow,
  TimePickerRow,
} = controls;

export { PageIndicator } from './page-indicator';
export type * from './types';
