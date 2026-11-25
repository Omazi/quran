import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import {
  AppText,
  ArabicDisplayText,
  Icon,
  QuranText,
  radius,
  spacing,
  storyLayout,
  storyMotion,
  useColors,
  useElevation,
  useColorValues,
  useReducedMotion,
} from '@/ui';

import { useSamplePassage, type SamplePassageSources } from './use-sample-passage';

/** The order the rays beat in: each one a little later than the one before, as the prototype. */
const RAY_DELAY_STEP = 0.37;
const MICROPHONE = { ios: 'mic.fill', android: 'mic' } as const;

export interface RecognitionSceneProps {
  /** True while the listening page is shown: the demonstration runs and the verse is loaded. */
  isShown: boolean;
  /** Only tests give it. */
  sources?: SamplePassageSources;
}

/**
 * The picture of the listening page, as the validated mockup and prototype draw it (shazam.png,
 * the prototype's `.shz`): a golden microphone that listens, rays beating around it, rings
 * spreading, then the card of the passage found, Al-Kahf 18:10, rising over it; then again. It
 * shows the feature rather than describing it (onboarding.md › Best practices: teach through
 * interactivity).
 *
 * The motion is a demonstration and stays optional (motion.md › Best practices): with "reduce
 * motion" the card is shown found, at rest. It runs only while its page is shown. The verse is
 * the data layer's text, in the Quran font (D19). Screen readers hear one description.
 */
export function RecognitionScene({ isShown, sources }: RecognitionSceneProps) {
  const { t, i18n } = useTranslation('onboarding');
  const isMotionReduced = useReducedMotion();
  const passage = useSamplePassage(isShown, sources);
  const found = useSharedValue(1);
  const beat = useSharedValue(0);

  useEffect(() => {
    if (!isShown || isMotionReduced) {
      cancelAnimation(found);
      cancelAnimation(beat);
      found.value = 1;
      return;
    }
    const ease = { duration: storyMotion.foundMs, easing: Easing.bezier(0.3, 0.8, 0.2, 1) };
    found.value = 0;
    found.value = withRepeat(
      withSequence(
        withDelay(storyMotion.listenMs, withTiming(1, ease)),
        withDelay(
          storyMotion.loopMs - storyMotion.listenMs - 2 * storyMotion.foundMs,
          withTiming(0, ease),
        ),
      ),
      -1,
    );
    beat.value = 0;
    beat.value = withRepeat(
      withTiming(1, { duration: storyMotion.ringMs, easing: Easing.linear }),
      -1,
    );
  }, [isShown, isMotionReduced, found, beat]);

  // In Arabic the surah is named in Arabic, as the listening screen names it.
  const surah = i18n.language === 'ar' ? passage.surahArabic : passage.surahName;
  const where = t('recognition.where', { surah, verse: passage.verse });
  const orbMoves = useAnimatedStyle(() => ({
    transform: [
      { translateY: -storyLayout.orbFoundLift * found.value },
      { scale: 1 - (1 - storyLayout.orbFoundScale) * found.value },
    ],
  }));
  const cardMoves = useAnimatedStyle(() => ({
    opacity: found.value,
    transform: [
      { translateY: storyLayout.foundCardOverlap * 0.75 * (1 - found.value) },
      { scale: 0.96 + 0.04 * found.value },
    ],
  }));

  return (
    <View
      style={styles.scene}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${t('scenes.recognition')}, ${where}`}
      testID="onboarding-recognition-scene"
    >
      <Animated.View style={[styles.orb, orbMoves]}>
        <Rays beat={beat} found={found} />
        <Ring beat={beat} offset={0} />
        <Ring beat={beat} offset={0.5} />
        <Microphone />
      </Animated.View>
      <Animated.View style={[styles.cardSlot, cardMoves]}>
        <FoundCard
          surahArabic={t('listening:surahArabic', { name: passage.surahArabic })}
          where={where}
          page={t('recognition.page', { page: passage.page })}
          title={t('recognition.found')}
          text={passage.text}
        />
      </Animated.View>
    </View>
  );
}

/** The golden disc of the microphone: a radial gold, the system's microphone symbol on it. */
function Microphone() {
  const palette = useColorValues();
  const shadow = useElevation('floating');
  return (
    <View style={[styles.microphone, { boxShadow: shadow }]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="onboarding-orb" cx="35%" cy="30%" r="75%">
            <Stop offset="0" stopColor={palette.orbLight} />
            <Stop offset="0.58" stopColor={palette.orbMiddle} />
            <Stop offset="1" stopColor={palette.orbDeep} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#onboarding-orb)" />
      </Svg>
      <Icon symbol={MICROPHONE} textStyle="largeTitle" color="onOrb" />
    </View>
  );
}

function Rays({ beat, found }: { beat: SharedValue<number>; found: SharedValue<number> }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      {Array.from({ length: storyLayout.orbRayCount }, (_, ray) => (
        <Ray key={ray} ray={ray} beat={beat} found={found} />
      ))}
    </View>
  );
}

function Ray({
  ray,
  beat,
  found,
}: {
  ray: number;
  beat: SharedValue<number>;
  found: SharedValue<number>;
}) {
  const { orbRays } = useColorValues();
  const angle = (360 / storyLayout.orbRayCount) * ray;
  const delay = (ray * RAY_DELAY_STEP) % 1;
  const span = storyLayout.orbRayLongest - storyLayout.orbRayShortest;
  // The rays beat once a second; the ring clock turns every 2.4 s.
  const cycles = storyMotion.ringMs / storyMotion.rayBeatMs;
  const grow = useAnimatedStyle(() => {
    const phase = (beat.value * cycles + delay) % 1;
    const pulse = 0.5 - 0.5 * Math.cos(2 * Math.PI * phase);
    const listening = storyLayout.orbRayShortest + span * pulse;
    // Once the passage is found, the rays rest at their shortest.
    const height = listening + (storyLayout.orbRayShortest - listening) * found.value;
    return { height, opacity: 0.45 + 0.55 * pulse * (1 - found.value) };
  });
  return (
    <View
      style={[
        styles.raySlot,
        { transform: [{ rotate: `${angle}deg` }, { translateY: -storyLayout.orbRayRadius }] },
      ]}
    >
      <Animated.View style={[styles.ray, { backgroundColor: orbRays }, grow]} />
    </View>
  );
}

function Ring({ beat, offset }: { beat: SharedValue<number>; offset: number }) {
  const { orbRays } = useColorValues();
  const spread = useAnimatedStyle(() => {
    const progress = (beat.value + offset) % 1;
    return { opacity: 0.9 * (1 - progress), transform: [{ scale: 0.6 + 0.65 * progress }] };
  });
  return <Animated.View style={[styles.ring, { borderColor: orbRays }, spread]} />;
}

interface FoundCardProps {
  title: string;
  page: string;
  surahArabic: string;
  where: string;
  text: string | null;
}

/** The card of the passage found (shazam.png): where it is, then the verse on cream. */
function FoundCard({ title, page, surahArabic, where, text }: FoundCardProps) {
  const colors = useColors();
  const shadow = useElevation('floating');
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, boxShadow: shadow }]}>
      <View style={styles.cardTop}>
        <AppText variant="subheadEmphasized" color="actionTint" style={styles.cardTitle}>
          {title}
        </AppText>
        <View style={[styles.pageChip, { backgroundColor: colors.actionTonal }]}>
          <AppText variant="footnote" color="actionTint">
            {page}
          </AppText>
        </View>
      </View>
      <ArabicDisplayText text={surahArabic} align="center" />
      <AppText variant="headline" align="center">
        {where}
      </AppText>
      {text === null ? null : (
        <View style={[styles.verse, { backgroundColor: colors.surfaceInset }]}>
          <QuranText runs={[{ text }]} variant="openingWords" />
        </View>
      )}
    </View>
  );
}

const ORB = storyLayout.orb;
const MIC = storyLayout.orbMicrophone;
const RAY_SLOT = storyLayout.orbRayLongest;

const styles = StyleSheet.create({
  scene: { alignItems: 'center', paddingHorizontal: spacing.md },
  orb: { width: ORB, height: ORB, alignItems: 'center', justifyContent: 'center' },
  // Every ray turns around the centre of the disc: its slot is centred there, then pushed out.
  raySlot: {
    position: 'absolute',
    start: ORB / 2 - storyLayout.orbRayWidth / 2,
    top: ORB / 2 - RAY_SLOT / 2,
    width: storyLayout.orbRayWidth,
    height: RAY_SLOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ray: { width: storyLayout.orbRayWidth, borderRadius: storyLayout.orbRayWidth / 2 },
  ring: {
    position: 'absolute',
    top: storyLayout.orbRingInset,
    bottom: storyLayout.orbRingInset,
    start: storyLayout.orbRingInset,
    end: storyLayout.orbRingInset,
    borderRadius: ORB,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  microphone: {
    width: MIC,
    height: MIC,
    borderRadius: MIC / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSlot: { alignSelf: 'stretch', marginTop: -storyLayout.foundCardOverlap },
  card: {
    borderRadius: storyLayout.foundCardRadius,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.sm,
  },
  cardTitle: { flexShrink: 1 },
  pageChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  verse: { marginTop: spacing.xs, borderRadius: radius.lg, paddingHorizontal: spacing.sm },
});
