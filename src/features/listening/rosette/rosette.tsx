import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  FeGaussianBlur,
  Filter,
  G,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import type { Unsubscribe } from '@/domain/listening';

import { ROSETTE_GEOMETRY, ROSETTE_MOTION, ROSETTE_OPACITY } from '../config';
import { heartTips, insidePath, petalPath, rosetteFrame, starPath } from './rosette-geometry';
import {
  advance,
  createRosetteMotion,
  isGoldSlot,
  lineOpacities,
  petalAppearance,
  receiveLevel,
  rosetteScale,
  type Appearance,
  type LineOpacities,
  type RosetteMotion,
} from './rosette-motion';
import { useRosetteColors, type RosetteColors } from './use-rosette-colors';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Room around the outer star for its light, which spreads about three blur radii. */
const GLOW_ROOM = ROSETTE_OPACITY.dark.glowBlur * 3;

/** A path that draws nothing, for an empty petal slot. */
const NO_PATH = 'M0 0';

export interface RosetteProps {
  /** Size of the whole screen: the rosette is placed and sized from it, as in the prototype. */
  readonly width: number;
  readonly height: number;
  /** Subscribes to the level of the voice, 0 to 1 (`SpeechEngine.onLevel`). */
  readonly subscribeToLevel: (listener: (level: number) => void) => Unsubscribe;
  /** No petal leaves and nothing grows; the voice only lights the lines (D29). */
  readonly reducedMotion: boolean;
  /**
   * Where the star is, when it is not where the listening screen puts it (the centre and radius,
   * in points of the box above). The first launch shows the rosette in a smaller box.
   */
  readonly frame?: { readonly cx: number; readonly cy: number; readonly radius: number };
  readonly testID?: string;
}

/**
 * The listening rosette (D27, D29): the eight-pointed star of the hizb quarters, whose lines
 * light up with the voice and from which petals leave at each breath.
 *
 * Everything that moves is computed on the UI thread (`useFrameCallback`): the JavaScript thread
 * only passes the levels on. The stars are drawn once and only their opacity and size change,
 * which the system does without redrawing them; the petals are the only paths redrawn at each
 * frame. Decorative: screen readers never reach it, the screen announces its state instead.
 */
export function Rosette({
  width,
  height,
  subscribeToLevel,
  reducedMotion,
  frame,
  testID,
}: RosetteProps) {
  const colors = useRosetteColors();
  const [initialMotion] = useState(createRosetteMotion);
  const motion = useSharedValue<RosetteMotion>(initialMotion);
  const inbox = useSharedValue<number[]>([]);
  const allowPetals = !reducedMotion;

  useEffect(
    () =>
      subscribeToLevel((level) => {
        inbox.modify((samples) => {
          'worklet';
          samples.push(level);
          return samples;
        });
      }),
    [subscribeToLevel, inbox],
  );

  useFrameCallback((frame) => {
    'worklet';
    const samples = inbox.get();
    if (samples.length > 0) inbox.set([]);
    const seconds = (frame.timeSincePreviousFrame ?? 0) / 1000;
    motion.modify((state) => {
      'worklet';
      for (const sample of samples) receiveLevel(state, sample, allowPetals);
      advance(state, seconds, allowPetals);
      return state;
    });
  });

  if (width <= 0 || height <= 0) return null;
  const { cx, cy, radius } = frame ?? rosetteFrame(width, height);
  const side = 2 * (radius + GLOW_ROOM);
  // Centred, so the same from either edge: `start` keeps it right in both writing directions.
  const box = { start: cx - side / 2, top: cy - side / 2, width: side, height: side };
  const centre = side / 2;
  const layer = { motion, appearance: colors.appearance, reducedMotion, box };
  const isNight = colors.appearance === 'dark';

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      {isNight ? (
        <Layer {...layer} family="glow" testID="rosette-glow">
          <Defs>
            <Filter
              id="rosette-glow"
              filterUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={side}
              height={side}
            >
              <FeGaussianBlur stdDeviation={ROSETTE_OPACITY.dark.glowBlur} />
            </Filter>
          </Defs>
          <G filter="url(#rosette-glow)" fill="none" stroke={colors.water} strokeLinejoin="round">
            <Path
              d={starPath(centre, centre, radius * ROSETTE_GEOMETRY.inner)}
              strokeWidth={ROSETTE_OPACITY.dark.heartGlowWidth}
            />
            <Path
              d={starPath(centre, centre, radius)}
              strokeWidth={ROSETTE_OPACITY.dark.outerGlowWidth}
            />
          </G>
        </Layer>
      ) : null}
      {allowPetals ? (
        // Sized explicitly: a canvas sized by its style alone falls back to a small default on
        // the web, and the petals, which grow far past the star, would be cut.
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} testID="rosette-petals">
          {Array.from({ length: ROSETTE_MOTION.maxPetals }, (_, index) => (
            <Petal
              key={index}
              index={index}
              motion={motion}
              cx={cx}
              cy={cy}
              radius={radius}
              colors={colors}
            />
          ))}
        </Svg>
      ) : null}
      <Layer {...layer} family="inside" testID="rosette-inside">
        <Path
          d={insidePath(centre, centre, radius)}
          fill="none"
          stroke={colors.gold}
          strokeWidth={ROSETTE_GEOMETRY.insideWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Layer>
      <Layer {...layer} family="outer" testID="rosette-outer">
        <Path
          d={starPath(centre, centre, radius)}
          fill="none"
          stroke={colors.water}
          strokeWidth={ROSETTE_GEOMETRY.outerWidth}
          strokeLinejoin="round"
        />
      </Layer>
      <Layer {...layer} family="heart" testID="rosette-heart">
        <Path
          d={starPath(centre, centre, radius * ROSETTE_GEOMETRY.inner)}
          fill="none"
          stroke={colors.heart}
          strokeWidth={ROSETTE_GEOMETRY.heartWidth}
          strokeLinejoin="round"
        />
      </Layer>
      {isNight ? (
        <Layer {...layer} family="nodes" testID="rosette-nodes">
          <Defs>
            <RadialGradient id="rosette-node">
              <Stop offset={0} stopColor={colors.heart} stopOpacity={1} />
              <Stop offset={1} stopColor={colors.heart} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {heartTips(centre, centre, radius).map((tip, index) => (
            <Circle
              key={index}
              cx={tip.x}
              cy={tip.y}
              r={ROSETTE_GEOMETRY.nodeRadius}
              fill="url(#rosette-node)"
            />
          ))}
        </Layer>
      ) : null}
    </View>
  );
}

interface LayerProps {
  readonly motion: SharedValue<RosetteMotion>;
  readonly appearance: Appearance;
  readonly reducedMotion: boolean;
  readonly family: keyof LineOpacities;
  readonly box: { start: number; top: number; width: number; height: number };
  readonly children: ReactNode;
  readonly testID: string;
}

/** One family of lines, drawn once; the voice changes its opacity and its size only. */
function Layer({ motion, appearance, reducedMotion, family, box, children, testID }: LayerProps) {
  const style = useAnimatedStyle(() => {
    const { level, time } = motion.get();
    return {
      opacity: lineOpacities(level, time, appearance, reducedMotion)[family],
      transform: [{ scale: rosetteScale(level, reducedMotion) }],
    };
  });
  return (
    <Animated.View style={[styles.layer, box, style]} testID={testID}>
      <Svg width={box.width} height={box.height}>
        {children}
      </Svg>
    </Animated.View>
  );
}

interface PetalProps {
  readonly index: number;
  readonly motion: SharedValue<RosetteMotion>;
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly colors: RosetteColors;
}

/** One slot of the ring of petals, redrawn at each frame from the motion. */
function Petal({ index, motion, cx, cy, radius, colors }: PetalProps) {
  const isGold = isGoldSlot(index);
  const opacities = ROSETTE_OPACITY[colors.appearance];
  const share = isGold ? opacities.goldPetal : opacities.waterPetal;
  const animatedProps = useAnimatedProps(() => {
    const state = motion.get();
    const slot = state.slots[index];
    const look = slot === undefined ? null : petalAppearance(slot, state.time);
    if (look === null || look.opacity <= 0) return { d: NO_PATH, strokeOpacity: 0, strokeWidth: 0 };
    const size = radius * look.scale * rosetteScale(state.level, false);
    return {
      d: petalPath(cx, cy, size, look.roundness),
      strokeOpacity: look.opacity * share,
      strokeWidth: look.width,
    };
  });
  return (
    <AnimatedPath
      animatedProps={animatedProps}
      fill="none"
      stroke={isGold ? colors.gold : colors.water}
      strokeLinejoin="round"
      testID={`rosette-petal-${index}`}
    />
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute' },
});
