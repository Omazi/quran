import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { readerShapes, useColors, useReaderPalette } from '@/ui';

const {
  frameOuterRule,
  frameRuleGap,
  frameInnerRule,
  frameBand,
  frameBandGap,
  frameMotifWidth,
  frameMotifHeight,
  frameMotifGap,
  frameCornerDot,
  frameTextInset,
  shadowOpacity,
  shadowRadius,
  shadowOffsetY,
} = readerShapes;

/** Distance from the outer rule's inner edge to the inner rule, above and below the text. */
const BAND_ROOM = frameRuleGap + frameBand + frameBandGap;
const CORNERS = ['top-start', 'top-end', 'bottom-start', 'bottom-end'] as const;

/** How many lozenges fit in a band of this width, with their gaps. */
export function motifCount(bandWidth: number): number {
  return Math.max(0, Math.floor((bandWidth + frameMotifGap) / (frameMotifWidth + frameMotifGap)));
}

export interface MushafFrameProps {
  width: number;
  height: number;
  children: ReactNode;
  /** `mushaf-page-<n>`: the frame's parts take it as a prefix. */
  testID: string;
}

/**
 * The frame of the page, as the validated mockup draws it (docs/design/mushaf.png): a golden
 * outer rule, a gap, a thin inner rule; above and below the text, between the two rules, a band
 * of small lozenges; a gold point at each inner corner; the paper inside; a soft shadow under the
 * whole page. Rules, points and a repeated lozenge only: no illustration (deviation 81 of the
 * register, against reader spec 2 "pas d'ornement dessiné en code au-delà d'un filet").
 */
export function MushafFrame({ width, height, children, testID }: MushafFrameProps) {
  const colors = useColors();
  const palette = useReaderPalette();
  const bandWidth = width - 2 * (frameOuterRule + frameRuleGap);
  const motifs = motifCount(bandWidth);
  const band = (edge: 'top' | 'bottom') => (
    <View
      testID={`${testID}-band-${edge}`}
      style={[
        styles.band,
        edge === 'top' ? styles.bandTop : styles.bandBottom,
        { backgroundColor: palette.frameBand },
      ]}
    >
      {Array.from({ length: motifs }, (_, index) => (
        <View key={index} style={[styles.motif, { backgroundColor: palette.frameOuter }]} />
      ))}
    </View>
  );
  return (
    <View
      testID={`${testID}-frame`}
      style={[
        styles.frame,
        {
          width,
          height,
          borderColor: palette.frameOuter,
          backgroundColor: colors.paper,
          shadowColor: palette.shadow,
        },
      ]}
    >
      {band('top')}
      <View
        testID={`${testID}-frame-inner`}
        style={[styles.inner, { borderColor: palette.frameInner }]}
      >
        {children}
      </View>
      {band('bottom')}
      {CORNERS.map((corner) => (
        <View
          key={corner}
          testID={`${testID}-corner`}
          style={[styles.corner, cornerPlace[corner], { backgroundColor: palette.gold }]}
        />
      ))}
    </View>
  );
}

/** A corner point sits on the corner of the inner rule, centred on the rule's line. */
const CORNER_TOP = BAND_ROOM + frameInnerRule / 2 - frameCornerDot / 2;
const CORNER_SIDE = frameRuleGap + frameInnerRule / 2 - frameCornerDot / 2;
const cornerPlace = {
  'top-start': { top: CORNER_TOP, start: CORNER_SIDE },
  'top-end': { top: CORNER_TOP, end: CORNER_SIDE },
  'bottom-start': { bottom: CORNER_TOP, start: CORNER_SIDE },
  'bottom-end': { bottom: CORNER_TOP, end: CORNER_SIDE },
} as const;

const styles = StyleSheet.create({
  frame: {
    borderWidth: frameOuterRule,
    paddingHorizontal: frameRuleGap,
    paddingVertical: BAND_ROOM,
    shadowOpacity,
    shadowRadius,
    shadowOffset: { width: 0, height: shadowOffsetY },
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: frameInnerRule,
    paddingHorizontal: frameTextInset.horizontal,
    paddingVertical: frameTextInset.vertical,
  },
  // Absolute children are placed from the inner edge of the outer rule.
  band: {
    position: 'absolute',
    start: frameRuleGap,
    end: frameRuleGap,
    height: frameBand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bandTop: { top: frameRuleGap },
  bandBottom: { bottom: frameRuleGap },
  motif: {
    width: frameMotifWidth,
    height: frameMotifHeight,
    borderRadius: frameMotifHeight / 2,
  },
  corner: {
    position: 'absolute',
    width: frameCornerDot,
    height: frameCornerDot,
    borderRadius: frameCornerDot / 2,
  },
});
