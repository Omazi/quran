import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useColorValues } from '../use-colors';
import { veilColor } from './glass-rim';

export interface SkyGradientProps {
  /** The sky of the hour, top to bottom (`skyStateAt`): plain `#rrggbb` values. */
  top: string;
  mid: string;
  low: string;
  bottom: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The sky behind the home garden (maquette-wow `.sky-grad`): its gradient at 0, 46, 82 and 100 %.
 * A background only: screen readers skip it, touches go through.
 */
export function SkyGradient({ top, mid, low, bottom, style }: SkyGradientProps) {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: low,
          backgroundImage: `linear-gradient(180deg, ${top} 0%, ${mid} 46%, ${low} 82%, ${bottom} 100%)`,
        },
        style,
      ]}
    />
  );
}

export interface ScrollEdgeVeilProps {
  appearance: 'light' | 'dark';
  /** The opacity of the veil at the top; 0 draws nothing. */
  opacity: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A soft veil of the glass's tint at the top of the screen, fading to nothing, behind the status
 * bar and the title: the scroll edge effect of status-bars.md › Best practices, made only as thick
 * as the sky of the hour needs for the words on it to be read.
 */
export function ScrollEdgeVeil({ appearance, opacity, style }: ScrollEdgeVeilProps) {
  const colors = useColorValues(appearance);
  if (opacity <= 0) return null;
  const solid = veilColor(colors.glassVeil, opacity);
  const clear = veilColor(colors.glassVeil, 0);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        { backgroundImage: `linear-gradient(180deg, ${solid} 0%, ${solid} 62%, ${clear} 100%)` },
        style,
      ]}
    />
  );
}
