import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { launchColors, launchMarkWidth } from '@/ui';

import { EASE_OUT, LAUNCH_TIMELINE, REDUCED_TIMELINE, type LaunchMotion } from './launch-timeline';
import { LAUNCH_MARK } from './mark-geometry';

const { viewBox } = LAUNCH_MARK;
/** Points per canvas unit of the mark. */
const SCALE = launchMarkWidth / viewBox.size;
const VIEW_BOX = `${viewBox.x} ${viewBox.y} ${viewBox.size} ${viewBox.size}`;

/**
 * The wipe that writes the letters: a cover of the water's own colour whose soft lower edge climbs
 * from under the letters to above them. The edge, in canvas units: where it starts (under the
 * letters), where it ends (above them), and how tall the cover is (it must reach the top of the
 * letters at the start).
 */
const EDGE = LAUNCH_TIMELINE.wipeEdge;
const EDGE_START = LAUNCH_MARK.wordBottom + EDGE;
const EDGE_END = LAUNCH_MARK.wordTop - EDGE;
const COVER_HEIGHT = (EDGE_START - EDGE_END + EDGE) * SCALE;
const COVER_TOP = (EDGE_END - viewBox.y) * SCALE - COVER_HEIGHT;
const COVER_START_OFFSET = (EDGE_START - EDGE_END) * SCALE;

const LEAF_ORIGIN: [number, number, number] = [
  (LAUNCH_MARK.leafBase.x - viewBox.x) * SCALE,
  (LAUNCH_MARK.leafBase.y - viewBox.y) * SCALE,
  0,
];
const FALL = LAUNCH_TIMELINE.drops.fall * SCALE;

const bezier = Easing.bezier(...EASE_OUT);

/** One layer of the mark: the whole box, one outline, one colour. */
function Layer({ d, color }: { d: string; color: string }) {
  return (
    <Svg width={launchMarkWidth} height={launchMarkWidth} viewBox={VIEW_BOX}>
      <Path d={d} fill={color} />
    </Svg>
  );
}

function useSpringIn(start: number, duration: number, dampingRatio: number, isStill: boolean) {
  const progress = useSharedValue(isStill ? 1 : 0);
  useEffect(() => {
    if (isStill) return;
    progress.value = withDelay(start, withSpring(1, { duration, dampingRatio }));
  }, [progress, start, duration, dampingRatio, isStill]);
  return progress;
}

function Drop({ d, index, isStill }: { d: string; index: number; isStill: boolean }) {
  const { drops } = LAUNCH_TIMELINE;
  const progress: SharedValue<number> = useSpringIn(
    drops.start + index * drops.stagger,
    drops.duration,
    drops.dampingRatio,
    isStill,
  );
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, progress.value * 2)),
    transform: [{ translateY: (progress.value - 1) * FALL }],
  }));
  return (
    <Animated.View style={[styles.layer, style]}>
      <Layer d={d} color={launchColors.drops} />
    </Animated.View>
  );
}

function Leaf({ isStill }: { isStill: boolean }) {
  const { leaf } = LAUNCH_TIMELINE;
  const progress = useSpringIn(leaf.start, leaf.duration, leaf.dampingRatio, isStill);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, progress.value * 3)),
    transformOrigin: LEAF_ORIGIN,
    transform: [
      { scale: leaf.from + (1 - leaf.from) * progress.value },
      { rotate: `${(1 - progress.value) * leaf.foldedBy}deg` },
    ],
  }));
  return (
    <Animated.View style={[styles.layer, style]}>
      <Layer d={LAUNCH_MARK.leaf} color={launchColors.leaf} />
    </Animated.View>
  );
}

function Cover({ color }: { color: string }) {
  const { word } = LAUNCH_TIMELINE;
  const wipe = useSharedValue(0);
  useEffect(() => {
    wipe.value = withDelay(word.start, withTiming(1, { duration: word.duration, easing: bezier }));
  }, [wipe, word.start, word.duration]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - wipe.value) * COVER_START_OFFSET }],
  }));
  const solid = 1 - (EDGE * SCALE) / COVER_HEIGHT;
  return (
    <Animated.View style={[styles.cover, { top: COVER_TOP, height: COVER_HEIGHT }, style]}>
      <Svg width={launchMarkWidth} height={COVER_HEIGHT}>
        <Defs>
          <LinearGradient id="launch-cover" x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={color} stopOpacity={1} />
            <Stop offset={solid} stopColor={color} stopOpacity={1} />
            <Stop offset={1} stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#launch-cover)" />
      </Svg>
    </Animated.View>
  );
}

export interface LaunchMarkProps {
  /** The colour of the water behind the mark, which the letters' wipe is made of. */
  water: string;
  motion: LaunchMotion;
}

/**
 * The calligraphic mark of the icon, jannatuk, drawn from its three vector layers and animated:
 * the letters are wiped in from the bottom up along the rising stroke of the kaf, the drops of
 * water fall into place one after the other, and the leaf unfurls at the tip of the stroke.
 * With Reduce Motion nothing moves: the finished mark fades in.
 *
 * Each part is its own view and moves with transform and opacity only (animate skill, step 4),
 * which run on the UI thread and need nothing from react-native-svg but a still drawing.
 */
export function LaunchMark({ water, motion }: LaunchMarkProps) {
  const isStill = motion === 'reduced';
  const appear = useSharedValue(isStill ? 0 : 1);
  useEffect(() => {
    if (isStill) {
      appear.value = withTiming(1, { duration: REDUCED_TIMELINE.fadeIn, easing: bezier });
    }
  }, [appear, isStill]);
  const appearStyle = useAnimatedStyle(() => ({ opacity: appear.value }));

  return (
    <Animated.View
      testID="launch-mark"
      style={[styles.box, appearStyle]}
      pointerEvents="none"
      accessible={false}
    >
      <View style={styles.layer}>
        <Layer d={LAUNCH_MARK.word} color={launchColors.word} />
      </View>
      {isStill ? null : <Cover color={water} />}
      {LAUNCH_MARK.drops.map((d, index) => (
        <Drop key={index} d={d} index={index} isStill={isStill} />
      ))}
      <Leaf isStill={isStill} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { width: launchMarkWidth, height: launchMarkWidth },
  layer: {
    position: 'absolute',
    top: 0,
    start: 0,
    width: launchMarkWidth,
    height: launchMarkWidth,
  },
  cover: { position: 'absolute', start: 0, width: launchMarkWidth },
});
