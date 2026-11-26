import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AppText, Icon, voiceStoryLayout as L } from '@/ui';

import { STORY_MOTION } from '../config';
import type { OnboardingPage } from '../pages';
import { copyBlockLook, introArrival, smooth } from '../story-math';
import type { PageProps } from './page-props';

/**
 * The words of a story or feature page (`.copy`): the title and its sentence, pinned low on the
 * screen; the title leads and the sentence follows it in, then they leave as one (motion spec §3), light
 * on the dusk of the two voice pages. First comes the scene, described in words for screen
 * readers: the pictures themselves are decoration.
 */
export function PageCopy({
  page,
  index,
  position,
  layout,
  reducedMotion,
  introMs,
  sceneLabel,
}: PageProps) {
  const { t } = useTranslation('onboarding');
  const isDusk = page.sky.dusk > 0.5;
  // The title leads, the sentence follows (motion spec §3); on the first page they arrive at
  // 320 and 420 ms, rising 16 and 20 points (§2).
  const travel = { title: L.copyTravel, text: L.copyTextTravel };
  const title = useAnimatedStyle(() => {
    const look = copyBlockLook(position.get(), index, 'title', travel, reducedMotion);
    const arrival =
      index === 0 ? introArrival(introMs.get(), STORY_MOTION.introCopyDelayMs, reducedMotion) : 1;
    return {
      opacity: look.opacity * arrival,
      transform: [{ translateY: look.translateY + (1 - arrival) * L.introTitleRise }],
    };
  });
  const text = useAnimatedStyle(() => {
    const look = copyBlockLook(position.get(), index, 'text', travel, reducedMotion);
    const arrival =
      index === 0 ? introArrival(introMs.get(), STORY_MOTION.introTextDelayMs, reducedMotion) : 1;
    return {
      opacity: look.opacity * arrival,
      transform: [{ translateY: look.translateY + (1 - arrival) * L.introTextRise }],
    };
  });
  return (
    <>
      <SceneDescription layout={layout} label={sceneLabel} />
      <View style={[styles.copy, { top: layout.copyTop }]}>
        <Animated.View style={title}>
          <AppText
            variant="title1"
            color={isDusk ? 'onAction' : 'heading'}
            accessibilityRole="header"
          >
            {t(page.title)}
          </AppText>
        </Animated.View>
        <Animated.View style={[styles.text, text]}>
          <AppText variant="body" color={isDusk ? 'onActionSecondary' : 'muted'}>
            {t(page.text)}
          </AppText>
        </Animated.View>
      </View>
      {index === 0 ? (
        <SwipeHint
          position={position}
          layout={layout}
          introMs={introMs}
          reducedMotion={reducedMotion}
        />
      ) : null}
    </>
  );
}

/** An element over the scene for screen readers: the scene in words. */
export function SceneDescription({
  layout,
  label,
}: {
  layout: PageProps['layout'];
  label: string;
}) {
  return (
    <View
      style={[styles.scene, { top: layout.garden.top, height: layout.garden.height }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    />
  );
}

/** "Glisse vers le haut" with its chevron that rises and fades, over and over (`.hint`). */
function SwipeHint({
  position,
  layout,
  introMs,
  reducedMotion,
}: Pick<PageProps, 'position' | 'layout' | 'introMs' | 'reducedMotion'>) {
  const { t } = useTranslation('onboarding');
  const nudge = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    nudge.set(
      withRepeat(
        withTiming(1, {
          duration: STORY_MOTION.hintLoopMs,
          easing: Easing.bezier(...STORY_MOTION.easeOutCurve),
        }),
        -1,
        false,
      ),
    );
  }, [nudge, reducedMotion]);
  const whole = useAnimatedStyle(() => ({
    opacity:
      smooth(1 - position.get() * STORY_MOTION.hintRate) *
      (reducedMotion ? 1 : introArrival(introMs.get(), STORY_MOTION.introHintDelayMs, false)),
  }));
  const chevron = useAnimatedStyle(() => {
    if (reducedMotion) return { opacity: 1, transform: [{ translateY: 0 }] };
    const t = nudge.get();
    const peak = STORY_MOTION.hintPeak;
    const opacity = t < peak ? t / peak : 1 - (t - peak) / (1 - peak);
    return {
      opacity,
      transform: [{ translateY: L.hintTravelFrom + (L.hintTravelTo - L.hintTravelFrom) * t }],
    };
  });
  return (
    <Animated.View style={[styles.hint, { top: layout.hintTop }, whole]} pointerEvents="none">
      <Animated.View style={chevron}>
        <Icon
          symbol={{ ios: 'chevron.up', android: 'keyboard_arrow_up' }}
          color="actionTint"
          textStyle="headline"
        />
      </Animated.View>
      <AppText variant="subheadEmphasized" color="actionTint" align="center">
        {t('hint')}
      </AppText>
    </Animated.View>
  );
}

/** Keys of the words of a scene, for the description above. */
export function sceneLabelKey(page: OnboardingPage): {
  key: string;
  values?: Record<string, number>;
} {
  switch (page.kind) {
    case 'voice':
      return { key: 'scenes.voice' };
    case 'recognition':
      return { key: 'scenes.recognition' };
    case 'friends':
      return { key: 'scenes.friends' };
    case 'goal':
    case 'reminders':
      return { key: 'scenes.preview' };
    case 'story':
      break;
  }
  const caption = page.caption;
  if (caption === null) return { key: 'scenes.bareEarth' };
  switch (caption.kind) {
    case 'hizb':
      return { key: 'scenes.garden', values: { hizb: caption.hizb } };
    case 'drought':
      return { key: 'scenes.drought', values: { count: caption.days } };
    case 'revival':
      return { key: 'scenes.revival' };
    case 'preview':
      return { key: 'scenes.preview' };
  }
}

const styles = StyleSheet.create({
  copy: { position: 'absolute', start: L.margin, end: L.margin },
  text: { marginTop: L.copyGap },
  scene: { position: 'absolute', start: L.margin, end: L.margin },
  hint: { position: 'absolute', start: 0, end: 0, alignItems: 'center', gap: L.hintGap },
});
