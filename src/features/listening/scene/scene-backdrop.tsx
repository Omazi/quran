import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Pattern,
  Rect,
  Stop,
} from 'react-native-svg';

import { listeningOpacity, listeningShape, useListeningColors } from '@/ui';

const TILE = listeningShape.patternTile;
const MIDDLE = TILE / 2;
/** The star of each tile: two squares, their corners on this radius (shazam.png, measured). */
const STAR_RADIUS = TILE * 0.3;
/** The diamond inside the star, and the small circle where four tiles meet. */
const DIAMOND_RADIUS = TILE * 0.15;
const KNOT_RADIUS = TILE * 0.08;

/** A square of `radius` (centre to corner) around the middle of the tile, turned by `angle`. */
function square(radius: number, angle: number): string {
  const points = [0, 1, 2, 3].map((index) => {
    const turn = angle + (index * Math.PI) / 2;
    return `${(MIDDLE + radius * Math.sin(turn)).toFixed(2)} ${(MIDDLE - radius * Math.cos(turn)).toFixed(2)}`;
  });
  return `M${points.join(' L')} Z`;
}

const STAR = `${square(STAR_RADIUS, 0)} ${square(STAR_RADIUS, Math.PI / 4)}`;
const DIAMOND = square(DIAMOND_RADIUS, 0);

/**
 * The ground of the recognition scene (shazam.png): a deep green, lighter at the top right, and
 * over it a faint lattice of eight-pointed stars, the star that marks the quarters of a hizb in
 * the mushaf, which fades towards the bottom. An ornament: screen readers never reach it.
 */
export function SceneBackdrop() {
  const colors = useListeningColors();
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="listening-scene"
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="scene-ground" x1="1" y1="0" x2="0.25" y2="1">
            <Stop offset="0" stopColor={colors.sceneTop} />
            <Stop offset="0.45" stopColor={colors.sceneMiddle} />
            <Stop offset="1" stopColor={colors.sceneBottom} />
          </LinearGradient>
          <LinearGradient id="scene-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.3" stopColor={colors.sceneBottom} stopOpacity={0} />
            <Stop offset="0.75" stopColor={colors.sceneBottom} stopOpacity={0.85} />
            <Stop offset="1" stopColor={colors.sceneBottom} stopOpacity={1} />
          </LinearGradient>
          <Pattern id="scene-stars" patternUnits="userSpaceOnUse" width={TILE} height={TILE}>
            <G fill="none" stroke={colors.scenePattern} strokeWidth={1}>
              <Path d={STAR} strokeLinejoin="round" />
              <Path d={DIAMOND} strokeLinejoin="round" />
              {/* The star's four arms reach the next tiles; a small circle where four tiles meet. */}
              <Line x1={MIDDLE + STAR_RADIUS} y1={MIDDLE} x2={TILE} y2={MIDDLE} />
              <Line x1={0} y1={MIDDLE} x2={MIDDLE - STAR_RADIUS} y2={MIDDLE} />
              <Line x1={MIDDLE} y1={0} x2={MIDDLE} y2={MIDDLE - STAR_RADIUS} />
              <Line x1={MIDDLE} y1={MIDDLE + STAR_RADIUS} x2={MIDDLE} y2={TILE} />
              <Circle cx={0} cy={0} r={KNOT_RADIUS} />
              <Circle cx={TILE} cy={0} r={KNOT_RADIUS} />
              <Circle cx={0} cy={TILE} r={KNOT_RADIUS} />
              <Circle cx={TILE} cy={TILE} r={KNOT_RADIUS} />
            </G>
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#scene-ground)" />
        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="url(#scene-stars)"
          opacity={listeningOpacity.pattern}
        />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#scene-fade)" />
      </Svg>
    </View>
  );
}
