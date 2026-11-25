import { Button as SwiftUIButton, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel as accessibilityLabelModifier,
  buttonStyle,
  contentShape,
  controlSize,
  disabled as disabledModifier,
  font,
  foregroundStyle,
  frame,
  shapes,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { appleTextStyles, layout } from '../../tokens';
import { useColors } from '../../use-colors';
import type { ButtonProps, ButtonVariant } from '../types';
import { assertButtonRole } from '../validation';
import { SwiftUIHost, useIsInsideSwiftUI } from './swiftui-host';

/** The system's button styles. Only `primary` has a coloured background (buttons.md › Style). */
const SYSTEM_STYLE = {
  primary: 'borderedProminent',
  secondary: 'bordered',
  plain: 'borderless',
} as const satisfies Record<ButtonVariant, string>;

/**
 * The system button. The prominent style is filled with the app's action green, as the capsule
 * button is; the two others take the label colour of the host's tint. A destructive button has the system's role and its red
 * (buttons.md › Role). The large control size keeps the bordered styles above 44 points; the
 * borderless one gets a label frame of 44 by 44 (buttons.md › Best practices). In a list, a
 * plain button keeps the list's own style: the whole row is the button.
 */
export function Button({
  label,
  detail,
  accessibilityLabel,
  onPress,
  variant = 'primary',
  role,
  disabled = false,
  fullWidth = false,
  testID,
}: ButtonProps) {
  assertButtonRole({ variant, role });
  const colors = useColors();
  const isListAction = useIsInsideSwiftUI() && variant === 'plain';
  // The prominent style is filled with the action green of the capsule button (`action`), the same
  // green by day and at night, with its white label (7.85:1, 5.18:1). The host's tint stays the
  // lighter `actionTint`, which writes the label of the other styles in green, readable on the
  // dark background. A disabled or destructive button keeps the system's own colours.
  const isFilled = variant === 'primary' && !disabled && role !== 'destructive';
  const labelColor =
    disabled || role === 'destructive'
      ? []
      : [foregroundStyle(variant === 'primary' ? colors.onAction : colors.actionTint)];
  const labelWidth = fullWidth ? [frame({ maxWidth: Infinity })] : [];
  const labelTarget =
    variant === 'plain' && !isListAction
      ? [
          frame({ minWidth: layout.touchTarget, minHeight: layout.touchTarget }),
          contentShape(shapes.rectangle()),
        ]
      : [];
  const systemStyle = isListAction
    ? []
    : [buttonStyle(SYSTEM_STYLE[variant]), controlSize('large')];
  // Stated on the button itself, so that the accent inherited from the host cannot replace it.
  const roleColor =
    role === 'destructive'
      ? [tint(colors.destructive)]
      : isFilled && !isListAction
        ? [tint(colors.action)]
        : [];
  return (
    <SwiftUIHost size={fullWidth ? 'contentHeight' : 'content'}>
      <SwiftUIButton
        onPress={onPress}
        role={role}
        testID={testID}
        modifiers={[
          ...systemStyle,
          ...roleColor,
          disabledModifier(disabled),
          ...(accessibilityLabel === undefined
            ? []
            : [accessibilityLabelModifier(accessibilityLabel)]),
        ]}
      >
        {detail === undefined ? (
          <Text modifiers={[...labelColor, ...labelWidth, ...labelTarget]}>{label}</Text>
        ) : (
          // Two lines in the one label: the action, then where it leads, in the subhead size.
          <VStack modifiers={[...labelWidth]}>
            <Text modifiers={[...labelColor]}>{label}</Text>
            <Text modifiers={[font({ textStyle: appleTextStyles.subhead }), ...labelColor]}>
              {detail}
            </Text>
          </VStack>
        )}
      </SwiftUIButton>
    </SwiftUIHost>
  );
}
