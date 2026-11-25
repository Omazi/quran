import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { layout, Screen, spacing } from '@/ui';
import { appColors } from '@/ui/tokens';

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
      <View style={styles.scrollArea}>
        <ScrollView alwaysBounceVertical={false} contentContainerStyle={styles.content}>
          <StillRosette radius={LISTENING_LAYOUT.resultRosetteRadius} testID="still-rosette" />
          {children}
        </ScrollView>
        <ScrollEdgeFade />
      </View>
      <View style={styles.actions}>{actions}</View>
    </Screen>
  );
}

/**
 * A fade from transparent to paper along the bottom edge of the scrolling content, so that a line
 * is not sliced by the band of the buttons but dissolves into it. The bar of the screen is not a
 * system bar, so the system's scroll edge effect does not apply; this is its approximation for a
 * custom bar: the content fades where it meets the controls, no solid background is painted
 * beneath them (layout.md › Visual hierarchy; scroll-views.md › Scroll edge effects; deviation
 * 60). It lets touches through and is hidden from screen readers.
 */
export function ScrollEdgeFade() {
  // A gradient stop takes a plain colour string, not the system's dynamic colour: paper has one
  // value per appearance and no high-contrast variant, so the string is the same colour.
  const paper = appColors.paper[useColorScheme() === 'dark' ? 'dark' : 'light'];
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.fade}
      testID="scroll-edge-fade"
    >
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="edge" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={paper} stopOpacity={0} />
            <Stop offset="1" stopColor={paper} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#edge)" />
      </Svg>
    </View>
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
  scrollArea: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.lg,
    // Clear of the fade, so the last line rests in full view at the end of the scroll.
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  fade: { position: 'absolute', start: 0, end: 0, bottom: 0, height: spacing.xl },
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
