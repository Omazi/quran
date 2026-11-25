import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Rosette } from '@/features/listening/rosette/rosette';
import { StillRosette } from '@/features/listening/rosette/still-rosette';
import {
  AppText,
  ArabicDisplayText,
  QuranText,
  radius,
  spacing,
  storyLayout,
  storyMotion,
  useColors,
  useElevation,
  useReducedMotion,
} from '@/ui';

import { useDemoVoice } from './use-demo-voice';
import { useSamplePassage, type SamplePassageSources } from './use-sample-passage';

const PANEL = {
  height: storyLayout.rosettePanelHeight,
  foundHeight: storyLayout.rosettePanelFoundHeight,
} as const;
/** The rosette is centred in the tall panel; once found it rises to the middle of the short one. */
const FOUND_LIFT = (PANEL.height - PANEL.foundHeight) / 2;

export interface RecognitionSceneProps {
  /** True while the listening page is shown: the demonstration runs and the verse is loaded. */
  isShown: boolean;
  /** Only tests give it. */
  sources?: SamplePassageSources;
}

/**
 * The picture of the listening page: the app's real listening screen (D27, D29), the validated
 * rosette on the paper of the mushaf, breathing with a voice as it does when the app listens;
 * then the rosette shrinks, as it does on a result, and the card of the passage found, Al-Kahf
 * 18:10, rises under it (shazam.png's card); then again. It shows the feature rather than
 * describing it (onboarding.md › Best practices: teach through interactivity), and shows the
 * screen the person will meet.
 *
 * The motion is a demonstration and stays optional (motion.md › Best practices): with "reduce
 * motion" the rosette is the still one of a result and the card is shown found, at rest. It runs
 * only while its page is shown. The verse is the data layer's text, in the Quran font (D19).
 * Screen readers hear one description.
 */
export function RecognitionScene({ isShown, sources }: RecognitionSceneProps) {
  const { t, i18n } = useTranslation('onboarding');
  const colors = useColors();
  const isMotionReduced = useReducedMotion();
  const passage = useSamplePassage(isShown, sources);
  const { width: windowWidth } = useWindowDimensions();
  const panelWidth = windowWidth - 2 * spacing.md;
  // The demonstration alternates listening and found while the page is shown; resting, and with
  // reduced motion, the passage is found.
  const [isListening, setIsListening] = useState(false);
  const isRunning = isShown && !isMotionReduced;
  const isFound = !isRunning || !isListening;
  const found = useSharedValue(1);
  const subscribeToLevel = useDemoVoice(isRunning && isListening);

  useEffect(() => {
    if (!isRunning) return undefined;
    let timer: ReturnType<typeof setTimeout>;
    const listen = () => {
      setIsListening(true);
      timer = setTimeout(() => {
        setIsListening(false);
        timer = setTimeout(listen, storyMotion.loopMs - storyMotion.listenMs);
      }, storyMotion.listenMs);
    };
    listen();
    return () => clearTimeout(timer);
  }, [isRunning]);

  useEffect(() => {
    cancelAnimation(found);
    const target = isFound ? 1 : 0;
    if (isMotionReduced) {
      found.value = target;
      return;
    }
    found.value = withTiming(target, {
      duration: storyMotion.foundMs,
      easing: Easing.bezier(0.3, 0.8, 0.2, 1),
    });
  }, [isFound, isMotionReduced, found]);

  // In Arabic the surah is named in Arabic, as the listening screen names it.
  const surah = i18n.language === 'ar' ? passage.surahArabic : passage.surahName;
  const where = t('recognition.where', { surah, verse: passage.verse });
  const panelHeight = useAnimatedStyle(() => ({
    height: PANEL.height - (PANEL.height - PANEL.foundHeight) * found.value,
  }));
  const rosetteMoves = useAnimatedStyle(() => ({
    transform: [
      { translateY: -FOUND_LIFT * found.value },
      { scale: 1 - (1 - storyLayout.rosetteFoundScale) * found.value },
    ],
  }));
  const cardMoves = useAnimatedStyle(() => ({
    opacity: found.value,
    transform: [
      { translateY: storyLayout.foundCardRise * (1 - found.value) },
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
      <Animated.View
        style={[styles.panel, { backgroundColor: colors.paper }, panelHeight]}
        testID="onboarding-listening-panel"
      >
        <Animated.View style={[styles.rosette, { width: panelWidth }, rosetteMoves]}>
          {isMotionReduced ? (
            <View style={styles.still}>
              <StillRosette radius={storyLayout.rosetteRadius} />
            </View>
          ) : (
            <Rosette
              width={panelWidth}
              height={PANEL.height}
              frame={{
                cx: panelWidth / 2,
                cy: PANEL.height / 2,
                radius: storyLayout.rosetteRadius,
              }}
              subscribeToLevel={subscribeToLevel}
              reducedMotion={false}
            />
          )}
        </Animated.View>
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

const styles = StyleSheet.create({
  // The panel and the card keep the top of the stage: the panel shortens when the card comes.
  scene: {
    height: '100%',
    alignItems: 'stretch',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  panel: {
    overflow: 'hidden',
    borderRadius: storyLayout.rosettePanelRadius,
    borderCurve: 'continuous',
  },
  // As tall as the whole panel and centred in it: the rosette scales around its own middle.
  rosette: {
    height: PANEL.height,
    alignItems: 'center',
    justifyContent: 'center',
  },
  still: { alignItems: 'center', justifyContent: 'center' },
  cardSlot: { alignSelf: 'stretch', marginTop: spacing.sm },
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
