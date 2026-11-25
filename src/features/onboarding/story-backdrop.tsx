import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { GradientBackdrop, StarPattern, crossfade, type BackdropName } from '@/ui';

import type { OnboardingPage } from './pages';

/** The gradients laid over the warm one, bottom to top. */
const LAYERS = [
  'complete',
  'thirsty',
  'dead',
  'together',
  'listening',
] as const satisfies readonly Exclude<BackdropName, 'growing'>[];

type Layer = (typeof LAYERS)[number];

export interface StoryBackdropProps {
  pages: readonly OnboardingPage[];
  /** The pager's position: the sky of two pages mixes as they pass. */
  position: SharedValue<number>;
}

/**
 * The sky behind the whole first launch, as the prototype paints it: the warm gradient of the
 * validated welcome mockup (docs/design/bienvenue.png) always at the bottom, and over it the
 * gradients the pages ask for (`OnboardingPage.backdrop`), each at the opacity the position gives.
 * It stays in place while the pages slide, so the sky drains to grey with the finger as the garden
 * dries, and the listening page rises out of it in deep green.
 */
export function StoryBackdrop({ pages, position }: StoryBackdropProps) {
  const weights = useMemo(
    () =>
      LAYERS.map((layer) => ({ layer, values: pages.map((page) => page.backdrop[layer] ?? 0) }))
        // A gradient no page asks for is not drawn at all.
        .filter(({ values }) => values.some((value) => value > 0)),
    [pages],
  );
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="onboarding-backdrop">
      <GradientBackdrop name="growing" style={StyleSheet.absoluteFill} />
      {weights.map(({ layer, values }) => (
        <BackdropLayer key={layer} layer={layer} values={values} position={position} />
      ))}
    </View>
  );
}

function BackdropLayer({
  layer,
  values,
  position,
}: {
  layer: Layer;
  values: readonly number[];
  position: SharedValue<number>;
}) {
  const fade = useAnimatedStyle(() => ({ opacity: crossfade(values, position.value) }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, fade]} testID={`onboarding-backdrop-${layer}`}>
      <GradientBackdrop name={layer} style={StyleSheet.absoluteFill} />
      {layer === 'listening' ? <StarPattern style={StyleSheet.absoluteFill} /> : null}
    </Animated.View>
  );
}
