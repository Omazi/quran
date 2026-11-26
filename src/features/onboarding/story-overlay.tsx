import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText, useColorValues, voiceStoryLayout as L } from '@/ui';

import type { OnboardingPage } from './pages';
import type { StageLayout } from './stage-layout';
import { dotShape, skyAt } from './story-math';

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
  const skies = useMemo(() => pages.map((page) => page.sky), [pages]);
  const dark = useAnimatedStyle(() => ({ opacity: 1 - skyAt(skies, position.get()).dusk }));
  const light = useAnimatedStyle(() => ({ opacity: skyAt(skies, position.get()).dusk }));
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
          <Dot key={page.id} index={index} count={pages.length} position={position} skies={skies} />
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

function Dot({
  index,
  count,
  position,
  skies,
}: {
  index: number;
  count: number;
  position: SharedValue<number>;
  skies: readonly OnboardingPage['sky'][];
}) {
  const day = useColorValues();
  const night = useColorValues('dark');
  const style = useAnimatedStyle(() => {
    const pos = position.get();
    let offset = 0;
    for (let k = 0; k < index && k < count; k += 1) offset += dotShape(k, pos, DOT_SIZES).room;
    const shape = dotShape(index, pos, DOT_SIZES);
    const dusk = skyAt(skies, pos).dusk;
    const other = interpolateColor(dusk, [0, 1], [day.pageDot, night.pageDot]);
    const current = interpolateColor(dusk, [0, 1], [day.pageDotCurrent, night.nightPageInk]);
    return {
      backgroundColor: interpolateColor(shape.current, [0, 1], [other, current]),
      opacity: shape.width > 0 ? 1 : 0,
      transform: [
        { translateY: offset },
        { scaleX: shape.width / L.dot },
        { scaleY: shape.length / L.dotCurrent },
      ],
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
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
    borderRadius: L.dot / 2,
    transformOrigin: 'top',
  },
});
