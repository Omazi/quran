import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import type { FollowState } from '@/domain/listening';
import type { QuranRepository } from '@/domain/quran';
import { FollowBar } from '@/features/listening/follow/follow-bar';
import { FollowPage } from '@/features/listening/follow/follow-page';
import { listeningShape, spacing, storyLayout, storyMotion, useReducedMotion } from '@/ui';

import { useDemoVoice } from './use-demo-voice';
import { useSampleRecitation } from './use-sample-recitation';

/**
 * The steps of the demonstration, as the states the domain gives the page (`FollowState`): the
 * words come one by one, the person leaves one out, the page marks it to read again, and the
 * person reads it. `current` is the word just recited, `reread` the word to read again.
 */
const REREAD_WORD = 2;
export const VOICE_DEMO_STEPS: readonly FollowState[] = [
  { next: 0, current: null, reread: null },
  { next: 1, current: 0, reread: null },
  { next: 2, current: 1, reread: null },
  // Word 2 is left out: the next word heard is 3, and word 2 is marked.
  { next: 4, current: 3, reread: REREAD_WORD },
  { next: 4, current: 3, reread: REREAD_WORD },
  { next: 4, current: 3, reread: null },
  { next: 5, current: 4, reread: null },
  { next: 6, current: 5, reread: null },
  { next: 7, current: 6, reread: null },
  { next: 8, current: 7, reread: null },
];
/** The picture shown still, and with "reduce motion": the word to read again is marked. */
export const VOICE_DEMO_REST: FollowState = { next: 4, current: 3, reread: REREAD_WORD };
const LAST_STEP = VOICE_DEMO_STEPS.length - 1;

export interface VoiceSceneProps {
  /** True while the page is shown: the demonstration runs and the words are loaded. */
  isShown: boolean;
  /** Only tests give it. */
  repository?: QuranRepository;
}

/**
 * The picture of the page about reading aloud: a few words of the Quran as the reader sets them
 * on paper (voix.png), the words recited in ink, the word just recited on gold, a word left out
 * in red on rose, and under them the green bar that listens and says which word to read again.
 * It is the real page and the real bar of the voice following (`FollowPage`, `FollowBar`), fed
 * with a script instead of a microphone; the words are the data layer's, in the Quran font.
 *
 * The motion is a demonstration and stays optional (motion.md › Best practices): with "reduce
 * motion" the page is shown at the moment a word is marked, at rest. It runs only while its page
 * is shown. Screen readers hear one description.
 */
export function VoiceScene({ isShown, repository }: VoiceSceneProps) {
  const { t } = useTranslation('onboarding');
  const isMotionReduced = useReducedMotion();
  const lines = useSampleRecitation(isShown, repository);
  const { width: windowWidth } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const isRunning = isShown && !isMotionReduced;
  const subscribeToLevel = useDemoVoice(isRunning);

  useEffect(() => {
    if (!isRunning) return undefined;
    let timer: ReturnType<typeof setTimeout>;
    const advance = (to: number) => {
      setStep(to);
      timer = setTimeout(
        () => advance(to === LAST_STEP ? 0 : to + 1),
        to === LAST_STEP ? storyMotion.voiceRestMs : storyMotion.voiceStepMs,
      );
    };
    advance(0);
    return () => clearTimeout(timer);
  }, [isRunning]);

  // Not running (the page is not shown, or motion is reduced): the picture at rest.
  const follow = isRunning ? (VOICE_DEMO_STEPS[step] ?? VOICE_DEMO_REST) : VOICE_DEMO_REST;
  const words = lines?.flatMap((line) => line.words) ?? [];
  const rereadWord =
    follow.reread === null
      ? null
      : (words.find(({ index }) => index === follow.reread)?.word.text ?? null);
  const pageWidth = windowWidth - 2 * spacing.md;
  const lineHeight = Math.round(storyLayout.voiceTextSize * listeningShape.followLineHeightEm);
  // Three lines of text between the frame's rules and its padding.
  const pageHeight =
    storyLayout.voiceLineCount * lineHeight + 2 * (spacing.md + listeningShape.followRuleGap + 2);

  return (
    <View
      style={styles.scene}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('scenes.voice')}
      testID="onboarding-voice-scene"
    >
      <View style={{ height: pageHeight }}>
        {lines === null ? null : (
          <FollowPage
            lines={lines}
            follow={follow}
            startIndex={0}
            width={pageWidth}
            textSize={storyLayout.voiceTextSize}
            testID="onboarding-voice-page"
          />
        )}
      </View>
      <FollowBar
        subscribeToLevel={isMotionReduced ? null : subscribeToLevel}
        reducedMotion={isMotionReduced}
        rereadWord={rereadWord}
        onStop={noop}
      />
    </View>
  );
}

function noop() {}

const styles = StyleSheet.create({
  scene: {
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    rowGap: storyLayout.voiceBarGap,
  },
});
