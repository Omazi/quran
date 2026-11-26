import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '../native';
import type { IconSymbol } from '../native/types';
import {
  layout,
  pieceSizes,
  radius,
  spacing,
  stateOpacity,
  type PaletteRole,
  type TextColorRole,
} from '../tokens';
import { useColors } from '../use-colors';
import { AppText } from './app-text';

/**
 * `filled`: the main action, forest green (one per screen, two at most). `tonal`: a quieter action
 * beside it, pale green ("Partager", "Encourager"). `outline`: a white capsule with a thin border
 * ("Continuer avec Google"). `contrast`: black by day, white at night ("Continuer avec Apple").
 * `plain`: green words ("Tout voir", "Ajouter"). `destructive`: red words (removing, blocking).
 */
export type ActionButtonVariant =
  'filled' | 'tonal' | 'outline' | 'contrast' | 'plain' | 'destructive';

export interface ActionButtonProps {
  /** Says what the button does, starting with a verb. Omit only for a button with a symbol. */
  label?: string;
  /** A symbol before the label ("Lire et arroser" has a drop), or alone. */
  symbol?: IconSymbol;
  /**
   * A small drawing before the label, in place of a symbol, when the app has its own mark for
   * the action ("Reconnaître" and its rosette). Decorative: VoiceOver reads the label.
   */
  leading?: ReactNode;
  variant?: ActionButtonVariant;
  /** What VoiceOver says. Required for a button that shows only a symbol. */
  accessibilityLabel?: string;
  /** What happens, when the label does not say it (voiceover.md › Hints). */
  accessibilityHint?: string;
  onPress: () => void;
  /** Spans the width it is given, or takes the room its content needs. Defaults to true. */
  fullWidth?: boolean;
  /** Shares a row with other buttons at the same width (flex 1). */
  grows?: boolean;
  disabled?: boolean;
  /**
   * A done state ("Encouragé aujourd'hui"): disabled, but drawn at full strength, because its
   * label says what was done. Other disabled buttons are dimmed.
   */
  isDone?: boolean;
  testID?: string;
}

const LOOK: Readonly<
  Record<
    ActionButtonVariant,
    { background?: PaletteRole; foreground: TextColorRole; border?: PaletteRole }
  >
> = {
  filled: { background: 'action', foreground: 'onAction' },
  tonal: { background: 'actionTonal', foreground: 'actionTint' },
  outline: { background: 'surface', foreground: 'label', border: 'outline' },
  contrast: { background: 'contrastButton', foreground: 'onContrastButton' },
  plain: { foreground: 'actionTint' },
  destructive: { foreground: 'destructiveText' },
};

/**
 * The capsule button of the validated mockups ("Lire et arroser", "Voir dans mon jardin",
 * "Nouvelle khatma", "Lire avec elle"): drawn here rather than by the system, so that it has their
 * forest green and their shape (SKILLS.md, deviation 70). It keeps what the system button gives:
 * a press state (buttons.md › Best practices), at least 44 points of height, a label that wraps
 * at large text sizes rather than being cut, a disabled state VoiceOver hears, and one prominent
 * button per screen, two at most (buttons.md › Style). Words alone (`plain`, `destructive`) have
 * no capsule and keep a 44-point target (accessibility.md › Mobility).
 */
export function ActionButton({
  label,
  symbol,
  leading,
  variant = 'filled',
  accessibilityLabel,
  accessibilityHint,
  onPress,
  fullWidth = true,
  grows = false,
  disabled = false,
  isDone = false,
  testID,
}: ActionButtonProps) {
  if (label === undefined && accessibilityLabel === undefined) {
    throw new TypeError(
      'ActionButton: a button that shows only a symbol needs a label for VoiceOver',
    );
  }
  const colors = useColors();
  const look = LOOK[variant];
  const isWords = look.background === undefined;
  return (
    <View style={[fullWidth ? styles.fullWidth : styles.hugging, grows ? styles.grows : null]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: disabled || isDone }}
        disabled={disabled || isDone}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [
          styles.button,
          isWords ? styles.words : styles.capsule,
          // Sharing a row, a capsule keeps its label on one line as long as it can.
          grows && !isWords ? styles.capsuleInRow : null,
          label === undefined ? styles.iconOnly : null,
          look.background === undefined ? null : { backgroundColor: colors[look.background] },
          look.border === undefined
            ? null
            : { borderColor: colors[look.border], borderWidth: layout.outlineWidth },
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        {symbol === undefined ? null : (
          <Icon symbol={symbol} textStyle="headline" color={look.foreground} />
        )}
        {leading === undefined ? null : (
          <View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {leading}
          </View>
        )}
        {label === undefined ? null : (
          <AppText variant="headline" color={look.foreground} align="center" style={styles.label}>
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
  grows: { flexGrow: 1, flexBasis: 0 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: spacing.sm,
  },
  capsule: {
    minHeight: pieceSizes.actionHeight,
    minWidth: pieceSizes.actionHeight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  capsuleInRow: { paddingHorizontal: spacing.sm },
  words: {
    minHeight: layout.touchTarget,
    minWidth: layout.touchTarget,
    paddingHorizontal: spacing.sm,
  },
  iconOnly: { paddingHorizontal: spacing.none },
  label: { flexShrink: 1 },
  pressed: { opacity: stateOpacity.pressed },
  disabled: { opacity: stateOpacity.disabled },
});
