import { useEffect } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { launchColors } from '@/ui';

import { LaunchMark } from './launch-mark';
import { EASE_OUT, fadeOutDuration } from './launch-timeline';
import type { LaunchState } from './use-launch';

/**
 * The launch animation, over the whole app until the first screen is ready. It takes over from the
 * native launch screen, which is the same flat water colour, so nothing shows at the hand-over.
 * Hidden from VoiceOver and swallowing touches while it plays; it announces nothing, so the app
 * under it is what VoiceOver reads.
 */
export function LaunchOverlay({ phase, motion, onLayout }: Omit<LaunchState, 'isShown'>) {
  const scheme = useColorScheme();
  const water = scheme === 'dark' ? launchColors.water.dark : launchColors.water.light;
  const opacity = useSharedValue(1);
  const isLeaving = phase === 'leaving';
  useEffect(() => {
    if (isLeaving && motion) {
      opacity.value = withTiming(0, {
        duration: fadeOutDuration(motion),
        easing: Easing.bezier(...EASE_OUT),
      });
    }
  }, [isLeaving, motion, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      testID="launch-overlay"
      onLayout={onLayout}
      pointerEvents={isLeaving ? 'none' : 'auto'}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.centre, { backgroundColor: water }, style]}
    >
      {motion ? <LaunchMark water={water} motion={motion} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
});
