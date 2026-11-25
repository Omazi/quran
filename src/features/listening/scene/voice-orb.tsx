import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import type { Unsubscribe } from '@/domain/listening';
import {
  listeningOpacity,
  listeningShape,
  stateOpacity,
  useListeningColors,
  type IconSymbol,
} from '@/ui';

import { ROSETTE_MOTION } from '../config';
import { SceneSymbol } from './scene-symbol';
import {
  advance,
  createRosetteMotion,
  petalAppearance,
  receiveLevel,
  ringsLight,
  rosetteScale,
  type RosetteMotion,
} from './voice-motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const MICROPHONE_SYMBOL: IconSymbol = { ios: 'mic', android: 'mic' };
export const MICROPHONE_OFF_SYMBOL: IconSymbol = { ios: 'mic.slash', android: 'mic_off' };

const ORB_RADIUS = listeningShape.orbDiameter / 2;
const OUTER_RING = listeningShape.ringRadii[listeningShape.ringRadii.length - 1] ?? ORB_RADIUS;
/** Room for the ripples, which grow past the outer ring before they fade. */
const FIELD = 2 * OUTER_RING * 1.25;
const CENTRE = FIELD / 2;
/** A ripple starts at the disc of shade around the microphone. */
const RIPPLE_START = listeningShape.ringRadii[0] ?? ORB_RADIUS;

export interface VoiceOrbProps {
  /** Subscribes to the level of the voice, 0 to 1 (`SpeechEngine.onLevel`). Null at rest. */
  readonly subscribeToLevel: ((listener: (level: number) => void) => Unsubscribe) | null;
  /** No ripple leaves and nothing grows: the voice only lights the rings (motion.md). */
  readonly reducedMotion: boolean;
  readonly symbol?: IconSymbol;
  /** What pressing the microphone does, and what screen readers hear. */
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly testID?: string;
}

/**
 * The gold microphone of shazam.png, in its disc of shade, inside four thin gold rings. While
 * the screen listens the rings light with the voice and a ripple leaves at each breath, at the
 * rhythm of the validated rosette (D27, D29). The microphone is the one gesture of the screen:
 * it stops a listening, or listens again.
 *
 * What moves is computed on the UI thread (`useFrameCallback`); the JavaScript thread only
 * passes the levels on. The rings and the ripples are ornaments, hidden from screen readers;
 * the microphone is a button.
 */
export function VoiceOrb({
  subscribeToLevel,
  reducedMotion,
  symbol = MICROPHONE_SYMBOL,
  accessibilityLabel,
  onPress,
  testID,
}: VoiceOrbProps) {
  const colors = useListeningColors();
  const [initialMotion] = useState(createRosetteMotion);
  const motion = useSharedValue<RosetteMotion>(initialMotion);
  const inbox = useSharedValue<number[]>([]);
  const isListening = subscribeToLevel !== null;
  const allowRipples = isListening && !reducedMotion;

  useEffect(() => {
    if (subscribeToLevel === null) return undefined;
    return subscribeToLevel((level) => {
      inbox.modify((samples) => {
        'worklet';
        samples.push(level);
        return samples;
      });
    });
  }, [subscribeToLevel, inbox]);

  useFrameCallback((frame) => {
    'worklet';
    if (!isListening) return;
    const samples = inbox.get();
    if (samples.length > 0) inbox.set([]);
    const seconds = (frame.timeSincePreviousFrame ?? 0) / 1000;
    motion.modify((state) => {
      'worklet';
      for (const sample of samples) receiveLevel(state, sample, allowRipples);
      advance(state, seconds, allowRipples);
      return state;
    });
  });

  const ringsStyle = useAnimatedStyle(() => ({
    opacity: isListening ? ringsLight(motion.get().level) : ringsLight(0),
  }));
  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: isListening ? rosetteScale(motion.get().level, reducedMotion) : 1 }],
  }));

  return (
    <View style={styles.field} pointerEvents="box-none" testID={testID}>
      <Animated.View
        style={[StyleSheet.absoluteFill, ringsStyle]}
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="listening-rings"
      >
        <Svg width={FIELD} height={FIELD}>
          <Circle
            cx={CENTRE}
            cy={CENTRE}
            r={RIPPLE_START}
            fill={colors.orbHalo}
            opacity={listeningOpacity.halo}
          />
          {listeningShape.ringRadii.map((radius, index) => (
            <Circle
              key={radius}
              cx={CENTRE}
              cy={CENTRE}
              r={radius}
              fill="none"
              stroke={colors.ring}
              strokeWidth={listeningShape.ringWidth}
              strokeOpacity={listeningOpacity.rings[index] ?? 0}
            />
          ))}
        </Svg>
      </Animated.View>
      {allowRipples ? (
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID="listening-ripples"
        >
          <Svg width={FIELD} height={FIELD}>
            {Array.from({ length: ROSETTE_MOTION.maxPetals }, (_, index) => (
              <Ripple key={index} index={index} motion={motion} color={colors.ring} />
            ))}
          </Svg>
        </View>
      ) : null}
      <Animated.View style={[styles.orbPlace, { shadowColor: colors.shadow }, orbStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPress={onPress}
          style={({ pressed }) => [styles.orb, pressed && { opacity: stateOpacity.pressed }]}
          testID="listening-orb"
        >
          <Svg
            width={listeningShape.orbDiameter}
            height={listeningShape.orbDiameter}
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              <RadialGradient id="orb-gold" cx="38%" cy="30%" r="75%">
                <Stop offset="0" stopColor={colors.orbHighlight} />
                <Stop offset="0.5" stopColor={colors.orbBody} />
                <Stop offset="1" stopColor={colors.orbEdge} />
              </RadialGradient>
            </Defs>
            <Circle cx={ORB_RADIUS} cy={ORB_RADIUS} r={ORB_RADIUS} fill="url(#orb-gold)" />
          </Svg>
          <SceneSymbol symbol={symbol} size={listeningShape.orbSymbol} color={colors.onOrb} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

interface RippleProps {
  readonly index: number;
  readonly motion: SharedValue<RosetteMotion>;
  readonly color: string;
}

/** One ripple slot, redrawn at each frame from the motion. */
function Ripple({ index, motion, color }: RippleProps) {
  const animatedProps = useAnimatedProps(() => {
    const state = motion.get();
    const slot = state.slots[index];
    const look = slot === undefined ? null : petalAppearance(slot, state.time);
    if (look === null || look.opacity <= 0) return { r: 0, strokeOpacity: 0, strokeWidth: 0 };
    return { r: RIPPLE_START * look.scale, strokeOpacity: look.opacity, strokeWidth: look.width };
  });
  return (
    <AnimatedCircle
      animatedProps={animatedProps}
      cx={CENTRE}
      cy={CENTRE}
      fill="none"
      stroke={color}
      testID={`listening-ripple-${index}`}
    />
  );
}

/** The side of the square the orb draws in, centred on the microphone. */
export const VOICE_ORB_FIELD = FIELD;

const styles = StyleSheet.create({
  field: { width: FIELD, height: FIELD, alignItems: 'center', justifyContent: 'center' },
  orbPlace: {
    width: listeningShape.orbDiameter,
    height: listeningShape.orbDiameter,
    borderRadius: listeningShape.orbDiameter / 2,
    shadowOpacity: listeningShape.orbShadow.opacity,
    shadowRadius: listeningShape.orbShadow.radius,
    shadowOffset: { width: 0, height: listeningShape.orbShadow.offsetY },
    elevation: listeningShape.orbShadow.elevation,
  },
  orb: {
    width: listeningShape.orbDiameter,
    height: listeningShape.orbDiameter,
    minHeight: listeningShape.orbDiameter,
    borderRadius: listeningShape.orbDiameter / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
