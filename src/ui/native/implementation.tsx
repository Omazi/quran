/**
 * Test seam of the iOS entry (index.ios.ts). Under Jest the controls are the default
 * implementation, which tests can query by role and text. A test that wants to know what an
 * iPhone would be asked to draw wraps its tree in this context with the value `ios`:
 * `renderOnIOS` of src/ui/test-support does it. Outside Jest nothing here is used.
 */

import { createContext, useContext, type ReactElement } from 'react';

import type { ChoiceRowProps, NativeControls, SegmentedChoiceProps } from './types';

export type NativeImplementationName = 'default' | 'ios';

export const NativeImplementation = createContext<NativeImplementationName>('default');

/** Controls that pick their implementation when they render, from the context above. */
export function switchableControls(
  defaultControls: NativeControls,
  iosControls: NativeControls,
): NativeControls {
  function useControls(): NativeControls {
    return useContext(NativeImplementation) === 'ios' ? iosControls : defaultControls;
  }

  function switchable<Props extends object>(
    pick: (controls: NativeControls) => (props: Props) => ReactElement,
  ): (props: Props) => ReactElement {
    return function SwitchableControl(props: Props) {
      const Control = pick(useControls());
      return <Control {...props} />;
    };
  }

  return {
    Button: switchable((controls) => controls.Button),
    GroupedList: switchable((controls) => controls.GroupedList),
    ListSection: switchable((controls) => controls.ListSection),
    ListRow: switchable((controls) => controls.ListRow),
    LabelRow: switchable((controls) => controls.LabelRow),
    ButtonRow: switchable((controls) => controls.ButtonRow),
    ContentRow: switchable((controls) => controls.ContentRow),
    SwitchRow: switchable((controls) => controls.SwitchRow),
    StepperRow: switchable((controls) => controls.StepperRow),
    // Written out because it is generic in the type of its values.
    ChoiceRow: function SwitchableChoiceRow<Value extends string>(props: ChoiceRowProps<Value>) {
      const { ChoiceRow } = useControls();
      return <ChoiceRow {...props} />;
    },
    TimePickerRow: switchable((controls) => controls.TimePickerRow),
    SegmentedChoice: function SwitchableSegmentedChoice<Value extends string>(
      props: SegmentedChoiceProps<Value>,
    ) {
      const { SegmentedChoice } = useControls();
      return <SegmentedChoice {...props} />;
    },
    DetailRow: switchable((controls) => controls.DetailRow),
    SearchFieldRow: switchable((controls) => controls.SearchFieldRow),
    NumberFieldRow: switchable((controls) => controls.NumberFieldRow),
    TextFieldRow: switchable((controls) => controls.TextFieldRow),
    ProgressIndicator: switchable((controls) => controls.ProgressIndicator),
    Gauge: switchable((controls) => controls.Gauge),
    ContentUnavailable: switchable((controls) => controls.ContentUnavailable),
    Icon: switchable((controls) => controls.Icon),
    Pager: switchable((controls) => controls.Pager),
  };
}
