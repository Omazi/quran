import { useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { GradientBackdrop, useColorValues, voiceStoryLayout as L, type BackdropName } from '@/ui';

import { STORY_MOTION } from '../config';
import { gardenPresence, skyAt } from '../story-math';
import type { StageProps } from './stage-props';

/**
 * The sky behind the whole first launch (`.sky`): the warm gradient of the welcome mockup always
 * underneath, and over it the grey of the drought, the dusk of the two voice pages and the pale
 * paper of friends and settings, each at the weight the position gives (pages.ts `sky`). Then the
 * soft light behind the garden (`.sun`) and the water light of the dusk (`.dusk-glow`). In dark
 * mode every gradient takes its dusk values (`backdropGradients`).
 */
export function StageSky({ position, pages, layout, marks }: StageProps) {
  const skies = useMemo(() => pages.map((page) => page.sky), [pages]);
  const grey = useAnimatedStyle(() => ({ opacity: skyAt(skies, position.get()).grey }));
  const dusk = useAnimatedStyle(() => ({ opacity: skyAt(skies, position.get()).dusk }));
  const plain = useAnimatedStyle(() => ({ opacity: skyAt(skies, position.get()).plain }));
  const glow = useAnimatedStyle(() => {
    const sky = skyAt(skies, position.get());
    const pos = position.get();
    const garden = gardenPresence(pos, marks) * (pos > marks.friends ? 0.6 : 1);
    return { opacity: (1 - sky.dusk) * (1 - sky.grey * 0.7) * garden };
  });
  const duskGlow = useAnimatedStyle(() => ({
    opacity: skyAt(skies, position.get()).dusk,
    transform: [
      {
        translateY:
          layout.rosetteY -
          L.duskGlowSize / 2 +
          (position.get() - marks.recognition) * -STORY_MOTION.labelTravel,
      },
    ],
  }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="onboarding-sky">
      <GradientBackdrop name="growing" style={StyleSheet.absoluteFill} />
      <SkyLayer name="thirsty" style={grey} />
      <SkyLayer name="dusk" style={dusk} />
      <SkyLayer name="together" style={plain} />
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
  duskGlow: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: L.duskGlowSize,
    height: L.duskGlowSize,
  },
});
