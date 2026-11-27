import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { readerShapes, useColors, useColorValues, useReducedMotion } from '@/ui';

import { READER_CONFIG } from './config';
import { drawnThreadShare } from './page-thread';
import { useThreadState } from './thread-store';

const { threadWidth, threadBead, threadHighlight, threadInset } = readerShapes;
const FLOW_EASING = Easing.linear;

/**
 * The water thread of one page, in the outer margin (validated mockup of 27 November 2026, shots
 * 20 to 22; it replaces the water line under the title, owner's decision): a thin line that fills
 * with water from the top of the page to its end as the page gathers its time, a bead of water at
 * the end of the fill, a light running down the water while it fills. Once the page counts, or for
 * a page the khatma already holds, it stays full, still and pale. It is a picture of what the pill
 * then says in words, so VoiceOver does not hear it (feedback.md › Make sure all feedback is
 * accessible, without chatter) and it never takes a touch. With Reduce Motion it moves by still
 * steps and its light does not run (motion.md › Make motion optional).
 *
 * It lies along the page's verses, on the left: the end of the Arabic lines, the outer margin, in
 * every interface language, like the text it follows.
 */
export function PageThreadView({ page }: { page: number }) {
  const state = useThreadState(page);
  const colors = useColors();
  // A shadow takes a plain colour.
  const { waterGlow } = useColorValues();
  const isMotionReduced = useReducedMotion();
  const [height, setHeight] = useState(0);
  const target = state === null ? 0 : drawnThreadShare(state, isMotionReduced);
  const fill = useSharedValue(target);
  const flow = useSharedValue(0);
  const isFilling = state?.kind === 'filling' || state?.kind === 'ready';
  const isDone = state?.kind === 'done';

  useEffect(() => {
    fill.value = isMotionReduced
      ? target
      : withTiming(target, { duration: READER_CONFIG.thread.followMs });
  }, [fill, isMotionReduced, target]);

  // The light runs down the water only while the page is being read, never with Reduce Motion.
  const isFlowing = isFilling && !isMotionReduced && target > 0;
  useEffect(() => {
    if (!isFlowing) {
      cancelAnimation(flow);
      flow.value = 0;
      return;
    }
    flow.value = withRepeat(
      withTiming(1, { duration: READER_CONFIG.thread.flowMs, easing: FLOW_EASING }),
      -1,
    );
    return () => cancelAnimation(flow);
  }, [flow, isFlowing]);

  const fillStyle = useAnimatedStyle(() => ({ height: height * fill.value }));
  const beadStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: height * fill.value - threadBead / 2 }],
  }));
  const flowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -threadHighlight + flow.value * (height + threadHighlight) }],
  }));

  if (state === null) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height)}
      testID={`page-thread-${page}`}
      style={[styles.thread, !isDone && { backgroundColor: colors.threadTrack }]}
    >
      <Animated.View
        testID={`page-thread-${page}-fill`}
        style={[
          styles.fill,
          { backgroundColor: colors.waterFill },
          isDone && styles.done,
          // With Reduce Motion the share is drawn as it is, without a measured height to follow.
          isMotionReduced ? { height: `${target * 100}%` } : fillStyle,
        ]}
      >
        {isFlowing ? (
          <Animated.View
            style={[styles.flow, { backgroundColor: colors.waterHighlight }, flowStyle]}
          />
        ) : null}
      </Animated.View>
      {isDone ? null : (
        <Animated.View
          testID={`page-thread-${page}-bead`}
          style={[
            styles.bead,
            {
              backgroundColor: colors.waterFill,
              boxShadow: `0px 0px ${threadBead}px ${waterGlow}`,
            },
            isMotionReduced ? { top: `${target * 100}%`, marginTop: -threadBead / 2 } : beadStyle,
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  thread: {
    position: 'absolute',
    // In the margin, before the text, on the physical left: the page lays out left to right (see
    // `PageSectionView`).
    left: -(readerShapes.threadFromText + threadWidth / 2),
    top: threadInset,
    bottom: threadInset,
    width: threadWidth,
    borderRadius: threadWidth / 2,
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderRadius: threadWidth / 2,
    overflow: 'hidden',
  },
  done: { opacity: READER_CONFIG.thread.doneOpacity },
  flow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: threadHighlight,
    opacity: READER_CONFIG.thread.flowOpacity,
  },
  bead: {
    position: 'absolute',
    top: 0,
    left: (threadWidth - threadBead) / 2,
    width: threadBead,
    height: threadBead,
    borderRadius: threadBead / 2,
  },
});
