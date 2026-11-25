import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { layout, Screen, spacing } from '@/ui';

import { LISTENING_LAYOUT } from '../config';
import { StillRosette } from '../rosette/still-rosette';

export interface ResultLayoutProps {
  /** The result: its title and what it shows. */
  children: ReactNode;
  /** The buttons, kept at the bottom of the screen where "Arrêter" was. */
  actions: ReactNode;
  testID: string;
}

/**
 * A result that has something to show (a passage, several places). It stays in the world of the
 * listening screen (D27): the paper of the mushaf, the rosette, now small and still, above the
 * result, and the buttons at the bottom, where "Arrêter" was. The result is centred in the space
 * between them and scrolls at the largest text sizes, so nothing is cut
 * (layout.md › Adaptability); the buttons stay in view.
 */
export function ResultLayout({ children, actions, testID }: ResultLayoutProps) {
  return (
    <Screen background="paper" testID={testID}>
      <ScrollView alwaysBounceVertical={false} contentContainerStyle={styles.content}>
        <StillRosette radius={LISTENING_LAYOUT.resultRosetteRadius} testID="still-rosette" />
        {children}
      </ScrollView>
      <View style={styles.actions}>{actions}</View>
    </Screen>
  );
}

export interface ResultActionsProps {
  /** The one prominent button, when the result has a most likely next step. */
  primary?: ReactNode;
  /** Plain buttons, side by side; they stack when they do not fit. */
  plain: ReactNode;
}

/**
 * The buttons of a result, centred as "Arrêter" is: the most likely action in the prominent
 * style, alone on its line, then the plain ones (buttons.md › Style: style, not size, tells the
 * preferred choice; one prominent button per view).
 */
export function ResultActions({ primary, plain }: ResultActionsProps) {
  return (
    <View style={styles.actionStack}>
      {primary}
      <View style={styles.plainRow}>{plain}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.screenMargin,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  actions: { paddingHorizontal: layout.screenMargin, paddingBottom: spacing.md },
  actionStack: { alignItems: 'center', gap: layout.controlGap },
  plainRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: spacing.lg,
    rowGap: layout.controlGap,
  },
});
