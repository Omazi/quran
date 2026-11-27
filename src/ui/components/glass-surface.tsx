import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppearance } from '../appearance';
import { useReducedTransparency } from '../device-settings';
import { useColors, useElevation } from '../use-colors';

export interface GlassSurfaceProps {
  /** The corner radius: half the height for a capsule or a round button. */
  radius: number;
  /** Layout only (size, padding, direction). The look is the glass's. */
  style?: StyleProp<ViewStyle>;
  /** A control the person touches: the system's glass then answers the touch. */
  isInteractive?: boolean;
  children?: ReactNode;
  testID?: string;
}

/**
 * Whether the system's Liquid Glass can be drawn: iOS 26 and later, and its API really there (some
 * iOS 26 betas lack it and crash: expo-glass-effect, "Known issues").
 */
function systemGlassIsAvailable(): boolean {
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    // No native module (tests, a platform without it): the drawn glass.
    return false;
  }
}

/**
 * The material of a control that floats over content (liquid-glass.md › Where the material
 * belongs: the functional layer only, never the content). On iOS 26 it is the system's Liquid
 * Glass, regular variant, the one for anything over text (› Which variant), in the appearance of
 * the screen. Elsewhere it is drawn as Apple's translation for other stacks says (› Cross-platform
 * translation): a translucent fill, a bright hairline rim and a soft shadow, with no blur, which
 * React Native does not draw, so the fill is more opaque. With Reduce Transparency the drawn glass
 * is opaque (› Review checklist, 5); the system's glass adapts by itself.
 */
export function GlassSurface({
  radius,
  style,
  isInteractive = false,
  children,
  testID,
}: GlassSurfaceProps) {
  const colors = useColors();
  const appearance = useAppearance();
  const shadow = useElevation('glass');
  const isTransparencyReduced = useReducedTransparency();
  const hasSystemGlass = systemGlassIsAvailable();
  const shape = { borderRadius: radius };
  return (
    <View style={[shape, style]} testID={testID}>
      {hasSystemGlass ? (
        <GlassView
          glassEffectStyle="regular"
          colorScheme={appearance}
          isInteractive={isInteractive}
          style={[StyleSheet.absoluteFill, shape]}
        />
      ) : (
        <View
          pointerEvents="none"
          testID={testID === undefined ? undefined : `${testID}-glass`}
          style={[
            StyleSheet.absoluteFill,
            shape,
            styles.drawn,
            {
              backgroundColor: isTransparencyReduced ? colors.glassFillOpaque : colors.glassFill,
              borderColor: colors.glassEdge,
              boxShadow: shadow,
            },
          ]}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  drawn: { borderWidth: StyleSheet.hairlineWidth },
});
