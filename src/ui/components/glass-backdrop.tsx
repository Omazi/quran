import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { useReducedTransparency } from '../device-settings';
import { useColorValues } from '../use-colors';
import type { GlassBackdropProps } from './glass-backdrop-types';
import { GlassRim, veilColor } from './glass-rim';

/**
 * The glass drawn by the app, on the web and on Android (liquid-glass.md › Cross-platform
 * translation). On the web: a blur of what is behind (`backdrop-filter`), a tint, a bright rim.
 * On Android, whose own design language has no glass, a nearly opaque surface (› React Native:
 * "prefer an opaque or lightly translucent bar there rather than imitating iOS"). Opaque with
 * Reduce Transparency.
 */
export function GlassBackdrop({ appearance, radius, veil }: GlassBackdropProps) {
  const colors = useColorValues(appearance);
  const isReduced = useReducedTransparency();
  const shape = { borderRadius: radius };
  if (isReduced) {
    return (
      <View style={[StyleSheet.absoluteFill, shape, { backgroundColor: colors.glassOpaque }]} />
    );
  }
  const isWeb = Platform.OS === 'web';
  const alpha = isWeb ? veil : Math.max(veil, ANDROID_LEAST_VEIL);
  return (
    <>
      <View
        style={[
          StyleSheet.absoluteFill,
          shape,
          { backgroundColor: veilColor(colors.glassVeil, alpha) },
          isWeb ? WEB_BLUR : null,
        ]}
      />
      <GlassRim appearance={appearance} radius={radius} />
    </>
  );
}

/** Android: the glass nearly opaque. */
const ANDROID_LEAST_VEIL = 0.92;

/**
 * The mockup's `backdrop-filter: blur(22px) saturate(175%)`. React Native's style type has no such
 * property: react-native-web passes it to CSS as it is.
 */
const WEB_BLUR = {
  backdropFilter: 'blur(22px) saturate(175%)',
  WebkitBackdropFilter: 'blur(22px) saturate(175%)',
} as unknown as ViewStyle;
