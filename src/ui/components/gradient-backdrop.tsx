import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { BackdropName } from '../tokens';
import { useBackdropGradient } from '../use-colors';

export interface GradientBackdropProps {
  /** Which gradient of the mockups: that of a growing, thirsty, dead or complete garden. */
  name: BackdropName;
  /**
   * Points of the gradient's top colour above it: room for the status bar and for the bounce of a
   * scroll view, without stretching the gradient itself.
   */
  extendUp?: number;
  /** Size and position only. */
  style?: StyleProp<ViewStyle>;
}

/**
 * The vertical gradient behind the garden in the validated mockups (accueil.png: peach at the top,
 * misty green under the garden). A background only: screen readers skip it, touches go through.
 */
export function GradientBackdrop({ name, extendUp = 0, style }: GradientBackdropProps) {
  const stops = useBackdropGradient(name);
  const topColor = stops[0]?.[1];
  // An id per instance: two gradients on one page must not share a definition.
  const id = `backdrop-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={style}
    >
      {extendUp > 0 ? (
        <View
          style={[styles.above, { top: -extendUp, height: extendUp, backgroundColor: topColor }]}
        />
      ) : null}
      <Svg width="100%" height="100%" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            {stops.map(([offset, color]) => (
              <Stop key={offset} offset={offset} stopColor={color} stopOpacity={1} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  above: { position: 'absolute', start: 0, end: 0 },
});
