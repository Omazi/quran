import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import type { ColorRole } from '../tokens';
import { useColors } from '../use-colors';

/**
 * `background` for an ordinary screen, `groupedBackground` when the screen shows a grouped list
 * (color.md › Mobile), `paper` for the mushaf page only.
 */
export type ScreenBackground = Extract<ColorRole, 'background' | 'groupedBackground' | 'paper'>;

export interface ScreenProps {
  children: ReactNode;
  background?: ScreenBackground;
  /** Safe-area edges to keep clear. Defaults to all four (layout.md › Guides and safe areas). */
  edges?: readonly Edge[];
  /**
   * Lets the content scroll vertically, so that it stays reachable at the largest text sizes
   * (layout.md › Adaptability). Leave it off when the content scrolls by itself, as a grouped
   * list does.
   */
  scroll?: boolean;
  testID?: string;
}

/** Root of every screen: the system background and the safe areas. */
export function Screen({
  children,
  background = 'background',
  edges,
  scroll = false,
  testID,
}: ScreenProps) {
  const colors = useColors();
  return (
    <SafeAreaView
      edges={edges}
      style={[styles.screen, { backgroundColor: colors[background] }]}
      testID={testID}
    >
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>{children}</ScrollView>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1 },
});
