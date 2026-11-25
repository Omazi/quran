/**
 * Native controls, iOS entry: the system components, drawn by SwiftUI through Expo UI.
 *
 * Jest also loads this file, because the Jest preset of Expo resolves modules as iOS does. But
 * there a SwiftUI view is an opaque native stub: it has no text, no role and cannot be pressed.
 * Under Jest the controls are therefore the default implementation, which tests can query the
 * way a person or a screen reader would. A test can still ask for what an iPhone would be given:
 * `renderOnIOS` (src/ui/test-support) renders a tree with the SwiftUI implementation and checks
 * that every SwiftUI view has a host. The SwiftUI implementation also has its own tests
 * (src/ui/__tests__/native-ios.test.tsx).
 */

import * as defaultControls from './default';
import { switchableControls } from './implementation';
import * as iosControls from './ios';
import type { NativeControls } from './types';

// The annotation is the check: an implementation that drifts from the shared props fails to compile.
const controls: NativeControls =
  process.env.NODE_ENV === 'test' ? switchableControls(defaultControls, iosControls) : iosControls;

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
  TimePickerRow,
} = controls;

export { PageIndicator } from './page-indicator';
export type * from './types';
