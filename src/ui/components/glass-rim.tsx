import { StyleSheet, View } from 'react-native';

import { layout } from '../tokens';
import { useColorValues } from '../use-colors';

/** `#rrggbb` at an opacity, as `rgba()`. */
export function veilColor(hex: string, alpha: number): string {
  const channel = (start: number) => parseInt(hex.slice(start, start + 2), 16);
  return `rgba(${channel(1)}, ${channel(3)}, ${channel(5)}, ${Math.min(1, Math.max(0, alpha))})`;
}

/**
 * The bright rim of drawn glass and the light on its upper edge (maquette-wow `.glass::after`,
 * `::before`). The system's Liquid Glass draws its own: this is for the glass the app draws.
 */
export function GlassRim({ appearance, radius }: { appearance: 'light' | 'dark'; radius: number }) {
  const colors = useColorValues(appearance);
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.rim,
        {
          borderRadius: radius,
          borderColor: colors.glassEdge,
          backgroundImage: `linear-gradient(180deg, ${colors.glassHighlight} 0%, rgba(255, 255, 255, 0) 42%)`,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  rim: { borderWidth: layout.outlineWidth },
});
