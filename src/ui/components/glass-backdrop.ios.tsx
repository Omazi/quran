import { Host, RoundedRectangle } from '@expo/ui/swift-ui';
import { foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { StyleSheet, View } from 'react-native';

import { useReducedTransparency } from '../device-settings';
import { useColorValues } from '../use-colors';
import type { GlassBackdropProps } from './glass-backdrop-types';
import { GlassRim } from './glass-rim';

/**
 * Whether the system's Liquid Glass can be drawn: iOS 26 and later, with the API present (some
 * iOS 26 betas lacked it and crashed: expo-glass-effect, Known issues).
 */
function systemGlassIsAvailable(): boolean {
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
}

/**
 * The glass on iOS. From iOS 26, the system's Liquid Glass, regular variant (liquid-glass.md ›
 * Which variant: text on it), in the appearance of the sky; it handles Reduce Transparency and
 * Increase Contrast by itself. Before, the system's blur material (SwiftUI `.regularMaterial`
 * through Expo UI) under a bright rim. Opaque with Reduce Transparency.
 */
export function GlassBackdrop({ appearance, radius }: GlassBackdropProps) {
  const colors = useColorValues(appearance);
  const isReduced = useReducedTransparency();
  const shape = { borderRadius: radius };
  if (systemGlassIsAvailable()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={appearance}
        style={[StyleSheet.absoluteFill, shape]}
      />
    );
  }
  if (isReduced) {
    return (
      <View style={[StyleSheet.absoluteFill, shape, { backgroundColor: colors.glassOpaque }]} />
    );
  }
  return (
    <>
      <Host style={[StyleSheet.absoluteFill, shape]} colorScheme={appearance}>
        <RoundedRectangle
          cornerRadius={Math.min(radius, MAX_SWIFTUI_RADIUS)}
          modifiers={[foregroundStyle({ type: 'material', material: 'regular' })]}
        />
      </Host>
      <GlassRim appearance={appearance} radius={radius} />
    </>
  );
}

/** A capsule's radius (999) is clamped by SwiftUI anyway; a finite one keeps the shape exact. */
const MAX_SWIFTUI_RADIUS = 200;
