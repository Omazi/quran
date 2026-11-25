import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import type { ColorRole } from '../tokens';
import { useColors, useReaderPalette } from '../use-colors';

/**
 * `background` for an ordinary screen, `groupedBackground` when the screen shows a grouped list
 * (color.md › Mobile), `paper` for the mushaf page only, `readerCanvas` for the warm ground of the
 * validated mockups around the page and in the Quran tab (tokens `readerPalette`, deviation 80),
 * `canvas` for the warm ground of the home screen's palette (`gardenPalette`) under a list of the
 * garden appearance (the settings).
 */
export type ScreenBackground =
  Extract<ColorRole, 'background' | 'groupedBackground' | 'paper' | 'canvas'> | 'readerCanvas';

export interface ScreenProps {
  children: ReactNode;
  background?: ScreenBackground;
  /**
   * Safe-area edges to keep clear (layout.md › Guides and safe areas). Defaults to all four, or
   * to the two sides on iOS when the screen scrolls.
   */
  edges?: readonly Edge[];
  /**
   * Lets the content scroll vertically, so that it stays reachable at the largest text sizes
   * (layout.md › Adaptability). On iOS the content then passes under the bars, which keep their
   * material and scroll edge effect, and rests clear of them (layout.md › Visual hierarchy).
   * Leave it off when the content scrolls by itself, as a grouped list does.
   */
  scroll?: boolean;
  testID?: string;
}

const ALL_EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left'];
const SIDE_EDGES: readonly Edge[] = ['right', 'left'];

/** Root of every screen: the system background and the safe areas. */
export function Screen({
  children,
  background = 'background',
  edges,
  scroll = false,
  testID,
}: ScreenProps) {
  const colors = useColors();
  const palette = useReaderPalette();
  const backgroundColor = background === 'readerCanvas' ? palette.canvas : colors[background];
  // Only iOS can inset a scroll view for the bars by itself; elsewhere the safe area does it.
  const scrollsUnderBars = scroll && Platform.OS === 'ios';
  return (
    <SafeAreaView
      edges={edges ?? (scrollsUnderBars ? SIDE_EDGES : ALL_EDGES)}
      style={[styles.screen, { backgroundColor }]}
      testID={testID}
    >
      {scroll ? (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.scrollContent}
        >
          {children}
        </ScrollView>
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
