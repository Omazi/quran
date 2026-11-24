/**
 * Native controls, iOS entry: the system components, drawn by SwiftUI through Expo UI.
 *
 * Jest also loads this file, because the Jest preset of Expo resolves modules as iOS does. But
 * there a SwiftUI view is an opaque native stub: it has no text, no role and cannot be pressed.
 * Under Jest the controls are therefore the default implementation, which tests can query the
 * way a person or a screen reader would. The SwiftUI implementation has its own tests, which
 * import `./ios` directly (src/ui/__tests__/native-ios.test.tsx).
 */

import * as defaultControls from './default';
import * as iosControls from './ios';
import type { NativeControls } from './types';

// The annotation is the check: an implementation that drifts from the shared props fails to compile.
const controls: NativeControls = process.env.NODE_ENV === 'test' ? defaultControls : iosControls;

export const {
  Button,
  ChoiceRow,
  ContentUnavailable,
  Gauge,
  GroupedList,
  ListRow,
  ListSection,
  ProgressIndicator,
  StepperRow,
  SwitchRow,
  TimePickerRow,
} = controls;

export { Icon } from './icon';
export { PageIndicator } from './page-indicator';
export type * from './types';
