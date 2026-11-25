import { Pressable, StyleSheet, View } from 'react-native';

import { layout, spacing, stateOpacity } from '../tokens';
import { AppText } from './app-text';

export interface SectionHeaderProps {
  title: string;
  /** A link at the trailing end: "Tout voir". */
  action?: { readonly label: string; readonly onPress: () => void; readonly testID?: string };
  testID?: string;
}

/**
 * The title of a part of a screen, with an optional link at its end (accueil.png: "Jardins
 * voisins · Tout voir"). The title is a heading for screen readers (voiceover.md › Navigation);
 * the link is a button 44 points tall. They stack when they do not fit side by side.
 */
export function SectionHeader({ title, action, testID }: SectionHeaderProps) {
  return (
    <View style={styles.row} testID={testID}>
      <AppText variant="title2" color="heading" style={styles.title}>
        {title}
      </AppText>
      {action === undefined ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          hitSlop={spacing.sm}
          testID={action.testID}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        >
          <AppText color="actionTint">{action.label}</AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.md,
  },
  title: { flexShrink: 1 },
  link: { minHeight: layout.touchTarget, justifyContent: 'center' },
  pressed: { opacity: stateOpacity.pressed },
});
