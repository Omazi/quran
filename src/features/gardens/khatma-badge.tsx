import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Polygon, Stop, Text } from 'react-native-svg';

import { HIZB_COUNT } from '@/domain/quran';
import { previewGardenState } from '@/features/garden';
import { Icon, useColorValues, type IconSymbol } from '@/ui';

import { BADGE_BOX, progressArc, starPoints } from './badge-geometry';
import { GardenSilhouette, GardenThumb } from './garden-thumb';
import type { BadgeView } from './gardens-model';

const LOCK: IconSymbol = { ios: 'lock.fill', android: 'lock' };

/** The proportions of the badge, in its 100 × 100 box. */
const SHAPE = {
  centre: BADGE_BOX / 2,
  starRadius: 47,
  innerStarRadius: 41,
  windowRadius: 30,
  arcRadius: 34,
  coinRadius: 9.5,
  coinY: 84,
} as const;

/** The smallest share of the arc drawn for a garden in progress: a garden that has begun shows. */
const MIN_ARC = 0.04;

const COMPLETE_GARDEN = previewGardenState({ hizbCompleted: HIZB_COUNT });

export interface KhatmaBadgeProps {
  view: BadgeView;
  /** Width and height, in points. */
  size: number;
  /** Fixes the appearance whatever the device's: for the card of a shared badge, always light. */
  appearance?: 'light' | 'dark';
}

/**
 * The badge of a khatma (D46, validated): the gold eight-pointed star of the quarter-hizb marks,
 * the completed garden in its round window and the number of the khatma on a gold coin. A garden in
 * progress is a fine outline with its growth as an arc; a level to come is a dashed outline round a
 * blank plot, with a lock. A picture only: the shelf or the screen around it says it in words.
 */
export function KhatmaBadge({ view, size, appearance }: KhatmaBadgeProps) {
  const colors = useColorValues(appearance);
  const hizbShown = view.kind === 'in-progress' ? (view.hizbCompleted ?? 0) : HIZB_COUNT;
  const gardenState = useMemo(
    () =>
      hizbShown === HIZB_COUNT ? COMPLETE_GARDEN : previewGardenState({ hizbCompleted: hizbShown }),
    [hizbShown],
  );
  const { centre } = SHAPE;
  const windowSize = (size * SHAPE.windowRadius * 2) / BADGE_BOX;
  const windowOffset = (size * (centre - SHAPE.windowRadius)) / BADGE_BOX;
  const coinSize = (size * SHAPE.coinRadius * 2) / BADGE_BOX;
  const progress =
    view.kind === 'in-progress' && view.hizbCompleted !== null
      ? Math.max(MIN_ARC, view.hizbCompleted / HIZB_COUNT)
      : 0;
  const gradientId = `badge-gold-${view.kind}`;

  return (
    <View
      style={{ width: size, height: size }}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size} viewBox={`0 0 ${BADGE_BOX} ${BADGE_BOX}`}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.goldLight} />
            <Stop offset="1" stopColor={colors.goldDeep} />
          </LinearGradient>
        </Defs>
        {view.kind === 'earned' ? (
          <>
            <Polygon
              points={starPoints(centre, SHAPE.starRadius)}
              fill={colors.frameBand}
              stroke={colors.gold}
              strokeWidth={2.4}
              strokeLinejoin="round"
            />
            <Polygon
              points={starPoints(centre, SHAPE.innerStarRadius)}
              fill="none"
              stroke={colors.goldLight}
              strokeWidth={1}
              strokeLinejoin="round"
            />
            <Circle
              cx={centre}
              cy={centre}
              r={SHAPE.windowRadius + 1}
              fill={colors.surfaceInset}
              stroke={colors.gold}
              strokeWidth={1.6}
            />
          </>
        ) : null}
        {view.kind === 'in-progress' ? (
          <>
            <Polygon
              points={starPoints(centre, SHAPE.starRadius)}
              fill="none"
              stroke={colors.outline}
              strokeWidth={1.2}
              strokeLinejoin="round"
            />
            <Circle cx={centre} cy={centre} r={SHAPE.windowRadius + 1} fill={colors.surfaceInset} />
            <Circle
              cx={centre}
              cy={centre}
              r={SHAPE.arcRadius}
              fill="none"
              stroke={colors.actionTonal}
              strokeWidth={2.4}
            />
            {progress > 0 ? (
              <Path
                d={progressArc(centre, SHAPE.arcRadius, progress)}
                fill="none"
                stroke={colors.actionTint}
                strokeWidth={2.4}
                strokeLinecap="round"
              />
            ) : null}
          </>
        ) : null}
        {view.kind === 'locked' ? (
          <>
            <Polygon
              points={starPoints(centre, SHAPE.starRadius)}
              fill="none"
              stroke={colors.dotEmpty}
              strokeWidth={1.2}
              strokeDasharray="3 3"
              strokeLinejoin="round"
            />
            <Circle cx={centre} cy={centre} r={SHAPE.windowRadius + 1} fill={colors.field} />
          </>
        ) : null}
        {view.kind === 'earned' ? (
          <>
            <Circle
              cx={centre}
              cy={SHAPE.coinY}
              r={SHAPE.coinRadius + 1.6}
              fill={colors.frameBand}
            />
            <Circle
              cx={centre}
              cy={SHAPE.coinY}
              r={SHAPE.coinRadius}
              fill={`url(#${gradientId})`}
            />
            <Text
              x={centre}
              y={SHAPE.coinY + 3.6}
              fontSize={view.khatm > 99 ? 7 : 10}
              fontWeight="700"
              fill={colors.onAction}
              textAnchor="middle"
            >
              {String(view.khatm)}
            </Text>
          </>
        ) : null}
        {view.kind === 'locked' ? (
          <Circle cx={centre} cy={SHAPE.coinY} r={SHAPE.coinRadius} fill={colors.dotEmpty} />
        ) : null}
      </Svg>
      <View
        style={[
          styles.window,
          { width: windowSize, height: windowSize, top: windowOffset, start: windowOffset },
        ]}
      >
        {view.kind === 'locked' ? (
          <GardenSilhouette style={styles.picture} />
        ) : (
          <GardenThumb
            styleId={view.styleId}
            state={gardenState}
            style={styles.picture}
            appearance={appearance}
          />
        )}
      </View>
      {view.kind === 'locked' ? (
        <View
          style={[
            styles.coin,
            {
              width: coinSize,
              height: coinSize,
              top: (size * SHAPE.coinY) / BADGE_BOX - coinSize / 2,
              start: (size - coinSize) / 2,
            },
          ]}
        >
          <Icon symbol={LOCK} textStyle="footnote" tint={colors.surface} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  window: {
    position: 'absolute',
    borderRadius: 999,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // A little wider than the window: the plot fills the circle, its corners cut by it.
  picture: { width: '128%' },
  coin: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
