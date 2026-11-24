import { StyleSheet, type ViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { palette, type ColorToken } from '../tokens';

export interface ScreenProps extends ViewProps {
  background?: ColorToken;
  /** Safe-area edges to pad. Defaults to top and bottom. */
  edges?: readonly Edge[];
}

/** Root container of every screen: background color and safe-area padding. */
export function Screen({
  background = 'surface',
  edges = ['top', 'bottom'],
  style,
  ...rest
}: ScreenProps) {
  return (
    <SafeAreaView
      {...rest}
      edges={edges}
      style={[styles.screen, { backgroundColor: palette[background] }, style]}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
