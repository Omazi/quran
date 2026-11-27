import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText, GlassSurface, ProgressRing, readerShapes, spacing } from '@/ui';

import { READER_CONFIG } from './config';
import type { DropMoment } from './drop-moment';
import { pillCopy, type PillLine } from './drop-pill-copy';

const { dropPillHeight, dropPillLeading, dropPillTrailing } = readerShapes;
/** The bounce when the drop lands (the mockup's curve, cubic-bezier(0.34, 1.56, 0.64, 1)). */
const BOUNCE_EASING = Easing.bezier(0.34, 1.56, 0.64, 1);

/** The pill as VoiceOver hears it: its two lines, joined as the language joins them. */
export function usePillSpoken(): (title: string, detail: string) => string {
  const { t } = useTranslation('reader');
  return (title, detail) => t('drop.spoken', { title, detail });
}

/** The words of a line of the pill, from the locale files. */
export function usePillLine(): (line: PillLine) => string {
  const { t } = useTranslation(['reader', 'garden']);
  return (line) => {
    switch (line.key) {
      case 'reader:drop.hizbPages':
        return t(line.key, { count: line.count, total: line.total, hizb: line.hizb });
      case 'reader:drop.today':
        return t(line.key, { count: line.count });
      case 'reader:drop.hizbCompleted':
        return t(line.key, { hizb: line.hizb });
      case 'reader:drop.newElement':
        return t(line.key, { element: t(`garden:kinds.${line.element}`) });
      default:
        return t(line.key);
    }
  };
}

export interface DropPillProps {
  moment: Exclude<DropMoment, { phase: 'idle' }>;
  /** Its distance to the bottom of the screen: above the bottom bar (owner's decision). */
  offset: number;
  isMotionReduced: boolean;
  /** Where the middle of its ring is across the screen, so the drop can fall into it. */
  onRingLayout: (centerX: number) => void;
}

/**
 * The glass pill the drop falls into (validated mockup of 27 November 2026, shots 21 and 22): the
 * small ring of what grows, and two lines, "Une goutte pour le grenadier · 3 pages sur 10 du hizb
 * 25" while the drop falls, then "Le grenadier a grandi · 4 pages sur 10" once it landed, when it
 * bounces a little. Status feedback near the text it is about, not an alert (feedback.md ›
 * Consider integrating status feedback into your interface); it never takes a touch. It rises in
 * with the system's snappy spring and fades out; with Reduce Motion it simply appears (motion.md ›
 * Make motion optional). VoiceOver hears it once, when the drop has landed (the screen announces
 * it).
 */
export function DropPill({ moment, offset, isMotionReduced, onRingLayout }: DropPillProps) {
  const lineOf = usePillLine();
  const spokenOf = usePillSpoken();
  const copy = pillCopy(moment.feedback, moment.phase);
  const title = lineOf(copy.title);
  const detail = lineOf(copy.detail);
  const { durationMs, dampingRatio, fromScale } = READER_CONFIG.feedbackEntrance;
  const { bounceMs, bounceScale } = READER_CONFIG.dropPill;
  const entrance = useSharedValue(isMotionReduced ? 1 : 0);
  // The ring's middle across the screen: where the pill lies in its room, plus where the ring lies
  // in the pill.
  const across = useRef({ pill: null as number | null, ring: null as number | null });
  const report = () => {
    const { pill, ring } = across.current;
    if (pill !== null && ring !== null) onRingLayout(pill + ring);
  };
  const bounce = useSharedValue(1);

  useEffect(() => {
    if (!isMotionReduced) entrance.value = withSpring(1, { duration: durationMs, dampingRatio });
  }, [dampingRatio, durationMs, entrance, isMotionReduced]);

  const isReceived = moment.phase === 'received';
  useEffect(() => {
    if (!isReceived || isMotionReduced) return;
    bounce.value = withSequence(
      withTiming(bounceScale, { duration: bounceMs * 0.35, easing: BOUNCE_EASING }),
      withTiming(1, { duration: bounceMs * 0.65, easing: BOUNCE_EASING }),
    );
  }, [bounce, bounceMs, bounceScale, isMotionReduced, isReceived]);

  // It rises a little into place, as in the mockup.
  const motion = useAnimatedStyle(() => ({
    opacity: Math.min(1, entrance.value),
    transform: [
      { translateY: spacing.sm * (1 - entrance.value) },
      { scale: (fromScale + (1 - fromScale) * entrance.value) * bounce.value },
    ],
  }));

  return (
    <View
      pointerEvents="none"
      style={[styles.room, { bottom: offset }]}
      testID="reader-feedback-room"
    >
      <Animated.View
        exiting={isMotionReduced ? undefined : FadeOut.duration(READER_CONFIG.sizePanelMs)}
        style={isMotionReduced ? undefined : motion}
        onLayout={(event: LayoutChangeEvent) => {
          across.current.pill = event.nativeEvent.layout.x;
          report();
        }}
        testID="reader-feedback-motion"
      >
        <GlassSurface radius={dropPillHeight / 2} style={styles.pill} testID="reader-feedback">
          <View
            accessible
            accessibilityLabel={spokenOf(title, detail)}
            style={styles.content}
            testID="reader-feedback-content"
          >
            <View
              onLayout={(event: LayoutChangeEvent) => {
                const { x, width } = event.nativeEvent.layout;
                across.current.ring = x + width / 2;
                report();
              }}
            >
              <ProgressRing
                progress={Math.min(1, Math.max(0, copy.ring))}
                size="small"
                tone="growth"
                accessibilityLabel={title}
                accessibilityValue={detail}
                testID="reader-feedback-ring"
              />
            </View>
            <View style={styles.words}>
              <AppText variant="subheadEmphasized" color="ink" numberOfLines={1}>
                {title}
              </AppText>
              <AppText variant="footnote" color="inkSecondary" numberOfLines={1}>
                {detail}
              </AppText>
            </View>
          </View>
        </GlassSurface>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  room: { position: 'absolute', start: 0, end: 0, alignItems: 'center' },
  pill: { minHeight: dropPillHeight, justifyContent: 'center' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs / 2,
    paddingStart: dropPillLeading,
    paddingEnd: dropPillTrailing,
  },
  words: { flexShrink: 1 },
});
