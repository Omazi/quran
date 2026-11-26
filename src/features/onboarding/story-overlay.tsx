import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText, useColorValues, voiceStoryLayout as L } from '@/ui';

import type { OnboardingPage } from './pages';
import type { StageLayout } from './stage-layout';
import { STORY_MOTION } from './config';
import { dotShape, isNameOnNight, nightLook, storyMarks } from './story-math';

export interface StoryOverlayProps {
  readonly pages: readonly OnboardingPage[];
  readonly pageIndex: number;
  readonly position: SharedValue<number>;
  readonly layout: StageLayout;
  readonly isReplay: boolean;
  readonly showPage: (page: number) => void;
}

/**
 * What stays in place over the pages: the app's name at the top (`.brand`), dark on the warm sky
 * and light on the dusk, and the page dots on the end edge (`.dots`): the current one a long
 * capsule, its neighbours small, the far ones smaller, then gone, changing with the finger. The
 * dots do not take touches (a swipe that starts on them still turns the page); for VoiceOver they
 * are one adjustable element that turns the pages (gestures.md › Best practices: more than one way).
 */
export function StoryOverlay({
  pages,
  pageIndex,
  position,
  layout,
  isReplay,
  showPage,
}: StoryOverlayProps) {
  const { t } = useTranslation(['onboarding', 'common']);
  const marks = useMemo(() => storyMarks(pages), [pages]);
  // The name and the dots change colour at a moment, in 400 ms (motion spec §4), not with every
  // frame of the finger: the name when the night reaches the top, the dots past half the night.
  const nameNight = useSharedValue(0);
  const dotsNight = useSharedValue(0);
  const timing = { duration: STORY_MOTION.nameColorMs, easing: Easing.inOut(Easing.ease) };
  useAnimatedReaction(
    () => isNameOnNight(position.get()),
    (isNight, was) => {
      if (isNight !== was) nameNight.set(withTiming(isNight ? 1 : 0, timing));
    },
  );
  useAnimatedReaction(
    () => nightLook(position.get(), marks).night > 0.5,
    (isNight, was) => {
      if (isNight !== was) dotsNight.set(withTiming(isNight ? 1 : 0, timing));
    },
  );
  const dark = useAnimatedStyle(() => ({ opacity: 1 - nameNight.get() }));
  const light = useAnimatedStyle(() => ({ opacity: nameNight.get() }));
  return (
    <>
      {isReplay ? null : (
        <View style={[styles.brand, { top: layout.brandTop }]} pointerEvents="none">
          <Animated.View style={dark}>
            <AppText variant="title2" color="heading" align="center" accessibilityRole="text">
              {t('common:appName')}
            </AppText>
          </Animated.View>
          <Animated.View
            style={[StyleSheet.absoluteFill, light]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <AppText variant="title2" color="onAction" align="center">
              {t('common:appName')}
            </AppText>
          </Animated.View>
        </View>
      )}
      <View
        style={[styles.dots, { top: layout.dotsTop }]}
        pointerEvents="none"
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('pager.label')}
        accessibilityValue={{
          text: t('pager.position', { page: pageIndex + 1, total: pages.length }),
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === 'increment')
            showPage(Math.min(pages.length - 1, pageIndex + 1));
          if (nativeEvent.actionName === 'decrement') showPage(Math.max(0, pageIndex - 1));
        }}
        testID="onboarding-pager-indicator"
      >
        {pages.map((page, index) => (
          <Dot
            key={page.id}
            index={index}
            count={pages.length}
            position={position}
            night={dotsNight}
          />
        ))}
      </View>
    </>
  );
}

const DOT_SIZES = {
  dot: L.dot,
  small: L.dotSmall,
  smaller: L.dotSmaller,
  current: L.dotCurrent,
  gap: L.dotGap,
};

/**
 * One dot: its shape and place from the position (transforms only), the current dot's colour as
 * a layer over the plain one (opacity, not a colour per frame), both tinted for the night.
 */
function Dot({
  index,
  count,
  position,
  night,
}: {
  index: number;
  count: number;
  position: SharedValue<number>;
  night: SharedValue<number>;
}) {
  const day = useColorValues();
  const dark = useColorValues('dark');
  const shape = useAnimatedStyle(() => {
    const pos = position.get();
    let offset = 0;
    for (let k = 0; k < index && k < count; k += 1) offset += dotShape(k, pos, DOT_SIZES).room;
    const dot = dotShape(index, pos, DOT_SIZES);
    return {
      opacity: dot.width > 0 ? 1 : 0,
      transform: [
        { translateY: offset },
        { scaleX: dot.width / L.dot },
        { scaleY: dot.length / L.dotCurrent },
      ],
    };
  });
  const plain = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(night.get(), [0, 1], [day.pageDot, dark.pageDot]),
  }));
  const current = useAnimatedStyle(() => ({
    opacity: dotShape(index, position.get(), DOT_SIZES).current,
    backgroundColor: interpolateColor(night.get(), [0, 1], [day.pageDotCurrent, dark.nightPageInk]),
  }));
  return (
    <Animated.View style={[styles.dot, shape]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.dotFill, plain]} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.dotFill, current]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  brand: { position: 'absolute', start: 0, end: 0 },
  dots: {
    position: 'absolute',
    end: L.dotsEnd - (L.dotsTouchWidth - L.dot) / 2,
    width: L.dotsTouchWidth,
    height: L.dotCurrent * 2 + L.dot * 8,
    alignItems: 'center',
  },
  dot: {
    position: 'absolute',
    top: 0,
    width: L.dot,
    height: L.dotCurrent,
    transformOrigin: 'top',
  },
  dotFill: { borderRadius: L.dot / 2 },
});
