import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { radius as radii } from '../tokens';
import { useElevation } from '../use-colors';
import { GlassBackdrop } from './glass-backdrop';

export interface GlassSurfaceProps extends Pick<ViewProps, 'accessible' | 'accessibilityLabel'> {
  /** The appearance of the glass and of what is on it: the night values over a night sky. */
  appearance: 'light' | 'dark';
  /** `capsule`: a chip over the sky; `panel`: the panel at the bottom of the home garden. */
  shape: 'capsule' | 'panel';
  /**
   * The opacity of the tint where the app draws the glass itself, chosen for the contrast of the
   * words on it over the sky of the hour (`glassVeilMinimum`).
   */
  veil: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A piece that floats over the home garden, on glass (maquette-wow, validated 27 November 2026;
 * liquid-glass.md › Where the material belongs: the functional layer over content). The glass is
 * the system's where it exists (`GlassBackdrop`), the app's elsewhere. It never takes the touches
 * of what is under it, and adds no hit area: its children keep their own 44-point targets.
 */
export function GlassSurface({
  appearance,
  shape,
  veil,
  children,
  style,
  testID,
  ...accessibility
}: GlassSurfaceProps) {
  const shadow = useElevation('glass');
  const cornerRadius = shape === 'panel' ? radii.glassPanel : radii.full;
  return (
    <View
      style={[styles.surface, { borderRadius: cornerRadius, boxShadow: shadow }, style]}
      testID={testID}
      {...accessibility}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <GlassBackdrop appearance={appearance} radius={cornerRadius} veil={veil} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { position: 'relative' },
});
