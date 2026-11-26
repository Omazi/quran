import { useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { GradientBackdrop, useColorValues, voiceStoryLayout as L, type BackdropName } from '@/ui';

import { STORY_MOTION } from '../config';
import { gardenPresence, nightLook, skyAt, smooth } from '../story-math';
import type { StageProps } from './stage-props';

/**
 * The sky behind the whole first launch (`.sky`): the warm gradient of the welcome mockup always
 * underneath, and over it the grey of the drought and the pale paper of friends and settings, and
 * the night of the two voice pages as a curtain that comes down and goes up (motion spec §4). Then the
 * soft light behind the garden (`.sun`) and the water light of the dusk (`.dusk-glow`). In dark
 * mode every gradient takes its dusk values (`backdropGradients`).
 */
export function StageSky({ position, pages, layout, marks, reducedMotion }: StageProps) {
  const skies = useMemo(() => pages.map((page) => page.sky), [pages]);
  const curtainHeight = layout.height * STORY_MOTION.curtainHeight;
  const grey = useAnimatedStyle(() => ({ opacity: skyAt(skies, position.get()).grey }));
  // The night is a curtain that comes down from the top and leaves upwards like dawn, by its
  // translation only (motion spec §4); with "reduce motion", it fades.
  const curtain = useAnimatedStyle(() => {
    const night = nightLook(position.get(), marks);
    if (!night.visible) return { opacity: 0, transform: [{ translateY: -curtainHeight }] };
    if (reducedMotion) return { opacity: smooth(night.night), transform: [{ translateY: 0 }] };
    return { opacity: 1, transform: [{ translateY: night.offset * curtainHeight }] };
  });
  // The pale paper of friends and settings is swapped in under the full night.
  const plain = useAnimatedStyle(() => ({
    opacity: position.get() >= marks.recognition ? 1 : 0,
  }));
  const glow = useAnimatedStyle(() => {
    const sky = skyAt(skies, position.get());
    const pos = position.get();
    const night = nightLook(pos, marks).night;
    const garden = gardenPresence(pos, marks) * (pos > marks.friends ? 0.6 : 1);
    return { opacity: (1 - night) * (1 - sky.grey * 0.7) * garden };
  });
  const duskGlow = useAnimatedStyle(() => {
    const night = nightLook(position.get(), marks).night;
    return {
      opacity: night * night,
      transform: [
        {
          translateY:
            layout.rosetteY -
            L.duskGlowSize / 2 +
            (position.get() - marks.recognition) * -STORY_MOTION.labelTravel,
        },
      ],
    };
  });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="onboarding-sky">
      <GradientBackdrop name="growing" style={StyleSheet.absoluteFill} />
      <SkyLayer name="thirsty" style={grey} />
      <SkyLayer name="together" style={plain} />
      <Animated.View
        style={[styles.curtain, { height: reducedMotion ? layout.height : curtainHeight }, curtain]}
        testID="onboarding-night"
      >
        <GradientBackdrop name="dusk" style={{ height: layout.height }} />
        {reducedMotion ? null : (
          <GradientBackdrop name="duskTail" style={{ height: curtainHeight - layout.height }} />
        )}
      </Animated.View>
      <Animated.View style={[styles.duskGlow, duskGlow]}>
        <Glow role="duskGlow" width={L.duskGlowSize} height={L.duskGlowSize} />
      </Animated.View>
      <Animated.View
        style={[
          styles.glow,
          { top: layout.glowTop, start: (layout.width - L.glowWidth) / 2 },
          glow,
        ]}
      >
        <Glow role="storyGlow" width={L.glowWidth} height={L.glowHeight} />
      </Animated.View>
    </View>
  );
}

function SkyLayer({
  name,
  style,
}: {
  name: BackdropName;
  style: ReturnType<typeof useAnimatedStyle>;
}) {
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <GradientBackdrop name={name} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

/** A soft round light, fading from its centre to nothing (a radial gradient of one colour). */
function Glow({
  role,
  width,
  height,
}: {
  role: 'storyGlow' | 'duskGlow';
  width: number;
  height: number;
}) {
  const colors = useColorValues();
  const id = `glow-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors[role]} stopOpacity={1} />
          <Stop offset="0.55" stopColor={colors[role]} stopOpacity={0.37} />
          <Stop offset="1" stopColor={colors[role]} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', width: L.glowWidth, height: L.glowHeight },
  curtain: { position: 'absolute', top: 0, start: 0, end: 0 },
  duskGlow: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: L.duskGlowSize,
    height: L.duskGlowSize,
  },
});
