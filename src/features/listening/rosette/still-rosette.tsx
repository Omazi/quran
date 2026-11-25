import { StyleSheet, View } from 'react-native';
import Svg, { Defs, FeGaussianBlur, Filter, G, Path } from 'react-native-svg';

import { ROSETTE_GEOMETRY, ROSETTE_MOTION, ROSETTE_OPACITY, SETTLED_ROSETTE } from '../config';
import { insidePath, petalPath, starPath } from './rosette-geometry';
import { isGoldSlot, lineOpacities, petalAppearance, type PetalAppearance } from './rosette-motion';
import { useRosetteColors } from './use-rosette-colors';

export interface StillRosetteProps {
  /** Radius of the outer star, in points. */
  radius: number;
  testID?: string;
}

/** The two settled petals, computed once from the motion of the prototype. */
const SETTLED_PETALS: readonly PetalAppearance[] = SETTLED_ROSETTE.petalAges.map((age) =>
  petalAppearance(
    { bornAt: 0, power: ROSETTE_MOTION.silentPetalPower },
    age * ROSETTE_MOTION.petalLife,
  ),
);

/** How far the drawing reaches past the outer star: the larger petal, and the light at night. */
const REACH = Math.max(...SETTLED_PETALS.map((petal) => petal.scale));

/**
 * The rosette once the listening is over: the same stars, still, at their silent light, with the
 * two petals a quiet rosette shows (`SETTLED_ROSETTE`). Nothing moves, so there is nothing for
 * Reduce Motion to stop. It is the bridge between the listening and its result: the screen keeps
 * its ornament and stops breathing.
 *
 * Drawn once with `react-native-svg`, in a square box centred on the star. Decorative: screen
 * readers never reach it.
 */
export function StillRosette({ radius, testID }: StillRosetteProps) {
  const colors = useRosetteColors();
  const isNight = colors.appearance === 'dark';
  const opacity = lineOpacities(0, 0, colors.appearance, true);
  // The night light spreads about three blur radii; it shrinks with the rosette.
  const blur = ROSETTE_OPACITY.dark.glowBlur * Math.min(1, radius / LIGHT_REFERENCE_RADIUS);
  const half = radius * REACH + blur * 3;
  const side = 2 * half;
  return (
    <View
      style={[styles.box, { width: side, height: side }]}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      <Svg width={side} height={side}>
        {isNight ? (
          <>
            <Defs>
              <Filter
                id="still-rosette-glow"
                filterUnits="userSpaceOnUse"
                x={0}
                y={0}
                width={side}
                height={side}
              >
                <FeGaussianBlur stdDeviation={blur} />
              </Filter>
            </Defs>
            <G
              filter="url(#still-rosette-glow)"
              fill="none"
              stroke={colors.water}
              strokeLinejoin="round"
              opacity={opacity.glow}
            >
              <Path
                d={starPath(half, half, radius * ROSETTE_GEOMETRY.inner)}
                strokeWidth={ROSETTE_OPACITY.dark.heartGlowWidth}
              />
              <Path
                d={starPath(half, half, radius)}
                strokeWidth={ROSETTE_OPACITY.dark.outerGlowWidth}
              />
            </G>
          </>
        ) : null}
        {SETTLED_PETALS.map((petal, index) => (
          <Path
            key={index}
            d={petalPath(half, half, radius * petal.scale, petal.roundness)}
            fill="none"
            stroke={isGoldSlot(index) ? colors.gold : colors.water}
            strokeOpacity={petal.opacity}
            strokeWidth={petal.width}
            strokeLinejoin="round"
          />
        ))}
        <Path
          d={insidePath(half, half, radius)}
          fill="none"
          stroke={colors.gold}
          strokeOpacity={opacity.inside}
          strokeWidth={ROSETTE_GEOMETRY.insideWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d={starPath(half, half, radius)}
          fill="none"
          stroke={colors.water}
          strokeOpacity={opacity.outer}
          strokeWidth={ROSETTE_GEOMETRY.outerWidth}
          strokeLinejoin="round"
        />
        <Path
          d={starPath(half, half, radius * ROSETTE_GEOMETRY.inner)}
          fill="none"
          stroke={colors.heart}
          strokeOpacity={opacity.heart}
          strokeWidth={ROSETTE_GEOMETRY.heartWidth}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

/** The rosette's radius on the screen the night light was drawn for. */
const LIGHT_REFERENCE_RADIUS =
  SETTLED_ROSETTE.lightReferenceScreenWidth * ROSETTE_GEOMETRY.radiusOfWidth;

const styles = StyleSheet.create({
  box: { alignSelf: 'center' },
});
