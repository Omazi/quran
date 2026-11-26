import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useColors, type ColorRole } from '@/ui';

import { ROSETTE_GEOMETRY, ROSETTE_MARK } from '../config';
import { insidePath, starPath } from './rosette-geometry';

/**
 * `tonal`: on the pale green of a quieter button ("Reconnaître" beside "Lire et arroser"): water,
 * gold and the action green, as the listening page draws it by day. `onAction`: on the deep green
 * of the card "Quel est ce passage ?": the same three lines in pale water, pale gold and white.
 */
export type RosetteMarkTone = 'tonal' | 'onAction';

const TONES: Readonly<
  Record<RosetteMarkTone, { outer: ColorRole; inside: ColorRole; heart: ColorRole }>
> = {
  tonal: { outer: 'water', inside: 'ornamentLine', heart: 'actionTint' },
  onAction: { outer: 'onActionRosette', inside: 'onActionRosetteGold', heart: 'onAction' },
};

export interface RosetteMarkProps {
  /** The side of the square it is drawn in, in points. */
  size: number;
  tone: RosetteMarkTone;
  testID?: string;
}

/**
 * The rosette of the listening page as a still mark, the sign of "recognize a passage" wherever
 * the app offers it (maquettes 2026-11-26, 3A and 3C): the outer eight-pointed star, the inside
 * lines and the heart star of `rosette-geometry.ts`, without the petals that breathe while the
 * phone listens. Nothing moves, so Reduce Motion has nothing to stop. Decorative: the words of
 * its button or card name the action, and screen readers never reach it.
 */
export function RosetteMark({ size, tone, testID }: RosetteMarkProps) {
  const colors = useColors();
  const look = TONES[tone];
  const half = size / 2;
  const radius = half * ROSETTE_MARK.radiusShare;
  const weight = ROSETTE_MARK.weight;
  return (
    <View
      style={{ width: size, height: size }}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      <Svg width={size} height={size}>
        <Path
          d={insidePath(half, half, radius)}
          fill="none"
          stroke={colors[look.inside]}
          strokeWidth={ROSETTE_MARK.insideWidth * weight}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d={starPath(half, half, radius)}
          fill="none"
          stroke={colors[look.outer]}
          strokeWidth={ROSETTE_MARK.outerWidth * weight}
          strokeLinejoin="round"
        />
        <Path
          d={starPath(half, half, radius * ROSETTE_GEOMETRY.inner)}
          fill="none"
          stroke={colors[look.heart]}
          strokeWidth={ROSETTE_MARK.heartWidth * weight}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

export interface StarHaloProps {
  /** The side of the square it is drawn in, in points. */
  size: number;
}

/**
 * Three eight-pointed stars, one inside the other, in the faint gold lines of the star pattern
 * (`patternLine`): the ornament behind the rosette of the card "Quel est ce passage ?"
 * (maquettes 2026-11-26, 3A). Geometry repeated, not an illustration; it carries no information.
 */
export function StarHalo({ size }: StarHaloProps) {
  const colors = useColors();
  const half = size / 2;
  const outer = half * ROSETTE_MARK.haloRadiusShare;
  const step = half * ROSETTE_MARK.haloStepShare;
  return (
    <View
      style={{ width: size, height: size }}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size}>
        {Array.from({ length: ROSETTE_MARK.haloStars }, (_, index) => (
          <Path
            key={index}
            d={starPath(half, half, outer - index * step)}
            fill="none"
            stroke={colors.patternLine}
            strokeWidth={ROSETTE_MARK.haloWidth}
          />
        ))}
      </Svg>
    </View>
  );
}
