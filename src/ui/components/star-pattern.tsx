import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, Pattern, Polygon, Rect } from 'react-native-svg';

import { useColorValues } from '../use-colors';

/** The tile of the pattern, in points: 54, as in the prototype (`#pz`). */
const TILE = 54;
const CENTRE = TILE / 2;
const STROKE = 0.8;
/** The eight-pointed star at the centre of a tile (the prototype's coordinates). */
const STAR =
  '27,7.56 31.61,15.86 40.75,13.25 38.14,22.39 46.44,27 38.14,31.61 40.75,40.75 31.61,38.14 ' +
  '27,46.44 22.39,38.14 13.25,40.75 15.86,31.61 7.56,27 15.86,22.39 13.25,13.25 22.39,15.86';
/** The square turned on its point inside the star, and the small circle at each corner. */
const INNER_SQUARE = 14.04;
const STAR_TIP = 7.56;
const CORNER_RING = 4.86;

export interface StarPatternProps {
  /** Size and position only. */
  style?: StyleProp<ViewStyle>;
}

/**
 * The faint tiling of eight-pointed stars on the deep green of the listening page (shazam.png,
 * the prototype's `#pz`): thin gold lines, a decoration that carries no information. Geometry
 * repeated, not an illustration (SKILLS.md, deviation 81, for the same reasoning on the mushaf's
 * frame). Screen readers skip it and touches go through.
 */
export function StarPattern({ style }: StarPatternProps) {
  const { patternLine } = useColorValues();
  // An id per instance: two patterns on one page must not share a definition.
  const id = `stars-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const line = { stroke: patternLine, strokeWidth: STROKE, fill: 'none' } as const;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={style}
    >
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id={id} width={TILE} height={TILE} patternUnits="userSpaceOnUse">
            <Polygon points={STAR} {...line} />
            <Rect
              x={CENTRE - INNER_SQUARE / 2}
              y={CENTRE - INNER_SQUARE / 2}
              width={INNER_SQUARE}
              height={INNER_SQUARE}
              transform={`rotate(45 ${CENTRE} ${CENTRE})`}
              {...line}
            />
            <Line x1={CENTRE} y1={0} x2={CENTRE} y2={STAR_TIP} {...line} />
            <Line x1={CENTRE} y1={TILE - STAR_TIP} x2={CENTRE} y2={TILE} {...line} />
            <Line x1={0} y1={CENTRE} x2={STAR_TIP} y2={CENTRE} {...line} />
            <Line x1={TILE - STAR_TIP} y1={CENTRE} x2={TILE} y2={CENTRE} {...line} />
            {[0, TILE].flatMap((x) =>
              [0, TILE].map((y) => (
                <Circle key={`${x}-${y}`} cx={x} cy={y} r={CORNER_RING} {...line} />
              )),
            )}
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
