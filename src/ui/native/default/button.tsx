import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/app-text';
import { layout, radius, spacing, stateOpacity, type TextColorRole } from '../../tokens';
import { useColors } from '../../use-colors';
import type { ButtonProps, ButtonVariant } from '../types';
import { assertButtonRole } from '../validation';

/** Material's three emphases: filled, outlined and text buttons. */
const LABEL_COLOR = {
  primary: 'onAccent',
  secondary: 'accent',
  plain: 'accent',
} as const satisfies Record<ButtonVariant, TextColorRole>;

/**
 * Default button, for Android, the web and tests. It follows Material's conventions rather than
 * imitating iOS: a filled container for the main action, an outline or bare text for the others,
 * the platform's ripple as press state, and a target of 48 dp on Android. A destructive button
 * is outlined or bare, in red.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  role,
  disabled = false,
  fullWidth = false,
  testID,
}: ButtonProps) {
  assertButtonRole({ variant, role });
  const colors = useColors();
  const labelColor = role === 'destructive' ? 'destructive' : LABEL_COLOR[variant];
  return (
    <View style={fullWidth ? styles.fullWidth : styles.hugging}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        android_ripple={{ color: colors.fill }}
        disabled={disabled}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [
          styles.button,
          variant === 'primary' && { backgroundColor: colors.accent },
          variant === 'secondary' && [styles.outlined, { borderColor: colors[labelColor] }],
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <AppText variant="headline" color={labelColor} align="center">
          {label}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Same placement as the iOS host: the button hugs its label where its parent puts it, at the
  // start by default, or spans the width.
  hugging: { alignItems: 'flex-start' },
  fullWidth: { alignSelf: 'stretch' },
  button: {
    minHeight: layout.touchTarget,
    minWidth: layout.touchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  outlined: { borderWidth: layout.outlineWidth },
  pressed: { opacity: stateOpacity.pressed },
  disabled: { opacity: stateOpacity.disabled },
});
