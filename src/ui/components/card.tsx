import { StyleSheet, View, type ViewProps } from 'react-native';

import { elevation, palette, radius, spacing } from '../tokens';

/** A raised white surface grouping related content. */
export function Card({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.card, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...elevation.card,
  },
});
