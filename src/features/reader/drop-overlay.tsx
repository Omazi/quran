import { useEffect } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Icon, readerShapes, textStyles, useColors, type IconSymbol } from '@/ui';

import { READER_CONFIG } from './config';
import { dropFrame, type DropTimings, type Point } from './drop-moment';

const DROP_SYMBOL: IconSymbol = { ios: 'drop.fill', android: 'water_drop' };
/** The splash goes out fast and slows (the mockup's cubic-bezier(.2, .7, .4, 1)). */
const SPLASH_EASING = Easing.bezier(0.2, 0.7, 0.4, 1);
/** The droplets leave over the upper half-circle, from this angle to this one (the mockup's). */
const SPLASH_FROM = 0.15 * Math.PI;
const SPLASH_SPAN = 0.7 * Math.PI;
const SPLASH_REACH = 24;

export interface DropOverlayProps {
  /** A new number for each drop: a new fall starts. */
  dropId: number;
  from: Point;
  to: Point;
  timings: DropTimings;
}

/**
 * The single drop of a page that counts (validated mockup of 27 November 2026, shot 21): it forms
 * at the end of the page's thread, swelling like a bead, then falls with gravity into the ring of
 * the glass pill, stretching with its speed, and splashes a few droplets where it lands. The drop
 * is the system's water symbol in the water's colour (sf-symbols.md: one consistent icon system;
 * the charter: no drawn illustration). It moves by transforms only, on the UI thread, for the time
 * the screen gives it (`dropTimings`). Never shown with Reduce Motion: the screen does not draw it.
 */
export function DropOverlay({ dropId, from, to, timings }: DropOverlayProps) {
  const colors = useColors();
  const elapsed = useSharedValue(0);
  const splash = useSharedValue(0);

  useEffect(() => {
    elapsed.value = 0;
    splash.value = 0;
    elapsed.value = withTiming(timings.totalMs, {
      duration: timings.totalMs,
      easing: Easing.linear,
    });
    splash.value = withDelay(
      timings.totalMs,
      withTiming(1, { duration: READER_CONFIG.drop.splashMs, easing: SPLASH_EASING }),
    );
  }, [dropId, elapsed, splash, timings.totalMs]);

  const dropStyle = useAnimatedStyle(() => {
    const frame = dropFrame(elapsed.value, timings, from, to);
    return {
      opacity: elapsed.value >= timings.totalMs ? 0 : 1,
      transform: [
        { translateX: frame.x },
        { translateY: frame.y },
        { scaleX: frame.scaleX },
        { scaleY: frame.scaleY },
      ],
    };
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="reader-drop">
      <Animated.View style={[styles.drop, dropStyle]}>
        <Icon symbol={DROP_SYMBOL} textStyle="title3" tint={colors.waterFill} />
      </Animated.View>
      {Array.from({ length: READER_CONFIG.drop.splashDroplets }, (_, index) => (
        <Droplet key={index} index={index} at={to} progress={splash} color={colors.waterFill} />
      ))}
    </View>
  );
}

function Droplet({
  index,
  at,
  progress,
  color,
}: {
  index: number;
  at: Point;
  progress: SharedValue<number>;
  color: ColorValue;
}) {
  const count = READER_CONFIG.drop.splashDroplets;
  const angle = -(SPLASH_FROM + SPLASH_SPAN * (index / Math.max(1, count - 1)));
  const style = useAnimatedStyle(() => {
    const k = progress.value;
    const reach = SPLASH_REACH * (0.8 + (0.4 * ((index * 7) % 5)) / 4);
    return {
      opacity: k === 0 || k === 1 ? 0 : 1 - k,
      transform: [
        { translateX: at.x + Math.cos(angle) * reach * k },
        // Up, then down again: a small arc.
        { translateY: at.y + Math.sin(angle) * reach * k + reach * k * k },
        { scale: 1 - 0.7 * k },
      ],
    };
  });
  return <Animated.View style={[styles.droplet, { backgroundColor: color }, style]} />;
}

const { dropSplash } = readerShapes;
const DROP_SIZE = textStyles.title3.fontSize;

const styles = StyleSheet.create({
  // Drawn around its middle, at the point the transforms give; it stretches from its tip.
  drop: {
    position: 'absolute',
    left: -DROP_SIZE / 2,
    top: -DROP_SIZE / 2,
    transformOrigin: 'top',
  },
  droplet: {
    position: 'absolute',
    left: -dropSplash / 2,
    top: -dropSplash / 2,
    width: dropSplash,
    height: dropSplash,
    borderRadius: dropSplash / 2,
  },
});
