import { Button as SwiftUIButton, Text } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  contentShape,
  controlSize,
  disabled as disabledModifier,
  foregroundStyle,
  frame,
  shapes,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { layout } from '../../tokens';
import { useColors } from '../../use-colors';
import type { ButtonProps, ButtonVariant } from '../types';
import { SwiftUIHost, useIsInsideSwiftUI } from './swiftui-host';

/** The system's button styles. Only `primary` has a coloured background (buttons.md › Style). */
const SYSTEM_STYLE = {
  primary: 'borderedProminent',
  secondary: 'bordered',
  plain: 'borderless',
} as const satisfies Record<ButtonVariant, string>;

/**
 * The system button. The app's accent is its tint: the background of the prominent style, the
 * label of the two others. The large control size keeps the bordered styles above 44 points; the
 * borderless one gets a label frame of that height (buttons.md › Best practices). In a list, a
 * plain button keeps the list's own style: the whole row is the button.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  fullWidth = false,
  testID,
}: ButtonProps) {
  const colors = useColors();
  const isListAction = useIsInsideSwiftUI() && variant === 'plain';
  // The system draws a white label on the prominent style in both appearances. On the light
  // accent of the dark appearance that is 1.96:1, so the label takes the charter's `onAccent`.
  // A disabled button keeps the system's own dimmed colours.
  const labelColor = variant === 'primary' && !disabled ? [foregroundStyle(colors.onAccent)] : [];
  const labelWidth = fullWidth ? [frame({ maxWidth: Infinity })] : [];
  const labelHeight =
    variant === 'plain' && !isListAction
      ? [frame({ minHeight: layout.touchTarget }), contentShape(shapes.rectangle())]
      : [];
  const systemStyle = isListAction
    ? []
    : [buttonStyle(SYSTEM_STYLE[variant]), controlSize('large')];
  return (
    <SwiftUIHost size={fullWidth ? 'contentHeight' : 'content'}>
      <SwiftUIButton
        onPress={onPress}
        testID={testID}
        modifiers={[...systemStyle, tint(colors.accent), disabledModifier(disabled)]}
      >
        <Text modifiers={[...labelColor, ...labelWidth, ...labelHeight]}>{label}</Text>
      </SwiftUIButton>
    </SwiftUIHost>
  );
}
