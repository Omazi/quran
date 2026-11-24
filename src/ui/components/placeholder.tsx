import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing } from '../tokens';
import { useColors } from '../use-colors';
import { AppText } from './app-text';

export interface PlaceholderProps {
  /** What the missing image will show, written on the surface: "Jardin au hizb 8". */
  name: string;
  /** What a screen reader says. Defaults to the name. */
  accessibilityLabel?: string;
  /** Size and position only. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Stands in for an image that does not exist yet: a neutral, named surface. Nothing is drawn in
 * its place (SwiftUI Design, principle 4: a clean placeholder beats a bad illustration).
 */
export function Placeholder({ name, accessibilityLabel, style, testID }: PlaceholderProps) {
  const colors = useColors();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? name}
      testID={testID}
      style={[
        style,
        styles.surface,
        { backgroundColor: colors.secondaryBackground, borderColor: colors.separator },
      ]}
    >
      <AppText variant="footnote" color="secondaryLabel" align="center">
        {name}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
