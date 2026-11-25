import { Pressable, StyleSheet, View } from 'react-native';

import { listeningShape, stateOpacity, useListeningColors, type IconSymbol } from '@/ui';

import { SceneSymbol } from './scene-symbol';

export interface RoundButtonProps {
  readonly symbol: IconSymbol;
  readonly accessibilityLabel: string;
  readonly accessibilityHint?: string;
  readonly onPress: () => void;
  /** The disc, and the symbol on it: colours of the listening palette. */
  readonly background: string;
  readonly foreground: string;
  /** Diameter of the disc; the touch area is never under 44 points (buttons.md › Best practices). */
  readonly diameter?: number;
  readonly symbolSize?: number;
  readonly isDirectional?: boolean;
  /** A soft shadow under the disc, as the buttons above the page of voix.png. */
  readonly isRaised?: boolean;
  readonly testID?: string;
}

/**
 * A round button with one symbol, as the mockups draw them: back, stop, the buttons of the card.
 * A press state (buttons.md › Best practices: always include a press state for a custom
 * button), a label for screen readers, and a touch area of 44 points at least.
 */
export function RoundButton({
  symbol,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  background,
  foreground,
  diameter = listeningShape.sceneButtonDiameter,
  symbolSize = listeningShape.buttonSymbol,
  isDirectional = false,
  isRaised = false,
  testID,
}: RoundButtonProps) {
  const { shadow } = useListeningColors();
  const hit = Math.max(diameter, listeningShape.sceneButtonHit);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.hit,
        { minWidth: hit, minHeight: hit },
        pressed && { opacity: stateOpacity.pressed },
      ]}
      testID={testID}
    >
      <View
        style={[
          styles.disc,
          isRaised && [styles.raised, { shadowColor: shadow }],
          {
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            backgroundColor: background,
          },
        ]}
      >
        <SceneSymbol
          symbol={symbol}
          size={symbolSize}
          color={foreground}
          isDirectional={isDirectional}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { alignItems: 'center', justifyContent: 'center' },
  disc: { alignItems: 'center', justifyContent: 'center' },
  // A faint shadow: the button lifts off the beige (voix.png).
  raised: {
    shadowOpacity: listeningShape.raisedShadow.opacity,
    shadowRadius: listeningShape.raisedShadow.radius,
    shadowOffset: { width: 0, height: listeningShape.raisedShadow.offsetY },
    elevation: listeningShape.raisedShadow.elevation,
  },
});
