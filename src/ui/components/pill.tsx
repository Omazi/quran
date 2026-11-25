import { StyleSheet, View } from 'react-native';

import { Icon } from '../native';
import type { IconSymbol } from '../native/types';
import { layout, radius, spacing, type IconColorRole } from '../tokens';
import { useColors } from '../use-colors';
import { AppText } from './app-text';

export interface PillProps {
  symbol: IconSymbol;
  symbolColor: IconColorRole;
  /** The value shown: "12". */
  label: string;
  /** What it means, for screen readers: "12 jours de suite". */
  accessibilityLabel: string;
  testID?: string;
}

/**
 * A capsule that shows one value and its symbol (accueil.png: the flame and the streak). It is
 * read as one element, by the sentence that says what the number means.
 */
export function Pill({ symbol, symbolColor, label, accessibilityLabel, testID }: PillProps) {
  const colors = useColors();
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[styles.pill, { backgroundColor: colors.pillSurface }]}
      testID={testID}
    >
      <Icon symbol={symbol} textStyle="subheadEmphasized" color={symbolColor} />
      <AppText variant="subheadEmphasized">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
    minHeight: layout.touchTarget - spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
});
