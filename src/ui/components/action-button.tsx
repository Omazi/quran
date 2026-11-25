import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '../native';
import type { IconSymbol } from '../native/types';
import { pieceSizes, radius, spacing, stateOpacity } from '../tokens';
import { useColors } from '../use-colors';
import { AppText } from './app-text';

export interface ActionButtonProps {
  /** Says what the button does, starting with a verb. Omit only for a button with a symbol. */
  label?: string;
  /** A symbol before the label ("Lire et arroser" has a drop), or alone. */
  symbol?: IconSymbol;
  /**
   * `filled`: the main action, deep green (one per screen, two at most). `tonal`: a quieter
   * action beside it, pale green ("Partager").
   */
  variant?: 'filled' | 'tonal';
  /** What VoiceOver says. Required for a button that shows only a symbol. */
  accessibilityLabel?: string;
  onPress: () => void;
  /** Shown faded and not pressable, while what it started is under way. */
  disabled?: boolean;
  /** Spans the width it is given, or takes the room its content needs. Defaults to true. */
  fullWidth?: boolean;
  testID?: string;
}

/**
 * The capsule button of the validated mockups ("Lire et arroser", "Voir dans mon jardin",
 * "Nouvelle khatma"): drawn here rather than by the system, so that it has their deep green and
 * their shape (SKILLS.md, deviation 70). It keeps what the system button gives: a press state
 * (buttons.md › Best practices), at least 44 points of height, a label that wraps at large text
 * sizes rather than being cut, and one prominent button per screen, two at most
 * (buttons.md › Style).
 */
export function ActionButton({
  label,
  symbol,
  variant = 'filled',
  accessibilityLabel,
  onPress,
  disabled = false,
  fullWidth = true,
  testID,
}: ActionButtonProps) {
  if (label === undefined && accessibilityLabel === undefined) {
    throw new TypeError(
      'ActionButton: a button that shows only a symbol needs a label for VoiceOver',
    );
  }
  const colors = useColors();
  const isFilled = variant === 'filled';
  const foreground = isFilled ? 'onAction' : 'actionTint';
  return (
    <View style={fullWidth ? styles.fullWidth : styles.hugging}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        onPress={onPress}
        disabled={disabled}
        accessibilityState={{ disabled }}
        testID={testID}
        style={({ pressed }) => [
          styles.button,
          label === undefined ? styles.iconOnly : null,
          { backgroundColor: isFilled ? colors.action : colors.actionTonal },
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        {symbol === undefined ? null : (
          <Icon symbol={symbol} textStyle="headline" color={foreground} />
        )}
        {label === undefined ? null : (
          <AppText variant="headline" color={foreground} align="center" style={styles.label}>
            {label}
          </AppText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fullWidth: { alignSelf: 'stretch' },
  hugging: { alignSelf: 'flex-start' },
  button: {
    minHeight: pieceSizes.actionHeight,
    minWidth: pieceSizes.actionHeight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: spacing.sm,
  },
  iconOnly: { paddingHorizontal: spacing.none },
  label: { flexShrink: 1 },
  pressed: { opacity: stateOpacity.pressed },
  disabled: { opacity: stateOpacity.disabled },
});
