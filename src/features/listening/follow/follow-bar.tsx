import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { Unsubscribe } from '@/domain/listening';
import { useGenderedTranslation } from '@/features/gender';
import { fontFamily, listeningShape, spacing, useColorValues, type IconSymbol } from '@/ui';

import { METER_MOTION } from '../config';
import { RoundButton } from './round-button';
import { SceneText } from './scene-text';
import {
  advance,
  createRosetteMotion,
  receiveLevel,
  type RosetteMotion,
} from '../rosette/rosette-motion';

const STOP_SYMBOL: IconSymbol = { ios: 'stop.fill', android: 'stop' };
const NO_WORDS: readonly string[] = [];

export interface FollowBarProps {
  readonly subscribeToLevel: ((listener: (level: number) => void) => Unsubscribe) | null;
  readonly reducedMotion: boolean;
  /** The word to read again, exactly as the data writes it, or null. */
  readonly rereadWord: string | null;
  /** A voice is heard right now: the bar says "Je t'entends". Default false. */
  readonly isHearing?: boolean;
  /** The latest words heard, shown faintly when there is no word to read again. */
  readonly heardWords?: readonly string[];
  readonly onStop: () => void;
}

/**
 * The listening bar of voix.png, floating at the bottom of the page: a meter that moves with the
 * voice, "J'écoute", then the word to read again, in the Quran's script, when there is one, and
 * a round stop button. The meter is an ornament; the bar's words say the state, and VoiceOver
 * hears the word to read again as one sentence.
 */
export function FollowBar({
  subscribeToLevel,
  reducedMotion,
  rereadWord,
  isHearing = false,
  heardWords = NO_WORDS,
  onStop,
}: FollowBarProps) {
  const { t } = useGenderedTranslation('listening');
  const colors = useColorValues();
  const title = isHearing ? t('follow.hearing') : t('follow.title');
  const heard = heardWords.join(' ');
  return (
    <View style={[styles.bar, { shadowColor: colors.shadow }]} testID="follow-bar">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="follow-bar" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.followBarStart} />
            <Stop offset="1" stopColor={colors.followBarEnd} />
          </LinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx={listeningShape.followBarHeight / 2}
          fill="url(#follow-bar)"
        />
      </Svg>
      <VoiceMeter
        subscribeToLevel={subscribeToLevel}
        reducedMotion={reducedMotion}
        color={colors.onFollowBar}
      />
      <View
        style={styles.words}
        accessible
        // Only the word to read again is announced: the voice and the words heard change too
        // often to be spoken (feedback.md: no chatter).
        accessibilityLabel={
          rereadWord === null
            ? t('follow.title')
            : `${t('follow.title')}. ${t('follow.rereadLabel', { word: rereadWord })}`
        }
        accessibilityLiveRegion="polite"
      >
        <SceneText
          variant="headline"
          color={colors.onFollowBar}
          numberOfLines={1}
          testID="follow-title"
        >
          {title}
        </SceneText>
        <View style={styles.hint}>
          {rereadWord === null && heard !== '' ? (
            // The words heard, faint, in the writing of the voice (right to left).
            <Text
              accessibilityLanguage="ar"
              numberOfLines={1}
              style={[styles.heardWords, { color: colors.onFollowBarSecondary }]}
              testID="follow-heard"
            >
              {heard}
            </Text>
          ) : (
            <SceneText variant="footnote" color={colors.onFollowBarSecondary} numberOfLines={1}>
              {rereadWord === null ? t('follow.following') : t('follow.reread')}
            </SceneText>
          )}
          {rereadWord === null ? null : (
            // The word exactly as the data writes it, in the Quran font, right to left.
            <Text
              accessibilityLanguage="ar"
              style={[styles.quranWord, { color: colors.onFollowBarSecondary }]}
              testID="follow-reread-word"
            >
              {rereadWord}
            </Text>
          )}
        </View>
      </View>
      <RoundButton
        symbol={STOP_SYMBOL}
        accessibilityLabel={t('follow.stop')}
        onPress={onStop}
        background={colors.followBarControl}
        foreground={colors.onFollowBar}
        diameter={listeningShape.followStopDiameter}
        testID="follow-stop"
      />
    </View>
  );
}

interface VoiceMeterProps {
  readonly subscribeToLevel: FollowBarProps['subscribeToLevel'];
  readonly reducedMotion: boolean;
  readonly color: string;
}

/** Eleven bars that rise with the voice; still with reduced motion (motion.md). */
function VoiceMeter({ subscribeToLevel, reducedMotion, color }: VoiceMeterProps) {
  const [initialMotion] = useState(createRosetteMotion);
  const motion = useSharedValue<RosetteMotion>(initialMotion);
  const inbox = useSharedValue<number[]>([]);
  const isMoving = subscribeToLevel !== null && !reducedMotion;

  useEffect(() => {
    if (subscribeToLevel === null) return undefined;
    return subscribeToLevel((level) => {
      inbox.modify((samples) => {
        'worklet';
        samples.push(level);
        return samples;
      });
    });
  }, [subscribeToLevel, inbox]);

  useFrameCallback((frame) => {
    'worklet';
    if (!isMoving) return;
    const samples = inbox.get();
    if (samples.length > 0) inbox.set([]);
    motion.modify((state) => {
      'worklet';
      for (const sample of samples) receiveLevel(state, sample, false);
      advance(state, (frame.timeSincePreviousFrame ?? 0) / 1000, false);
      return state;
    });
  });

  return (
    <View
      style={styles.meter}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="follow-meter"
    >
      {METER_MOTION.shape.map((share, index) => (
        <MeterBar
          key={index}
          share={share}
          index={index}
          motion={motion}
          isMoving={isMoving}
          color={color}
        />
      ))}
    </View>
  );
}

interface MeterBarProps {
  readonly share: number;
  readonly index: number;
  readonly motion: SharedValue<RosetteMotion>;
  readonly isMoving: boolean;
  readonly color: string;
}

function MeterBar({ share, index, motion, isMoving, color }: MeterBarProps) {
  const style = useAnimatedStyle(() => {
    if (!isMoving) return { transform: [{ scaleY: 1 }] };
    const { level, time } = motion.get();
    // Each bar answers the voice a little out of step with its neighbours.
    const m = METER_MOTION;
    const wave = 0.5 + 0.5 * Math.sin(time * m.waveSpeed + index * m.waveStep);
    const reach = Math.min(1, level * m.gain * (1 - m.waveShare + m.waveShare * wave));
    return { transform: [{ scaleY: m.floor + (1 - m.floor) * reach }] };
  });
  return (
    <Animated.View
      style={[
        styles.meterBar,
        { height: listeningShape.meterHeight * share, backgroundColor: color },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: listeningShape.followBarHeight,
    borderRadius: listeningShape.followBarHeight / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingStart: spacing.md + spacing.xs,
    paddingEnd: spacing.sm,
    paddingVertical: spacing.sm,
    shadowOpacity: listeningShape.floatingShadow.opacity,
    shadowRadius: listeningShape.floatingShadow.radius,
    shadowOffset: { width: 0, height: listeningShape.floatingShadow.offsetY },
    elevation: listeningShape.floatingShadow.elevation,
  },
  meter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: listeningShape.meterBarGap,
    height: listeningShape.meterHeight,
  },
  meterBar: {
    width: listeningShape.meterBarWidth,
    borderRadius: listeningShape.meterBarWidth / 2,
  },
  words: { flex: 1, gap: spacing.xs },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  heardWords: {
    flexShrink: 1,
    fontSize: listeningShape.barWordSize * 0.75,
    writingDirection: 'rtl',
    opacity: 0.85,
  },
  quranWord: {
    fontFamily: fontFamily.quran,
    fontSize: listeningShape.barWordSize,
    lineHeight: listeningShape.barWordSize * listeningShape.followLineHeightEm,
    writingDirection: 'rtl',
  },
});
