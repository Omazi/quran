import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  layout,
  pieceSizes,
  radius,
  spacing,
  stateOpacity,
  type PaletteRole,
  type SpacingToken,
} from '../tokens';
import { useColors, useElevation } from '../use-colors';

/**
 * `raised`: a white card on the canvas, with its soft shadow ("Arrosage du jour").
 * `inset`: the cream card inside a card ("Al-Kahf · Reprendre page 293"), with its thin border.
 * `thirst`: the banner of a thirsty garden (soif.png). `quiet`: a card without shadow (mort.png).
 */
export type CardTone = 'raised' | 'inset' | 'thirst' | 'quiet';

export interface CardProps {
  children: ReactNode;
  tone?: CardTone;
  /** Space inside the card. Defaults to `md`. */
  padding?: 'sm' | 'md';
  /** `sheet`: the larger corners of a card that rises from the bottom of the screen (visite.png). */
  shape?: 'card' | 'sheet';
  /** Space between the card's children, stacked. None by default. */
  contentGap?: SpacingToken;
  /** Makes the whole card one button (a friend's garden). It then needs a label. */
  onPress?: () => void;
  /** What a screen reader says for a card that is a button, or for a card read as one element. */
  accessibilityLabel?: string;
  /** Layout only: width, margins, flex. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const SURFACE: Readonly<Record<CardTone, PaletteRole>> = {
  raised: 'surface',
  inset: 'surfaceInset',
  thirst: 'thirstSurface',
  quiet: 'surface',
};

/**
 * A card of the validated mockups (docs/design/accueil.png): a rounded surface that groups what
 * belongs together. A card that is a button shows a press state (buttons.md › Best practices:
 * always include a press state for a custom button) and is at least 44 points tall.
 */
export function Card({
  children,
  tone = 'raised',
  padding = 'md',
  shape = 'card',
  contentGap,
  onPress,
  accessibilityLabel,
  style,
  testID,
}: CardProps) {
  const colors = useColors();
  const shadow = useElevation('card');
  const look: StyleProp<ViewStyle> = [
    styles.card,
    tone === 'inset' ? styles.inset : null,
    padding === 'sm' ? styles.paddingSmall : styles.paddingMedium,
    shape === 'sheet' ? styles.sheet : null,
    contentGap === undefined ? null : { rowGap: spacing[contentGap] },
    { backgroundColor: colors[SURFACE[tone]] },
    tone === 'inset' ? { borderColor: colors.surfaceInsetBorder } : null,
    tone === 'raised' ? { boxShadow: shadow } : null,
  ];
  if (onPress === undefined) {
    return (
      <View
        style={[style, look]}
        accessible={accessibilityLabel !== undefined}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        {children}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [style, look, styles.button, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, overflow: 'hidden' },
  inset: { borderRadius: radius.lg, borderWidth: layout.outlineWidth },
  sheet: { borderRadius: pieceSizes.sheetRadius },
  paddingSmall: { padding: spacing.sm },
  paddingMedium: { padding: spacing.md },
  button: { minHeight: layout.touchTarget },
  pressed: { opacity: stateOpacity.pressed },
});
